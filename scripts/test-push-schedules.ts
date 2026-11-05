/** Production push worker + real SQLite; all push providers are local fixtures.
 * npm run test:push (no real phone, account, secret or notification required).
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handlePush,sendDuePushes,type PushEnv} from '../worker/push';

const originalNow=Date.now,originalFetch=globalThis.fetch;
const HOUR=3_600_000,MINUTE=60_000;
let now=Date.parse('2026-11-05T05:00:00Z'),requests=0,deliveries:{at:number;ttl:number}[]=[];
Date.now=()=>now;
const endpoint='https://fcm.googleapis.com/fixture/abcdefghijklmnopqrstuvwxyz123456789';
const url=new URL('https://dog.example/api/push');
const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync('migrations/0002_push.sql','utf8'));
// Migrate an existing subscription, not just an empty new database.
sql.prepare('INSERT INTO push_subs VALUES (?,?,?)').run(endpoint,now,now);
sql.exec(readFileSync('migrations/0006_push_windows.sql','utf8'));
type Row={due_at:number;updated_at:number;expires_at:number;followup_at:number;followup_expires_at:number;client_revision:number};
const row=()=>sql.prepare('SELECT due_at,updated_at,expires_at,followup_at,followup_expires_at,client_revision FROM push_subs WHERE endpoint=?').get(endpoint)as Row|undefined;
const endpointHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint))),byte=>byte.toString(16).padStart(2,'0')).join('');
const revoked=()=>sql.prepare('SELECT * FROM push_revocations WHERE endpoint_hash=?').get(endpointHash)as{endpoint_hash:string;client_revision:number;updated_at:number}|undefined;
assert.deepEqual({...row()},{due_at:now,updated_at:now,expires_at:0,followup_at:0,followup_expires_at:0,client_revision:0},'Migration preserves old schedules as legacy one-shot');
let beforeRun:((query:string)=>Promise<void>)|undefined,afterRun:((query:string)=>Promise<void>)|undefined,dbCalls=0;
const env:PushEnv={VAPID_PUBLIC:'fixture',VAPID_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',key.privateKey)),DB:{prepare(query){let values:unknown[]=[];return{
 bind(...v){values=v;return this;},
 async run(){dbCalls++;await beforeRun?.(query);const result=sql.prepare(query).run(...values as never[]);await afterRun?.(query);return result;},
 async first<T>(){dbCalls++;return(sql.prepare(query).get(...values as never[])??null)as T|null;},
 async all<T>(){dbCalls++;return{results:sql.prepare(query).all(...values as never[])as T[]};},
};}}};
let duringSend:(()=>Promise<void>)|undefined,status=201,offline=false;
globalThis.fetch=async(_input,options)=>{deliveries.push({at:now,ttl:Number(new Headers(options?.headers).get('TTL'))});await duringSend?.();if(offline)throw new Error('Fixture offline');return new Response(null,{status});};
async function post(fields:Record<string,unknown>,expected=200){const res=await handlePush(new Request(url,{method:'POST',headers:{'cf-connecting-ip':'fixture-'+(++requests)},body:JSON.stringify({endpoint,...fields})}),env,url);assert.equal(res?.status,expected,JSON.stringify(fields));return res;}
async function schedule(at:number|null,extra:Record<string,unknown>={}){await post({at,...extra});}
function reset(time='2026-11-05T05:00:00Z'){now=Date.parse(time);sql.exec('DELETE FROM push_subs; DELETE FROM push_revocations');deliveries=[];duringSend=undefined;beforeRun=undefined;afterRun=undefined;status=201;offline=false;}
const cleared=(revision=0)=>assert.deepEqual({...row(),updated_at:0},{due_at:0,updated_at:0,expires_at:0,followup_at:0,followup_expires_at:0,client_revision:revision},'All delivery windows clear while the revision fence remains');
async function noDelivery(message:string){const count=deliveries.length;assert.equal(await sendDuePushes(env),0,message);assert.equal(deliveries.length,count,message);}
const pair=()=>({at:now,until:now+4*HOUR,followupAt:now+90*MINUTE,followupUntil:now+4*HOUR});
try{
 // Legacy clients omit every optional field and still receive exactly one call.
 assert.equal(await sendDuePushes(env),1);cleared();await noDelivery('Legacy schedules do not repeat');
 reset();await schedule(now,{until:now+HOUR});assert.equal(await sendDuePushes(env),1);cleared();await noDelivery('A current one-shot does not repeat');
 reset();await post(pair());assert.equal(await sendDuePushes(env),1);assert.equal(row()?.due_at,now+90*MINUTE);assert.equal(row()?.followup_at,0);assert.equal(row()?.followup_expires_at,0,'Promotion consumes the only follow-up');
 await noDelivery('Follow-up cannot arrive early');now+=90*MINUTE;assert.equal(await sendDuePushes(env),1);cleared();now+=HOUR;await noDelivery('There is no third reminder');assert.equal(deliveries.length,2);
 reset();await schedule(now,{until:now+HOUR,followupAt:0,followupUntil:0});assert.equal(await sendDuePushes(env),1);cleared();

 // Cron backlogs discard missed windows. An opted-in follow-up is promoted
 // once and considered on the next run, rather than replaying both calls.
 reset();const missed=pair();missed.until=now+15*MINUTE;await post(missed);now+=HOUR;
 await noDelivery('An expired first window cannot ring');assert.equal(row()?.due_at,missed.followupAt);assert.equal(row()?.expires_at,missed.followupUntil);assert.equal(row()?.followup_at,0);
 now=missed.followupAt;assert.equal(await sendDuePushes(env),1);cleared();
 reset();const allMissed=pair();await post(allMissed);now=allMissed.followupUntil;await noDelivery('All missed windows clear without sending');cleared();
 reset();const delayed=pair();await post(delayed);duringSend=async()=>{now+=2*HOUR;};assert.equal(await sendDuePushes(env),1);assert.equal(row()?.due_at,now+90*MINUTE,'Delay keeps ninety minutes between actual accepted calls');
 reset();const noRoom=pair();noRoom.followupUntil=now+2*HOUR;await post(noRoom);duringSend=async()=>{now+=HOUR;};assert.equal(await sendDuePushes(env),1);cleared();

 // TTL is bounded by the window, including the final partial minute. Thus
 // provider-side queues cannot keep a daytime request for the whole night.
 reset();await schedule(now,{until:now+60_800});await sendDuePushes(env);assert.equal(deliveries[0].ttl,60);
 reset();await schedule(now,{until:now+10*HOUR});await sendDuePushes(env);assert.equal(deliveries[0].ttl,3600);
 reset();await schedule(now,{until:now+999});await noDelivery('Less than one second remaining is discarded');cleared();
 for(const code of[429,503]){reset();await schedule(now,{until:now+15*MINUTE});status=code;assert.equal(await sendDuePushes(env),0);assert.equal(row()?.due_at,now);now+=15*MINUTE;await noDelivery('Expired transient retries are discarded');cleared();}
 reset();await schedule(now,{until:now+MINUTE});offline=true;assert.equal(await sendDuePushes(env),0);assert.equal(row()?.due_at,now);now+=MINUTE;await noDelivery('Expired network retries cannot ring');cleared();

 // Original clients explicitly used Bangkok hours. Old rows are restricted
 // to the daylight window of their original due day, never a later morning.
 reset('2026-11-05T14:45:00Z');await schedule(Date.parse('2026-11-05T14:30:00Z'));assert.equal(await sendDuePushes(env),1);assert.equal(deliveries[0].ttl,900);
 reset('2026-11-05T15:30:00Z');await schedule(Date.parse('2026-11-05T14:00:00Z'));await noDelivery('An old delayed row cannot ring after 22:00 Bangkok');cleared();
 reset();await schedule(now-24*HOUR);await noDelivery('Yesterday’s legacy schedule is not replayed');cleared();
 reset('2026-11-05T23:30:00Z');await schedule(now);await noDelivery('Legacy quiet-hour due time is never sent');cleared();

 // Return/disable, re-enable, and a new schedule all win over an old reply.
 reset();await post(pair());const next=now+HOUR;duringSend=()=>schedule(next,{until:next+HOUR});await sendDuePushes(env);assert.equal(row()?.due_at,next,'An old reply cannot consume a newer absence');
 reset();const prior=pair();await post(prior);const changed={...prior,until:prior.until+HOUR,followupAt:prior.followupAt+MINUTE};duringSend=()=>post(changed);await sendDuePushes(env);assert.equal(row()?.expires_at,changed.until);assert.equal(row()?.followup_at,changed.followupAt,'CAS covers every window field even at an equal updated_at');
 reset();await post(pair());duringSend=()=>schedule(0);await sendDuePushes(env);cleared();
 reset();await post(pair());duringSend=()=>schedule(null);await sendDuePushes(env);assert.equal(row(),undefined);
 for(const gone of[404,410]){
  reset();await post({...pair(),revision:1});status=gone;const reenabled={at:now+HOUR,until:now+2*HOUR,revision:3};duringSend=async()=>{await schedule(null,{revision:2});await post(reenabled);};await sendDuePushes(env);assert.equal(row()?.due_at,reenabled.at,'An old gone response cannot delete a re-enabled subscription');
  duringSend=undefined;now=reenabled.at;await sendDuePushes(env);assert.equal(row(),undefined,'A genuinely gone subscription is removed');
 }
 reset();await post(pair());status=403;await sendDuePushes(env);cleared();

 // A late hidden-tab POST is still old intent, even when it arrives after
 // the return clear. Equal revisions are retries only for identical bytes.
 reset();const armed={...pair(),revision:100};await post(armed);
 const armedRow=row();now++;await post(armed);assert.deepEqual(row(),armedRow,'An equal-revision exact retry is idempotent and does not alter updated_at');
 const conflicting=await post({...armed,followupAt:armed.followupAt+MINUTE},409);assert.deepEqual(await conflicting?.json(),{error:'Stale schedule',revision:100});assert.deepEqual(row(),armedRow);
 await schedule(0,{revision:102});cleared(102);
 const lateHidden=await post({...armed,revision:101},409);assert.deepEqual(await lateHidden?.json(),{error:'Stale schedule',revision:102});cleared(102);
 await post({at:now},409);cleared(102);await post({at:0},409);cleared(102);
 await post({at:null},409);cleared(102);
 await schedule(0,{revision:102});cleared(102); // repeated clear is safe
 await post({...pair(),revision:103});assert.equal(row()?.client_revision,103);
 await schedule(null,{revision:104});assert.equal(row(),undefined);
 assert.equal(revoked()?.client_revision,104);assert(/^[a-f0-9]{64}$/.test(revoked()!.endpoint_hash),'Revocation stores only an irreversible address digest');
 assert(!JSON.stringify(revoked()).includes(endpoint),'Raw subscription URL is not retained in its revocation fence');
 const delayedAfterDisable=await post({...pair(),revision:103},409);assert.deepEqual(await delayedAfterDisable?.json(),{error:'Stale schedule',revision:104});assert.equal(row(),undefined,'A delayed request cannot resurrect the deleted raw address');
 await post({at:now},409);assert.equal(row(),undefined,'Legacy arming cannot bypass a revocation fence');
 await schedule(null,{revision:104});assert.equal(row(),undefined,'An exact delete retry is idempotent');
 await post({...pair(),revision:105});assert.equal(row()?.client_revision,105,'An explicit newer enable can reuse the address');assert.equal(revoked()?.client_revision,104,'Re-enabling does not discard the ordering fence');
 await post({at:null,revision:105},409);assert.equal(row()?.client_revision,105,'Equal revision cannot change schedule intent into delete');assert.equal(revoked()?.client_revision,104);
 reset();await post({...pair(),revision:100});
 // Pause an old arming request immediately before its SQL executes. Disable
 // happens during that pause: the INSERT predicate must see its digest fence.
 beforeRun=async query=>{if(!query.startsWith('INSERT INTO push_subs'))return;beforeRun=undefined;await schedule(null,{revision:102});};
 await post({...pair(),revision:101},409);assert.equal(row(),undefined);assert.equal(revoked()?.client_revision,102);
 reset();await post({...pair(),revision:100});
 // A newer enable between fence insertion and raw-address deletion survives.
 afterRun=async query=>{if(!query.startsWith('INSERT INTO push_revocations'))return;afterRun=undefined;await post({...pair(),revision:103});};
 const olderDisable=await post({at:null,revision:102},409);assert.deepEqual(await olderDisable?.json(),{error:'Stale schedule',revision:103});assert.equal(row()?.client_revision,103);assert.equal(revoked()?.client_revision,102);
 reset();await post({...pair(),revision:100});
 afterRun=async query=>{if(!query.startsWith('INSERT INTO push_revocations'))return;afterRun=undefined;await post({...pair(),revision:101},409);};
 await post({at:null,revision:102});assert.equal(row(),undefined,'An old arm in the middle of disable cannot restore the address');

 // Retention is bounded even for unauthenticated endpoint-capability callers.
 // A full table evicts an older digest, never failing a legitimate disable.
 reset();const insertDigest=sql.prepare('INSERT INTO push_revocations VALUES (?,?,?)');
 for(let i=0;i<5000;i++)insertDigest.run(i.toString(16).padStart(64,'0'),1,now-i-1000);
 await post({...pair(),revision:1});await schedule(null,{revision:2});assert.equal(row(),undefined);assert.equal(revoked()?.client_revision,2);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM push_revocations').get()!.n,5000);
 assert.equal(sql.prepare('SELECT 1 FROM push_revocations WHERE endpoint_hash=?').get((4999).toString(16).padStart(64,'0')),undefined,'The oldest other fence is evicted first');
 reset();await post({...pair(),revision:1});await schedule(null,{revision:2});now+=31*24*HOUR;
 await sendDuePushes({...env,VAPID_PUBLIC:undefined,VAPID_PRIVATE_JWK:undefined});assert.equal(revoked(),undefined,'Thirty-day digest cleanup does not depend on working push credentials');
 reset();const samePayload=pair();await post(samePayload);duringSend=()=>post({...samePayload,revision:1});await sendDuePushes(env);assert.equal(row()?.client_revision,1);assert.equal(row()?.due_at,samePayload.at,'A new revision survives an old provider response even when every timestamp is equal');
 reset();await post({...pair(),revision:2});await sendDuePushes(env);assert.equal(row()?.client_revision,2,'Server promotion retains the browser revision fence');now+=90*MINUTE;await sendDuePushes(env);cleared(2);await post({at:now},409);cleared(2);

 // D1's Free per-invocation query budget is shared with park/account cron jobs.
 // A backlog must drain in bounded batches, not consume all fifty queries.
 reset();const insertDue=sql.prepare('INSERT INTO push_subs (endpoint,due_at,updated_at,expires_at) VALUES (?,?,?,?)');
 for(let i=0;i<40;i++)insertDue.run(endpoint+'/'+i,now,now,now+HOUR);
 dbCalls=0;assert.equal(await sendDuePushes(env),32,'First cron takes a bounded batch');assert.equal(deliveries.length,32);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE due_at>0').get()!.n,8,'Eight calls remain for the next invocation');assert(dbCalls<=35,`Sender must reserve the rest of the D1 invocation budget, used ${dbCalls}`);
 dbCalls=0;assert.equal(await sendDuePushes(env),8,'The following invocation drains the remainder');assert.equal(deliveries.length,40);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE due_at>0').get()!.n,0);assert(dbCalls<=11);

 // Strict timestamps: no string/boolean/object coercion, incomplete pair or
 // overlong window can silently change what the player agreed to receive.
 reset();const initial=pair();await post(initial);const saved=row();
 const invalid:Record<string,unknown>[]=[{at:'123'},{at:true},{at:{}},{at:[]},{at:-1},{at:1.2},{at:now+48*HOUR+1},{},{at:now,until:null},{at:now,until:'1'},{at:now,until:{}},{at:now,until:now},{at:now,until:now+15*HOUR+1},{at:now,until:now+49*HOUR},{at:now,followupAt:now+2*HOUR,followupUntil:now+3*HOUR},{at:now,until:now+HOUR,followupAt:now+2*HOUR},{at:now,until:now+HOUR,followupUntil:now+3*HOUR},{at:now,until:now+HOUR,followupAt:0,followupUntil:now+3*HOUR},{at:now,until:now+HOUR,followupAt:'0',followupUntil:0},{at:now,until:now+HOUR,followupAt:now+89*MINUTE,followupUntil:now+3*HOUR},{at:now,until:now+HOUR,followupAt:now+2*HOUR,followupUntil:now+2*HOUR},{at:now,until:now+HOUR,followupAt:now+2*HOUR,followupUntil:now+18*HOUR},{at:now,until:now+HOUR,followupAt:now+47*HOUR,followupUntil:now+49*HOUR},{at:0,until:now+HOUR},{at:null,followupAt:1}];
 for(const body of invalid){await post(body,400);assert.deepEqual(row(),saved,'Rejected input cannot replace an armed schedule');}
 for(const revision of[0,-1,1.5,'1',true,{},null,Number.MAX_SAFE_INTEGER+1]){await post({...initial,revision},400);assert.deepEqual(row(),saved,'Bad revision cannot replace an armed schedule');}
 await schedule(0,{until:0,followupAt:0,followupUntil:0});cleared();await schedule(null);assert.equal(row(),undefined);
 console.log('PASS actual SQLite push windows: migration, one/two calls, quiet deadlines/TTL, missed windows, transient retries, revision ordering/idempotence, full-schedule CAS races, bounded cron queries, legacy hours, strict request validation');
}finally{Date.now=originalNow;globalThis.fetch=originalFetch;sql.close();}
