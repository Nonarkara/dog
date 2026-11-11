import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import type {AccountEnv,D1,D1Statement} from '../worker/accounts';
import {snapshotOf} from '../src/domain/careSnapshot';
import type {PetState} from '../src/domain/types';
import {arriveAtPark} from '../src/utils/careLog';
import type {DogProfile} from '../src/types/dog';

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
const {handleCare}=await import('../worker/care');
const {default:worker}=await import('../worker/index');
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
 assert(providersFor(new URL(origin),{DB:db,DEV_AUTH:'1'}).includes('dev'),'Loopback development retains test sign-in');
 const publicDev=new Request('http://dog.nonarkara.org/api/auth/dev/start');
 assert.equal((await handleAccounts(publicDev,{DB:db,DEV_AUTH:'1'},new URL(publicDev.url)))?.status,404,'An accidental flag cannot expose dev sign-in over public HTTP');
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
 const saveDog=async(revision:number,backup:unknown=backupFor(revision),expectedAccountId?:string,baseRevision?:number|null)=>{const req=new Request(origin+'/api/dog',{method:'PUT',headers:{Authorization:'Bearer '+token,'X-TDC':'1',Origin:origin},body:JSON.stringify({revision,backup,expectedAccountId,baseRevision})});return handleAccounts(req,env,new URL(req.url));};
 db.sql.exec('DELETE FROM dogs');
 assert.equal((await saveDog(2,backupFor(2),undefined,1))?.status,409,'A missing cloud row is not recreated against an old acknowledged base');
 assert.equal((await saveDog(1))?.status,200,'An old client may create an initial cloud dog');
 db.sql.exec('UPDATE dogs SET updated_at=1');
 assert.equal((await saveDog(1))?.status,200,'Exact-byte legacy retries remain idempotent');
 assert.equal(db.sql.prepare('SELECT updated_at FROM dogs').get()?.updated_at,1,'Exact retries do not move the save timestamp');
 assert.equal((await saveDog(2))?.status,409,'An old client without a base must reload before changing an existing cloud dog');
 db.beforeDogWrite=()=>{db.sql.prepare('UPDATE dogs SET revision=21, backup=? WHERE user_id=?').run('newer-device',String(db.users[0].id));};
 assert.equal((await saveDog(20))?.status,409,'An interleaved newer device save wins atomically');
 assert.deepEqual(db.sql.prepare('SELECT revision,backup FROM dogs').get(),Object.assign(Object.create(null),{revision:21,backup:'newer-device'}),'Rejected older write preserves the newer dog bytes');
 assert.equal((await saveDog(21))?.status,409,'Old clients cannot overwrite different bytes at an equal revision');
 assert.equal((await saveDog(22))?.status,409,'Old clients cannot overwrite with a higher local counter either');
 assert.equal((await saveDog(21,backupFor(21),undefined,21))?.status,409,'Different bytes cannot retain the same acknowledged revision');
 assert.equal((await saveDog(22,backupFor(22),undefined,21))?.status,200,'Newer revision with a known server base can save normally');
 assert.equal((await saveDog(22))?.status,200,'An identical legacy retry remains safe');
 assert.equal((await saveDog(19))?.status,409,'Older sequential revision cannot overwrite');
 const deviceA=backupFor(23),deviceB=backupFor(23);deviceA.adoption.name='Device A dog';deviceB.adoption.name='Device B dog';
 assert.equal((await saveDog(23,deviceA,undefined,22))?.status,200,'First device advances its known server base');
 assert.equal((await saveDog(23,deviceB,undefined,22))?.status,409,'Divergent equal local revisions from the same base must not overwrite');
 assert.equal(db.sql.prepare('SELECT backup FROM dogs').get()!.backup,JSON.stringify(deviceA),'Conflicting same-revision save preserves first device bytes');
 assert.equal((await saveDog(23,deviceA,undefined,22))?.status,200,'Exact-byte retries are idempotent even when their base is now old');
 assert.equal((await saveDog(24,backupFor(24),undefined,null))?.status,409,'Empty-account base cannot overwrite an existing companion');
 assert.equal((await saveDog(24,backupFor(24),undefined,23))?.status,200,'Freshly reconciled device can advance');
 assert.equal((await saveDog(25,backupFor(25),undefined,-1))?.status,400,'Invalid base revision is rejected');
 const beforeInvalid=db.sql.prepare('SELECT backup FROM dogs').get()!.backup;
 const nullSave=new Request(origin+'/api/dog',{method:'PUT',headers:{Authorization:'Bearer '+token,'X-TDC':'1',Origin:origin},body:'null'});
 assert.equal((await handleAccounts(nullSave,env,new URL(nullSave.url)))?.status,400,'A null JSON body cannot crash the save route');
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
 const care=(path:string,body?:string)=>handleCare(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'X-TDC':'1',Origin:origin},body}),env,new URL(origin+path));
 const snapshot=snapshotOf({needs:{hunger:72,energy:60,hygiene:80},trust:85,arousal:25,sleep:{asleep:false}} as PetState);
 assert.deepEqual(snapshot,{version:2,fullness:72,energy:60,hygiene:80,trust:85,arousal:25,sick:false,asleep:false},'Fullness agrees with the Care meter, and arousal keeps its own label');
 const arrive=(data:unknown)=>care('/api/visit',JSON.stringify({dogId:'expo-2021',dogName:'Expo',snapshot:data}));
 assert.equal((await arrive(snapshot))?.status,403,'Never record before explicit consent');
 assert.equal((await care('/api/visit/consent','{"agree":true}'))?.status,200);
 assert.equal((await arrive({...snapshot,privatePhone:'not a ledger field',contact:{name:'not a ledger field'}}))?.status,200);
 const stored=()=>db.sql.prepare('SELECT snapshot,left_at FROM park_visits ORDER BY id DESC LIMIT 1').get();
 assert.deepEqual(JSON.parse(String(stored()?.snapshot)),snapshot,'Extra keys never reach the ledger');
 for(const body of ['null','{}','{"agree":"false"}','not JSON'])assert.equal((await care('/api/visit/consent',body))?.status,400,'Malformed consent cannot delete a visit');
 assert.equal(stored()?.left_at,null);
 assert.equal((await arrive({...snapshot,fullness:-1}))?.status,400);
 assert.equal((await arrive({...snapshot,sick:'false'}))?.status,400);
 assert.equal((await care('/api/visit/leave','{}'))?.status,400,'Bad departure cannot erase a valid snapshot');
 assert.equal(stored()?.left_at,null);
 const {arousal,...legacy}=snapshot;
 assert.equal((await care('/api/visit/leave',JSON.stringify({snapshot:{...legacy,fullness:28,version:undefined,calm:arousal,homeAddress:'not a ledger field'}})))?.status,200);
 assert.deepEqual(JSON.parse(String(stored()?.snapshot)),legacy,'An older tab preserves correct fullness and omits the ambiguous old calm field');
 const historical=JSON.stringify({fullness:28,calm:25,privateAddress:'not a ledger field'});
 db.sql.prepare('UPDATE park_visits SET snapshot=?').run(historical);
 const summary=await care('/api/care/summary');
 assert.equal(summary?.headers.get('Cache-Control'),'no-store');
 const visits=(await summary!.json()).visits;
 assert.equal(visits.length,1);
 assert.deepEqual(JSON.parse(visits[0].snapshot),{version:2,fullness:72},'Historical summaries correct fullness and suppress ambiguous or private legacy keys');
 const exported=await handleAccounts(request('/api/export',token),env,new URL(origin+'/api/export'));assert.equal(exported?.status,200);
 const exportData=await exported!.json() as {account:{provider:string};parkVisits:{snapshot:string}[]};
 assert.equal(exportData.account.provider,'email');assert.equal(exportData.parkVisits.length,1);
 assert.equal(exportData.parkVisits[0].snapshot,historical,'The owner can inspect the exact original data kept about them');
 assert.equal((await care('/api/visit/consent','{"agree":false}'))?.status,200);
 assert.equal(stored(),undefined,'Explicit decline deletes the ledger');

 const grant=await care('/api/visit/consent','{"agree":true}');
 const permission=await grant!.json();
 assert.equal((await (await care('/api/visit/consent','{"agree":true}'))!.json()).consentAt,permission.consentAt,'Retrying a grant preserves its consent epoch');
 const tabA={...permission,visitKey:crypto.randomUUID()},tabB={...permission,visitKey:crypto.randomUUID()};
 const visit=(tab:typeof tabA)=>care('/api/visit',JSON.stringify({dogId:'expo-2021',dogName:'Expo',snapshot,...tab}));
 const leave=(tab:typeof tabA)=>care('/api/visit/leave',JSON.stringify({snapshot,...tab}));
 const visitRow=(key:string)=>db.sql.prepare('SELECT left_at,snapshot FROM park_visits WHERE visit_key=?').get(key);
 assert.equal((await visit(tabA))?.status,200);
 assert.equal((await visit(tabB))?.status,200);
 assert.equal((await visit(tabA))?.status,200,'Duplicate arrival is acknowledged without adding a row');
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM park_visits').get()?.n,2);
 await arrive(snapshot);
 assert.equal((await care('/api/visit/leave',JSON.stringify({snapshot})))?.status,200);
 assert.equal(visitRow(tabA.visitKey)?.left_at,null,'An older tab can neither close nor replace a keyed visit');
 assert.equal(visitRow(tabB.visitKey)?.left_at,null);
 assert.equal((await (await leave(tabA))!.json()).closed,1);
 assert.equal((await (await leave(tabA))!.json()).closed,0,'Reordered duplicate departure has no further effects');
 assert.equal(visitRow(tabB.visitKey)?.left_at,null,'Tab A cannot close the newer tab B visit');
 assert.equal((await visit(tabA))?.status,200);
 assert.notEqual(visitRow(tabA.visitKey)?.left_at,null,'A delayed arrival retry cannot reopen a finished visit');

 const switched=await handleAccounts(new Request(origin+'/api/auth/dev/start?name=Second%20owner'),{...env,DEV_AUTH:'1'},new URL(origin+'/api/auth/dev/start?name=Second%20owner'));
 const cookie=switched!.headers.get('Set-Cookie')!.split(';',1)[0];
 const otherOwner=db.users.find(user=>user.provider==='dev')!;
 const otherCare=(path:string,body:unknown)=>handleCare(new Request(origin+path,{method:'POST',headers:{Cookie:cookie,'X-TDC':'1',Origin:origin},body:JSON.stringify(body)}),env,new URL(origin+path));
 assert.equal((await otherCare('/api/visit/consent',{agree:false,accountId:tabB.accountId}))?.status,409,'Consent cannot change for a stale account binding');
 assert.equal((await otherCare('/api/visit',{...tabB,dogId:'expo-2021',snapshot}))?.status,409,'A stale tab cannot log for the newly signed-in account');
 assert.equal((await (await otherCare('/api/visit/leave',{...tabB,accountId:otherOwner.id,snapshot}))!.json()).closed,0,'A different owner cannot close a known visit key');
 assert.equal(visitRow(tabB.visitKey)?.left_at,null);
 db.sql.prepare('DELETE FROM users WHERE id=?').run(String(otherOwner.id));
 assert.equal((await care('/api/visit/consent','{"agree":false}'))?.status,200);
 assert.equal(visitRow(tabB.visitKey),undefined,'Revoking consent erases keyed visits as well');
 assert.equal((await visit(tabB))?.status,403,'A pending arrival cannot resurrect a deleted visit');
 db.sql.prepare('UPDATE users SET visit_consent_at=?').run(permission.consentAt+1);
 assert.equal((await visit(tabB))?.status,403,'Regranting consent does not authorize arrivals from the earlier consent');

 const nativeCareFetch=globalThis.fetch;
 const calls:{path:string;data:Record<string,unknown>}[]=[];
 let releaseArrival:()=>void;
 try{
  globalThis.fetch=async(input,init)=>{
   const path=String(input);
   calls.push({path,data:JSON.parse(String(init?.body))});
   if(path==='/api/visit')await new Promise<void>(resolve=>{releaseArrival=resolve;});
   return Response.json({ok:true});
  };
  const pet={needs:{hunger:72,energy:60,hygiene:80},trust:85,arousal:25,sleep:{asleep:false}} as PetState;
  const close=arriveAtPark({id:'expo-2021',name:'Expo'} as DogProfile,pet,'commons',permission);
  close({...pet,trust:90});
  assert.deepEqual(calls.map(call=>call.path),['/api/visit'],'A fast departure waits for its arrival');
  releaseArrival!();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(calls.map(call=>call.path),['/api/visit','/api/visit/leave']);
  assert.equal(calls[0].data.visitKey,calls[1].data.visitKey);
  assert.equal((calls[1].data.snapshot as {trust:number}).trust,90);
 }finally{globalThis.fetch=nativeCareFetch;}

 const workerEnv={DB:db,ASSETS:{fetch:async()=>new Response(null,{status:404})},PARK_ROOM:{idFromName(){throw new Error('Invalid room must not allocate an object');},get(){throw new Error('Unexpected object');}}};
 assert.equal((await worker.fetch(new Request(origin+'/api/park/%'),workerEnv)).status,404,'Malformed escape cannot crash park routing');
 db.sql.prepare('INSERT INTO park_visits(user_id,dog_id,dog_name,room,arrived_at,snapshot) VALUES(?,?,?,?,?,?)')
  .run(String(db.users[0].id),'expo-2021','Expo','commons',Date.now()-31*86_400_000,'{}');
 const brokenPush={...workerEnv,DB:{batch:db.batch.bind(db),prepare(sql:string){if(sql.startsWith('DELETE FROM push_subs'))throw new Error('fixture push failure');return db.prepare(sql);}}};
 await assert.rejects(worker.scheduled(null,brokenPush),AggregateError,'A failed job remains visible to the scheduler');
 assert.equal(stored(),undefined,'A push failure cannot postpone park retention');
 assert.equal((await currentUser(request('/api/me',token),env))?.id,db.users[0].id);assert.equal(await currentUser(request('/api/me','bad','GET',{Cookie:'tdc_session=another-account'}),env),null,'Invalid explicit bearer never falls back to another account cookie');
 const blocked=request('/api/auth/email/session',token,'POST',{Origin:'https://attacker.example'});assert.equal((await handleAccounts(blocked,env,new URL(blocked.url)))?.status,403);
 emailVerified=false;assert.equal((await handleAccounts(post,env,new URL(post.url)))?.status,401);emailVerified=true;
 db.race=true;assert.equal((await handleAccounts(post,env,new URL(post.url)))?.status,410,'Concurrent deletion blocks registration atomically');assert.equal(db.users.length,0);db.race=false;db.queue.clear();await handleAccounts(post,env,new URL(post.url));
 const logout=new Request(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookieRequest.headers.get('Cookie')!,Origin:origin,'X-TDC':'1'}});assert.equal((await handleAccounts(logout,env,new URL(logout.url)))?.status,200);assert.equal(await emailIdentity(request('/api/me',token),env,new URL(origin)),null,'Server logout revokes managed session');sessionStatus='active';
 const deletion=request('/api/account',token,'DELETE');db.failBatch=true;assert.equal((await handleAccounts(deletion,env,new URL(deletion.url)))?.status,503);assert.equal(removed,false,'D1 failure cannot orphan an already-deleted identity');assert.equal(db.users.length,1);db.failBatch=false;
 deletionFails=true;assert.equal((await handleAccounts(deletion,env,new URL(deletion.url)))?.status,202);assert.equal(db.users.length,0);assert(db.queue.has('user_fixture'),'Managed deletion remains durably retryable');assert.equal((await handleAccounts(post,env,new URL(post.url)))?.status,410,'Pending deletion cannot re-create its account');deletionFails=false;await drainEmailDeletions(env);assert(removed);assert(db.completed.has('user_fixture'),'Completed deletion marker survives in-flight registration');

 console.log('PASS email feature gate, RSA/claims/revocation, save concurrency, byte limits, consent/snapshot privacy, per-tab visit ordering and ownership, export and deletion');
}finally{globalThis.fetch=originalFetch;}
