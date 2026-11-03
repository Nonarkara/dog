import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import type {AccountEnv,D1,D1Statement} from '../worker/accounts';

if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const origin='http://localhost:4181',host='fixture.clerk.accounts.dev',publishableKey='pk_test_'+btoa(host+'$'),secretKey='sk_test_fixture';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'fixture',alg:'RS256',use:'sig'};
const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function jwt(extra:Record<string,unknown>={}){const now=Math.floor(Date.now()/1000),raw=encode({alg:'RS256',typ:'JWT',kid:'fixture'})+'.'+encode({v:2,sub:'user_fixture',sid:'sess_fixture',iss:'https://'+host,azp:origin,iat:now,nbf:now-2,exp:now+60,...extra});return raw+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(raw))).toString('base64url');}
let sessionStatus='active',emailVerified=true,deletionFails=false,removed=false,fetches=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{fetches++;const url=String(input instanceof Request?input.url:input);let data:unknown;
 if(url.includes('/jwks'))data={keys:[jwk]};
 else if(url.includes('/sessions/sess_fixture')){if(url.endsWith('/revoke'))sessionStatus='revoked';data={object:'session',id:'sess_fixture',status:sessionStatus,user_id:'user_fixture'};}
 else if(url.includes('/users/user_fixture')){if((options?.method??(input instanceof Request?input.method:'GET'))==='DELETE'){if(deletionFails)return Response.json({errors:[{message:'Unavailable',code:'internal_server_error'}]},{status:403});removed=true;}data={object:'user',id:'user_fixture',first_name:'Email',last_name:'Friend',password_enabled:true,primary_email_address_id:'email_fixture',email_addresses:[{id:'email_fixture',object:'email_address',email_address:'owner@example.test',linked_to:[],verification:{status:emailVerified?'verified':'unverified',strategy:'email_code'}}],external_accounts:[],public_metadata:{},private_metadata:{},unsafe_metadata:{}};}
 else throw new Error('Unexpected Clerk endpoint: '+url);
 return Response.json(data);
};
const {handleAccounts,currentUser,providersFor}=await import('../worker/accounts');
const {emailConfig,emailIdentity,drainEmailDeletions}=await import('../worker/emailAuth');
class MemoryDB implements D1{
 sql=new DatabaseSync(':memory:');failBatch=false;race=false;beforeDogWrite:(()=>void)|undefined;
 constructor(){for(const name of readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort())this.sql.exec(readFileSync('migrations/'+name,'utf8'));}
 get users(){return this.sql.prepare('SELECT * FROM users').all();}
 get queue(){const db=this;return{has:(id:string)=>!!db.sql.prepare('SELECT 1 FROM email_deletions WHERE provider_sub=?').get(id),clear:()=>db.sql.exec('DELETE FROM email_deletions')};}
 get completed(){const db=this;return{has:(id:string)=>!!db.sql.prepare('SELECT 1 FROM email_deletions WHERE provider_sub=? AND completed_at IS NOT NULL').get(id)};}
 prepare(sql:string):D1Statement{let values:unknown[]=[];const db=this;return{bind(...v){values=v;return this;},async first<T>(){return (db.sql.prepare(sql).get(...values as never[])??null) as T|null;},async all<T>(){return{results:db.sql.prepare(sql).all(...values as never[]) as T[]};},async run(){
  if(db.race&&sql.startsWith('INSERT INTO users')){db.sql.prepare('INSERT OR IGNORE INTO email_deletions(provider_sub,requested_at) VALUES(?,?)').run(String(values[2]),Date.now());db.sql.exec('DELETE FROM users');}
  if(sql.startsWith('INSERT INTO dogs')&&db.beforeDogWrite){const interleave=db.beforeDogWrite;db.beforeDogWrite=undefined;interleave();}
  const result=db.sql.prepare(sql).run(...values as never[]);return{meta:{changes:Number(result.changes)}};
 }};}
 async batch(statements:D1Statement[]){if(this.failBatch)throw Error('D1 unavailable');this.sql.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());this.sql.exec('COMMIT');return out;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
const db=new MemoryDB(),env:AccountEnv={DB:db,CLERK_EMAIL_READY:'1',CLERK_PUBLISHABLE_KEY:publishableKey,CLERK_SECRET_KEY:secretKey};
const request=(path:string,token:string,method='GET',extra:Record<string,string>={})=>new Request(origin+path,{method,headers:{Authorization:'Bearer '+token,'X-TDC':'1',Origin:origin,...extra}});
try{
 assert.deepEqual(providersFor(new URL('https://dog.nonarkara.org'),{DB:db,GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:'fixture',LINE_CHANNEL_ID:'fixture',LINE_CHANNEL_SECRET:'fixture'}),['line','google'],'Google and LINE remain configured independently');
 assert.equal(emailConfig(env,new URL('http://dog.nonarkara.org')),null,'Test keys cannot enable public HTTP');
 assert.equal(emailConfig({...env,CLERK_EMAIL_READY:'0'},new URL(origin)),null);assert.equal(emailConfig(env,new URL('https://dog.nonarkara.org')),null,'Test keys cannot enable production');assert(providersFor(new URL(origin),env).includes('email'));
 const before=fetches;assert.equal(await emailIdentity(request('/api/me','fake'),{DB:db},new URL(origin)),null);assert.equal(fetches,before,'Unconfigured email makes no Clerk requests');
 const token=await jwt();assert.equal(await emailIdentity(request('/api/me',token),env,new URL(origin)),'user_fixture');
 assert.equal(await emailIdentity(request('/api/me',token.slice(0,-12)+'bad'),env,new URL(origin)),null,'Forged signature rejected');
 assert.equal(await emailIdentity(request('/api/me',await jwt({exp:Math.floor(Date.now()/1000)-60})),env,new URL(origin)),null,'Expired token rejected');
 assert.equal(await emailIdentity(request('/api/me',await jwt({azp:'https://attacker.example'})),env,new URL(origin)),null,'Wrong originating party rejected');
 assert.equal(await emailIdentity(request('/api/me',await jwt({iss:'https://other.clerk.accounts.dev'})),env,new URL(origin)),null,'Wrong issuer rejected');
 sessionStatus='revoked';assert.equal(await emailIdentity(request('/api/me',token),env,new URL(origin)),null,'Revoked session rejected despite unexpired JWT');sessionStatus='active';
 const post=request('/api/auth/email/session',token,'POST');const result=await handleAccounts(post,env,new URL(post.url));assert.equal(result?.status,200);assert.equal(db.users.length,1);assert.equal(db.users[0].provider,'email');assert(result?.headers.get('set-cookie')?.includes('Max-Age=0'),'No long-lived cookie minted');
 db.sql.prepare('INSERT INTO dogs(user_id,name,dog_id,revision,backup,updated_at) VALUES(?,?,?,?,?,?)').run(String(db.users[0].id),'Private dog','expo-2021',1,'{}',Date.now());
 const cookieRequest=new Request(origin+'/api/me',{headers:{Cookie:`__clerk_db_jwt=fixture_browser; tdc_email=1; __session=${token}; __client_uat=${JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).iat}`,Origin:origin}});assert.equal((await currentUser(cookieRequest,env))?.id,db.users[0].id,'Managed cookie authenticates native same-origin requests');
 const meResponse=await handleAccounts(request('/api/me',token),env,new URL(origin+'/api/me'));
 assert.equal((await meResponse!.json() as {user:{id:string}}).user.id,db.users[0].id,'Stable account id distinguishes users with the same display name');
 const backupFor=(revision:number)=>({format:'tama-dog-chi-owned-v1',adoption:{dogId:'expo-2021',name:'Private dog',seed:'fixture-dog',at:1},save:{version:3,revision,dogs:[{id:'expo-2021'}],pets:{'expo-2021':{needs:{hunger:40,energy:70,hygiene:80},updatedAt:1,trust:50,arousal:20,behaviours:{},personality:{boldness:0,sociability:0,foodDrive:0,playDrive:0,sensitivity:0},growth:{seed:'fixture-dog',adoptedAt:1,careDays:[],day:'2026-11-03',daySeconds:0}}}}});
 const saveDog=async(revision:number,backup:unknown=backupFor(revision),expectedAccountId?:string)=>{const req=new Request(origin+'/api/dog',{method:'PUT',headers:{Authorization:'Bearer '+token,'X-TDC':'1',Origin:origin},body:JSON.stringify({revision,backup,expectedAccountId})});return handleAccounts(req,env,new URL(req.url));};
 db.beforeDogWrite=()=>{db.sql.prepare('UPDATE dogs SET revision=21, backup=? WHERE user_id=?').run('newer-device',String(db.users[0].id));};
 assert.equal((await saveDog(20))?.status,409,'An interleaved newer device save wins atomically');
 assert.deepEqual(db.sql.prepare('SELECT revision,backup FROM dogs').get(),Object.assign(Object.create(null),{revision:21,backup:'newer-device'}),'Rejected older write preserves the newer dog bytes');
 assert.equal((await saveDog(21))?.status,200,'Equal revisions retain existing compatibility');
 assert.equal((await saveDog(22))?.status,200,'Newer revision can save normally');
 assert.equal((await saveDog(19))?.status,409,'Older sequential revision cannot overwrite');
 const beforeInvalid=db.sql.prepare('SELECT backup FROM dogs').get()!.backup;
 const oversized=backupFor(23);(oversized as unknown as Record<string,unknown>).note='犬'.repeat(340_000);
 assert.equal((await saveDog(23,oversized))?.status,413,'UTF-8 byte limit rejects multibyte payload below one million characters');
 assert.equal((await saveDog(23,backupFor(23),'different-account'))?.status,409,'A stale tab cannot upload into a newly signed-in account');
 assert.equal(db.sql.prepare('SELECT backup FROM dogs').get()!.backup,beforeInvalid,'Account mismatch preserves dog bytes');
 const mismatched=backupFor(23);mismatched.save.revision=22;
 const missingPet=backupFor(23);delete (missingPet.save.pets as Record<string,unknown>)['expo-2021'];
 const mismatchedIdentity=backupFor(23);mismatchedIdentity.save.pets['expo-2021'].growth.seed='other-dog';
 const invalidNeed=backupFor(23);invalidNeed.save.pets['expo-2021'].needs.energy=Infinity;
 const missingPersonality=backupFor(23);delete (missingPersonality.save.pets['expo-2021'] as Record<string,unknown>).personality;
 for(const invalid of [{format:'tama-dog-chi-owned-v1',adoption:{dogId:'expo-2021'}},mismatched,missingPet,mismatchedIdentity,invalidNeed,missingPersonality])assert.equal((await saveDog(23,invalid))?.status,400,'Unrestorable backup cannot replace a valid dog');
 assert.equal(db.sql.prepare('SELECT backup FROM dogs').get()!.backup,beforeInvalid,'Rejected malformed backups preserve saved dog bytes');
 const exported=await handleAccounts(request('/api/export',token),env,new URL(origin+'/api/export'));assert.equal(exported?.status,200);assert.equal((await exported!.json() as {account:{provider:string}}).account.provider,'email');
 assert.equal((await currentUser(request('/api/me',token),env))?.id,db.users[0].id);assert.equal(await currentUser(request('/api/me','bad','GET',{Cookie:'tdc_session=another-account'}),env),null,'Invalid explicit bearer never falls back to another account cookie');
 const blocked=request('/api/auth/email/session',token,'POST',{Origin:'https://attacker.example'});assert.equal((await handleAccounts(blocked,env,new URL(blocked.url)))?.status,403);
 emailVerified=false;assert.equal((await handleAccounts(post,env,new URL(post.url)))?.status,401);emailVerified=true;
 db.race=true;assert.equal((await handleAccounts(post,env,new URL(post.url)))?.status,410,'Concurrent deletion blocks registration atomically');assert.equal(db.users.length,0);db.race=false;db.queue.clear();await handleAccounts(post,env,new URL(post.url));
 const logout=new Request(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookieRequest.headers.get('Cookie')!,Origin:origin,'X-TDC':'1'}});assert.equal((await handleAccounts(logout,env,new URL(logout.url)))?.status,200);assert.equal(await emailIdentity(request('/api/me',token),env,new URL(origin)),null,'Server logout revokes managed session');sessionStatus='active';
 const deletion=request('/api/account',token,'DELETE');db.failBatch=true;assert.equal((await handleAccounts(deletion,env,new URL(deletion.url)))?.status,503);assert.equal(removed,false,'D1 failure cannot orphan an already-deleted identity');assert.equal(db.users.length,1);db.failBatch=false;
 deletionFails=true;assert.equal((await handleAccounts(deletion,env,new URL(deletion.url)))?.status,202);assert.equal(db.users.length,0);assert(db.queue.has('user_fixture'),'Managed deletion remains durably retryable');assert.equal((await handleAccounts(post,env,new URL(post.url)))?.status,410,'Pending deletion cannot re-create its account');deletionFails=false;await drainEmailDeletions(env);assert(removed);assert(db.completed.has('user_fixture'),'Completed deletion marker survives in-flight registration');

 console.log('PASS email feature gate, real RSA signatures, expiry/issuer/origin, revocation, verified identity mapping, CSRF, export-compatible auth and deletion');
}finally{globalThis.fetch=originalFetch;}
