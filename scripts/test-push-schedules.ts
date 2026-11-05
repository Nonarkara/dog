/** Real SQLite and the production sender; no notification leaves this process.
 * Run: esbuild scripts/test-push-schedules.ts --bundle --platform=node
 * --format=esm --outfile=node_modules/.cache/push-tests.mjs && node
 * node_modules/.cache/push-tests.mjs
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handlePush,sendDuePushes,type PushEnv} from '../worker/push';

const originalNow=Date.now,originalFetch=globalThis.fetch;
let now=Date.parse('2026-11-05T05:00:00Z'),deliveries=0;
Date.now=()=>now;
const endpoint='https://fcm.googleapis.com/fixture/abcdefghijklmnopqrstuvwxyz123456789';
const url=new URL('https://dog.example/api/push');
const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const sql=new DatabaseSync(':memory:');
// This deliberately needs no repeat-notification migration.
sql.exec(readFileSync('migrations/0002_push.sql','utf8'));
const env:PushEnv={VAPID_PUBLIC:'fixture',VAPID_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',key.privateKey)),DB:{prepare(query){let values:unknown[]=[];return{
  bind(...v){values=v;return this;},
  async run(){return sql.prepare(query).run(...values as never[]);},
  async first<T>(){return(sql.prepare(query).get(...values as never[])??null)as T|null;},
  async all<T>(){return{results:sql.prepare(query).all(...values as never[])as T[]};},
};}}};
const row=()=>sql.prepare('SELECT due_at,updated_at FROM push_subs WHERE endpoint=?').get(endpoint)as{due_at:number;updated_at:number}|undefined;
async function schedule(at:number|null){now++;const res=await handlePush(new Request(url,{method:'POST',body:JSON.stringify({endpoint,at})}),env,url);assert.equal(res?.status,200);}
function due(){sql.prepare('INSERT INTO push_subs VALUES (?,?,?) ON CONFLICT(endpoint) DO UPDATE SET due_at=excluded.due_at,updated_at=excluded.updated_at').run(endpoint,now-1,now);}
let duringSend:(()=>Promise<void>)|undefined,status=201,fail=false;
globalThis.fetch=async()=>{deliveries++;await duringSend?.();if(fail)throw new Error('Fixture offline');return new Response(null,{status});};

try{
  due();assert.equal(await sendDuePushes(env),1);assert.equal(row()?.due_at,0,'A delivered call is consumed once');
  const once=deliveries;await sendDuePushes(env);assert.equal(deliveries,once,'No repeated notification for the same absence');

  due();const next=now+3_600_000;
  duringSend=()=>schedule(next);
  await sendDuePushes(env);assert.equal(row()?.due_at,next,'Provider reply must not consume a newer absence');

  due();duringSend=()=>schedule(0);
  await sendDuePushes(env);assert.equal(row()?.due_at,0,'Returning keeps the pending call cleared');

  due();duringSend=()=>schedule(null);
  await sendDuePushes(env);assert.equal(row(),undefined,'Disabling is not undone by the reply');

  for(const gone of [404,410]){
    due();status=gone;duringSend=async()=>{await schedule(null);await schedule(next);};
    await sendDuePushes(env);assert.equal(row()?.due_at,next,'An old gone response cannot delete a re-enabled subscription');
    due();duringSend=undefined;await sendDuePushes(env);assert.equal(row(),undefined,'A genuinely gone subscription is removed');
  }
  status=201;
  for(const transient of [429,503]){
    due();status=transient;const pending=row()?.due_at;
    await sendDuePushes(env);assert.equal(row()?.due_at,pending,'Transient failures remain eligible for the next run');
  }
  due();fail=true;const pending=row()?.due_at;
  await sendDuePushes(env);assert.equal(row()?.due_at,pending,'Network failure does not lose the call');
  console.log('PASS push one-shot, return/disable, newer absence, gone/re-enable races, and transient retry on real SQLite');
}finally{Date.now=originalNow;globalThis.fetch=originalFetch;sql.close();}
