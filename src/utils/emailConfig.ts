/** A public Clerk key encodes its Frontend API host. No credential lives here. */
export function clerkHost(key:string):string|null {
 if(!/^pk_(live|test)_[A-Za-z0-9+/=_-]+$/.test(key))return null;
 try{const host=atob(key.replace(/^pk_(live|test)_/,'').replace(/-/g,'+').replace(/_/g,'/')).replace(/\$$/,'');return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)&&host.includes('.')&&!host.includes('..')?host:null;}catch{return null;}
}
