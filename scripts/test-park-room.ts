/**
 * The live park room, driven without a Workers runtime: a minimal stand-in
 * for the Durable Object state (acceptWebSocket / getWebSockets) and for a
 * hibernating socket (serializeAttachment / deserializeAttachment).
 */
import assert from 'node:assert/strict';
import {MAX_DOGS,RATE_LIMIT,type LiveDog,type ServerMessage} from '../src/domain/parkProtocol';
import {MAX_SOCKETS,ParkRoom,type RoomState} from '../worker/parkRoom';

class FakeSocket{
 sent:ServerMessage[]=[];closed:{code:number;reason:string}|null=null;accepted=false;private attachment:unknown=null;
 serializeAttachment(value:unknown){this.attachment=structuredClone(value);}
 deserializeAttachment(){return structuredClone(this.attachment);}
 send(raw:string){if(this.closed)throw new Error('closed');this.sent.push(JSON.parse(raw));}
 close(code:number,reason:string){this.closed??={code,reason};}
 accept(){this.accepted=true;}
 get seat(){return this.attachment as {id:string|null;rate:{count:number}}|null;}
 of(t:ServerMessage['t']){return this.sent.filter(message=>message.t===t);}
}
class FakeState implements RoomState{
 sockets:FakeSocket[]=[];
 acceptWebSocket(ws:WebSocket){this.sockets.push(ws as unknown as FakeSocket);}
 getWebSockets(){return this.sockets as unknown as WebSocket[];}
}
// Node refuses to construct a 101 response; the room only needs to hand one back.
const NativeResponse=Response;
class UpgradeResponse extends NativeResponse{
 upgraded:boolean;
 constructor(body?:BodyInit|null,init?:ResponseInit){const upgraded=init?.status===101;super(body,upgraded?{...init,status:200}:init);this.upgraded=upgraded;}
}
let lastServerSide:FakeSocket;
Object.assign(globalThis,{Response:UpgradeResponse,WebSocketPair:class{0=new FakeSocket();1=lastServerSide=new FakeSocket();}});

const dog=(name:string):LiveDog=>({name,breed:'Thai ridgeback',art:'',coat:{base:'#aa8855',light:'#ccaa77',dark:'#664422'},owner:name+"'s person"});
const upgrade=()=>new Request('https://park.test/api/park/pond-tiger-k7f3q2aa',{headers:{Upgrade:'websocket'}});
function park(){
 const state=new FakeState(),room=new ParkRoom(state);
 const connect=async()=>{const response=await room.fetch(upgrade()) as UpgradeResponse;assert(response.upgraded);return lastServerSide;};
 const say=(ws:FakeSocket,message:unknown)=>room.webSocketMessage(ws as unknown as WebSocket,JSON.stringify(message));
 const join=async(id:string,name=id)=>{const ws=await connect();await say(ws,{t:'hello',id,dog:dog(name)});return ws;};
 /** The runtime reports a close while the socket is still listed, then forgets it. */
 const drop=async(ws:FakeSocket)=>{await room.webSocketClose(ws as unknown as WebSocket);state.sockets=state.sockets.filter(other=>other!==ws);};
 return{state,room,connect,say,join,drop};
}

{// A browser that reconnects keeps its dog in front of its friends.
 const {join,drop}=park();
 const first=await join('aaaaaaaa'),friend=await join('bbbbbbbb');
 const second=await join('aaaaaaaa');
 assert.deepEqual(first.closed,{code:1000,reason:'Replaced'});
 assert.equal(first.seat?.id,null,'The replaced seat gives up the id before it closes');
 assert.deepEqual(second.of('roster')[0],{t:'roster',dogs:[{id:'bbbbbbbb',dog:dog('bbbbbbbb'),intent:null}]},'The new seat is not shown its own replaced copy');
 await drop(first);
 assert.deepEqual(friend.of('leave'),[],'The old connection closing does not remove the dog the new one holds');
 await drop(second);
 assert.deepEqual(friend.of('leave'),[{t:'leave',id:'aaaaaaaa',hungry:false}],'A real departure is still announced');
}
{// The close handler is safe on its own, even if two connections still claim one id.
 const {state,connect,drop}=park();
 const [one,two,friend]=[await connect(),await connect(),await connect()];
 const seat=(id:string)=>({id,dog:dog(id),intent:null,rate:{start:Date.now(),count:1}});
 one.serializeAttachment(seat('aaaaaaaa'));two.serializeAttachment(seat('aaaaaaaa'));friend.serializeAttachment(seat('bbbbbbbb'));
 await drop(one);
 assert.deepEqual(friend.of('leave'),[],'No leave while another live connection holds the id');
 await drop(two);
 assert.equal(friend.of('leave').length,1,'The last holder leaving is announced once');
 assert.equal(state.sockets.length,1);
}
{// A full room still lets one of its own dogs reconnect.
 const {join}=park();
 for(let i=0;i<MAX_DOGS;i++)await join('dogdogdog'+i);
 const again=await join('dogdogdog0');
 assert.equal(again.of('full').length,0);
 assert.equal((again.of('roster')[0] as {dogs:unknown[]}).dogs.length,MAX_DOGS-1,'Reconnecting into a full room replaces the seat');
 const ninth=await join('strangerdog');
 assert.equal(ninth.of('full').length,1,'A ninth dog is still refused');
}
{// Repeating hello spends the rate budget like any other message.
 const {join,say}=park();
 const ws=await join('aaaaaaaa');
 assert.equal(ws.seat?.rate.count,1);
 await say(ws,{t:'hello',id:'aaaaaaaa',dog:dog('aaaaaaaa')});
 assert.equal(ws.seat?.rate.count,2,'A repeated hello is counted');
 for(let i=2;i<=RATE_LIMIT;i++)await say(ws,{t:'hello',id:'aaaaaaaa',dog:dog('aaaaaaaa')});
 assert.deepEqual(ws.closed,{code:1008,reason:'Too many messages'},'A hello flood is cut off');
}
{// Connections that never say hello cannot pile up without limit.
 const {state,connect}=park();
 for(let i=0;i<MAX_SOCKETS;i++)await connect();
 assert.equal(state.sockets.length,MAX_SOCKETS);
 const oldest=state.sockets[0];
 const extra=await connect();
 assert.equal(state.sockets.filter(s=>!s.closed).length,MAX_SOCKETS,'The room does not hold more than its cap');
 assert.deepEqual(oldest.closed,{code:1000,reason:'Idle'},'At the cap the oldest connection without a dog is let go');
 assert(state.sockets.includes(extra)&&!extra.closed&&extra.sent.every(m=>(m as {t:string}).t!=='full'),'Idle connections cannot lock a newcomer out');
}
console.log('PASS park room: same-id reconnect keeps the dog, close guard, full-room reconnect, repeated hello rate, socket cap');
