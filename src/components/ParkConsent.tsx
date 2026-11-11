/**
 * THE CONSENT NOTE — asked once, before a signed-in owner's first park visit
 * is recorded. Wording approved by the owner, 2026-11-02.
 */
import React, {useEffect, useRef, useState} from 'react';

const TEXT = {
  en: {
    title: 'Before you take your dog to the park',
    intro: 'When you are signed in and visit the park, I keep a short note of each visit:',
    items: ['when you arrived and left', 'how your dog was doing: fed, clean, rested, trusting, excited, sick or asleep'],
    not: 'Nothing about your location, photos, messages or contacts. Camera photos stay on your phone unless you share them.',
    rows: [
      ['Why', 'I am testing whether the game helps people look after a dog well.'],
      ['Who sees it', 'Only me, under your display name. You can see your own visits under "My data".'],
      ['How long', 'One month from each visit, then it is deleted.'],
      ['Stop any time', 'Open Park visits on the first screen and choose Play without the record to delete your visits.'],
    ],
    yes: 'I agree', no: 'Play without the record', other: 'ไทย', close: 'Close', failed: 'Could not save your choice. Try again.',
  },
  th: {
    title: 'ก่อนพาน้องไปสวน',
    intro: 'เมื่อคุณลงชื่อเข้าใช้และพาน้องไปสวน ผมจะบันทึกสั้น ๆ ทุกครั้งที่ไป:',
    items: ['เวลาที่มาถึงและเวลากลับ', 'สภาพของน้องตอนนั้น: อิ่มไหม สะอาดไหม เหนื่อยไหม ไว้ใจคุณแค่ไหน ตื่นเต้นไหม ป่วยหรือหลับอยู่หรือเปล่า'],
    not: 'ผมไม่บันทึกตำแหน่งของคุณ รูปภาพ ข้อความ หรือรายชื่อติดต่อ รูปที่ถ่ายจากกล้องจะอยู่ในโทรศัพท์ของคุณ จนกว่าคุณจะแชร์เอง',
    rows: [
      ['ทำไม', 'ผมกำลังทดสอบว่าเกมนี้ช่วยให้คนดูแลน้องหมาได้ดีขึ้นจริงไหม'],
      ['ใครเห็น', 'ผมคนเดียว โดยเห็นเป็นชื่อที่คุณใช้ในเกม คุณดูบันทึกของตัวเองได้ที่ "My data"'],
      ['เก็บนานแค่ไหน', 'หนึ่งเดือนนับจากวันที่ไป แล้วจะลบทิ้ง'],
      ['หยุดได้ทุกเมื่อ', 'เปิด Park visits ที่หน้าแรก แล้วเลือกเล่นโดยไม่บันทึกเพื่อลบประวัติการไปสวน'],
    ],
    yes: 'ยินยอม', no: 'เล่นโดยไม่บันทึก', other: 'English', close: 'ปิด', failed: 'บันทึกตัวเลือกไม่ได้ ลองอีกครั้ง',
  },
} as const;

export const ParkConsent: React.FC<{onChoose:(agree:boolean)=>Promise<boolean>;onClose?:()=>void}> = ({onChoose,onClose}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [lang, setLang] = useState<'en'|'th'>('en');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const t = TEXT[lang];
  const choose = async (agree:boolean) => {
    setBusy(true);
    setFailed(!await onChoose(agree));
    setBusy(false);
  };
  return <dialog ref={ref} className="care-details-dialog park-consent" lang={lang} aria-labelledby="park-consent-title" onCancel={e=>{e.preventDefault();if(!busy)onClose?.();}}>
    <div className="park-consent-head"><h2 id="park-consent-title">{t.title}</h2><button type="button" className="btn-quiet" onClick={()=>setLang(l=>l==='en'?'th':'en')}>{t.other}</button></div>
    <p>{t.intro}</p>
    <ul>{t.items.map(i=><li key={i}>{i}</li>)}</ul>
    <p>{t.not}</p>
    <dl>{t.rows.map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
    {failed&&<p role="alert">{t.failed}</p>}
    <div className="park-consent-actions"><button type="button" className="btn-quiet" disabled={busy} onClick={()=>void choose(true)}>{t.yes}</button><button type="button" className="btn-quiet" disabled={busy} onClick={()=>void choose(false)}>{t.no}</button>{onClose&&<button type="button" className="btn-quiet" disabled={busy} onClick={onClose}>{t.close}</button>}</div>
  </dialog>;
};
