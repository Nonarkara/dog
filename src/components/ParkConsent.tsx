/**
 * THE CONSENT NOTE — asked once, before a signed-in owner's first park visit
 * is recorded. Wording approved by the owner, 2026-11-02.
 */
import React, {useEffect, useRef, useState} from 'react';

const TEXT = {
  en: {
    title: 'Before you take your dog to the park',
    intro: 'When you are signed in and visit the park, I keep a short note of each visit:',
    items: ['when you arrived and left', 'how your dog was doing: fed, clean, rested, trusting, calm, sick or asleep'],
    not: 'Nothing about your location, photos, messages or contacts. Camera photos stay on your phone unless you share them.',
    rows: [
      ['Why', 'I am testing whether the game helps people look after a dog well.'],
      ['Who sees it', 'Only me, under your display name. You can see your own visits under "My data".'],
      ['How long', 'One month from each visit, then it is deleted.'],
      ['Stop any time', 'Play without the record, or "Delete account" on the first screen removes everything. Questions: ask the person who invited you.'],
    ],
    yes: 'I agree', no: 'Play without the record', other: 'ไทย',
  },
  th: {
    title: 'ก่อนพาน้องไปสวน',
    intro: 'เมื่อคุณลงชื่อเข้าใช้และพาน้องไปสวน ผมจะบันทึกสั้น ๆ ทุกครั้งที่ไป:',
    items: ['เวลาที่มาถึงและเวลากลับ', 'สภาพของน้องตอนนั้น: อิ่มไหม สะอาดไหม เหนื่อยไหม ไว้ใจคุณแค่ไหน สงบไหม ป่วยหรือหลับอยู่หรือเปล่า'],
    not: 'ผมไม่บันทึกตำแหน่งของคุณ รูปภาพ ข้อความ หรือรายชื่อติดต่อ รูปที่ถ่ายจากกล้องจะอยู่ในโทรศัพท์ของคุณ จนกว่าคุณจะแชร์เอง',
    rows: [
      ['ทำไม', 'ผมกำลังทดสอบว่าเกมนี้ช่วยให้คนดูแลน้องหมาได้ดีขึ้นจริงไหม'],
      ['ใครเห็น', 'ผมคนเดียว โดยเห็นเป็นชื่อที่คุณใช้ในเกม คุณดูบันทึกของตัวเองได้ที่ "My data"'],
      ['เก็บนานแค่ไหน', 'หนึ่งเดือนนับจากวันที่ไป แล้วจะลบทิ้ง'],
      ['หยุดได้ทุกเมื่อ', 'เล่นโดยไม่บันทึก หรือกด "Delete account" ที่หน้าแรกเพื่อลบทุกอย่าง มีคำถามถามคนที่ชวนคุณมาได้เลย'],
    ],
    yes: 'ยินยอม', no: 'เล่นโดยไม่บันทึก', other: 'English',
  },
} as const;

export const ParkConsent: React.FC<{onChoose:(agree:boolean)=>void}> = ({onChoose}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [lang, setLang] = useState<'en'|'th'>('en');
  useEffect(() => { ref.current?.showModal(); }, []);
  const t = TEXT[lang];
  return <dialog ref={ref} className="care-details-dialog park-consent" lang={lang} aria-labelledby="park-consent-title" onCancel={e=>e.preventDefault()}>
    <div className="park-consent-head"><h2 id="park-consent-title">{t.title}</h2><button type="button" className="btn-quiet" onClick={()=>setLang(l=>l==='en'?'th':'en')}>{t.other}</button></div>
    <p>{t.intro}</p>
    <ul>{t.items.map(i=><li key={i}>{i}</li>)}</ul>
    <p>{t.not}</p>
    <dl>{t.rows.map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
    <div className="park-consent-actions"><button type="button" className="btn-quiet" onClick={()=>onChoose(true)}>{t.yes}</button><button type="button" className="btn-quiet" onClick={()=>onChoose(false)}>{t.no}</button></div>
  </dialog>;
};
