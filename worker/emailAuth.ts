import {createClerkClient} from '@clerk/backend';
import {clerkHost} from '../src/utils/emailConfig';

export interface EmailEnv {CLERK_PUBLISHABLE_KEY?:string;CLERK_SECRET_KEY?:string;CLERK_EMAIL_READY?:string;}
export function emailConfig(env:EmailEnv,url:URL){
 const key=env.CLERK_PUBLISHABLE_KEY??'',host=clerkHost(key);
 const local=url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(env.CLERK_EMAIL_READY!=='1'||!host||!env.CLERK_SECRET_KEY||(!local&&(url.protocol!=='https:'||!key.startsWith('pk_live_'))))return null;
 return {publishableKey:key,host};
}
function client(env:EmailEnv){return createClerkClient({publishableKey:env.CLERK_PUBLISHABLE_KEY!,secretKey:env.CLERK_SECRET_KEY!,telemetry:{disabled:true,debug:false,samplingRate:0}});}
/** Verify the signed token and its originating app before using a session id. */
async function verifiedSession(request:Request,env:EmailEnv,url:URL){
 const config=emailConfig(env,url);if(!config)return null;
 const clerk=client(env),state=await clerk.authenticateRequest(request,{authorizedParties:[url.origin],acceptsToken:'session_token'});
 if(!state.isSignedIn)return null;
 const auth=state.toAuth();
 if(!auth.userId||!auth.sessionId||auth.sessionClaims?.azp!==url.origin||auth.sessionClaims?.iss!==`https://${config.host}`)return null;
 return {clerk,userId:auth.userId,sessionId:auth.sessionId};
}
/** No long-lived app cookie: check the managed session, including revocation. */
export async function emailIdentity(request:Request,env:EmailEnv,url:URL):Promise<string|null>{
 try{const verified=await verifiedSession(request,env,url);if(!verified)return null;
  const session=await verified.clerk.sessions.getSession(verified.sessionId);
  return session.status==='active'&&session.userId===verified.userId?verified.userId:null;
 }catch{return null;}
}
export async function revokeEmailSession(request:Request,env:EmailEnv,url:URL){
 try{const verified=await verifiedSession(request,env,url);if(!verified)return true;
  const session=await verified.clerk.sessions.getSession(verified.sessionId);
  if(session.userId!==verified.userId)return false;
  if(session.status==='active')await verified.clerk.sessions.revokeSession(verified.sessionId);
  return true;
 }catch{return false;}
}
export async function emailProfile(env:EmailEnv,id:string){
 const user=await client(env).users.getUser(id),email=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 if(!email||email.verification?.status!=='verified'||!user.passwordEnabled)return null;
 return {email:email.emailAddress.slice(0,254),name:(user.fullName||user.username||'Dog friend').slice(0,40)};
}
export async function deleteEmailIdentity(env:EmailEnv,id:string){
 try{await client(env).users.deleteUser(id);return true;}catch(error){return typeof error==='object'&&error!==null&&'status' in error&&error.status===404;}
}

/** The local deletion transaction leaves this retryable, non-secret job behind. */
export async function finishEmailDeletion(env:EmailEnv&{DB:import('./accounts').D1},id:string){
 if(!env.CLERK_SECRET_KEY)return false;
 try{if(!await deleteEmailIdentity(env,id))return false;await env.DB.prepare('UPDATE email_deletions SET completed_at = ? WHERE provider_sub = ?').bind(Date.now(),id).run();return true;}catch{return false;}
}
export async function drainEmailDeletions(env:EmailEnv&{DB:import('./accounts').D1}){
 if(!env.CLERK_SECRET_KEY)return;
 await env.DB.prepare('DELETE FROM email_deletions WHERE completed_at < ?').bind(Date.now()-86400000).run();
 const pending=await env.DB.prepare('SELECT provider_sub FROM email_deletions WHERE completed_at IS NULL ORDER BY requested_at LIMIT 5').all<{provider_sub:string}>();
 for(const job of pending.results)await finishEmailDeletion(env,job.provider_sub);
}
