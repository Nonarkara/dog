/** Local browser fixture: no real permission prompts, subscriptions or pushes. */
const ENDPOINT='https://fcm.googleapis.com/fixture/abcdefghijklmnopqrstuvwxyz123456789';
async function installPushFixture(page,{subscribed=false}={}){
  const requests=[],control={status:200,delay:0,hold:null,revision:0};
  await page.addInitScript(({subscribed,endpoint})=>{
    window.pushFixture={subscribed,unsubFail:false,unsubThrow:false,closed:0,badgesCleared:0};
    Object.defineProperty(Notification,'permission',{get:()=> 'granted',configurable:true});
    Notification.requestPermission=async()=> 'granted';
    const sub=()=>({endpoint,unsubscribe:async()=>{if(window.pushFixture.unsubThrow)throw new Error('Unsubscribe unavailable');if(window.pushFixture.unsubFail)return false;window.pushFixture.subscribed=false;return true;}});
    PushManager.prototype.getSubscription=async()=>window.pushFixture.subscribed?sub():null;
    PushManager.prototype.subscribe=async()=>{window.pushFixture.subscribed=true;return sub();};
    ServiceWorkerRegistration.prototype.getNotifications=async()=>[{close(){window.pushFixture.closed++;}}];
    navigator.clearAppBadge=async()=>{window.pushFixture.badgesCleared++;};
  },{subscribed,endpoint:ENDPOINT});
  await page.route('**/api/me',r=>r.fulfill({json:{user:null,providers:[]}}));
  await page.route('**/api/push',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(control.hold)await control.hold(body);
    if(control.delay)await new Promise(r=>setTimeout(r,control.delay));
    await route.fulfill({status:control.status,json:control.status===200?{ok:true}:{error:'Fixture unavailable',revision:control.revision}}).catch(()=>{});
  });
  return{requests,control};
}
async function ready(page,base){
  await page.goto(base+'/?mode=play');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
  await page.evaluate(()=>{const key='canine_os_save_v3',s=JSON.parse(localStorage.getItem(key));s.pets['expo-2021'].careLog={...s.pets['expo-2021'].careLog,answered:1};localStorage.setItem(key,JSON.stringify(s));});
  await page.reload();await page.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
}
module.exports={installPushFixture,ready,ENDPOINT};
