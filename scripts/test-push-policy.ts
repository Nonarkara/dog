import assert from 'node:assert/strict';
import {buildPushSchedule} from '../src/domain/pushSchedule';
const originalTZ=process.env.TZ;
try{
  for(const zone of ['Asia/Bangkok','America/New_York','Europe/London','Asia/Kathmandu','Pacific/Auckland']){
    process.env.TZ=zone;
    const at=new Date(2026,10,5,21,59).getTime(),now=at-2*3600_000;
    const one=buildPushSchedule(at,false,now);
    assert.equal(new Date(one.at).getHours(),7,zone+' rounds21:59 then waits until morning');
    assert(one.at>at);assert.equal(new Date(one.until).getHours(),22);
    assert.equal(one.followupAt,0);assert.equal(one.followupUntil,0);
    const two=buildPushSchedule(new Date(2026,10,5,21,15).getTime(),true,now);
    assert.equal(new Date(two.followupAt).getHours(),7,zone+' follow-up waits through the night');
    assert(two.followupAt-two.at>=90*60_000);
    assert(two.followupUntil<=now+48*3600_000);
    assert(two.until>two.at&&two.followupUntil>two.followupAt);
  }
  process.env.TZ='America/New_York';
  for(const [month,day]of[[2,8],[10,1]]){
    const at=new Date(2026,month,day,1,59).getTime(),s=buildPushSchedule(at,true,at-2*3600_000);
    assert.equal(new Date(s.at).getHours(),7,'DST quiet-end is local07:00');
    assert.equal(new Date(s.until).getHours(),22,'DST deadline is local22:00');
    assert.equal(new Date(s.at).getDate(),day);assert(s.followupAt>=s.at+90*60_000);
  }
  process.env.TZ='Asia/Bangkok';
  const now=new Date(2026,10,5,21).getTime(),late=buildPushSchedule(new Date(2026,10,6,21,45).getTime(),true,now);
  assert.equal(late.followupUntil,now+48*3600_000,'The final optional window is clipped to the API horizon');
  assert.throws(()=>buildPushSchedule(NaN,false));assert.throws(()=>buildPushSchedule(Number.MAX_SAFE_INTEGER,false));
  console.log('PASS local07–22 cron rounding, optional follow-up, five timezones, DST and48h bound');
}finally{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;}
