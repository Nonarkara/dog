import React from 'react';
import type {BehaviourName} from '../domain/types';

/** Small line drawings show the task; labels keep their meaning accessible. */
export function TrainingSteps({name,word,step}:{name:BehaviourName;word:string;step:number}){
 const down=name==='down',paw=name==='paw',moving=name==='come'||name==='fetch';
 return <ol className="training-pictures" aria-label="Watch the action, say its name, give a tiny treat">
  <li data-current={step===0} aria-current={step===0?'step':undefined}><svg viewBox="0 0 100 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
   <path d={down?'M34 38Q59 30 76 44L86 48H64L52 44L40 51H17L30 44':'M38 27Q57 22 67 39L73 52H54L49 38L44 52H24L35 44Z'}/><path d="M65 31q22-18 19-3q-2 8-12 7"/>
   <path d={down?'M21 33l-3-12 12 7q17-5 18 9l-5 8-20-2-9-5Z':'M23 22l-3-13 12 8q17-4 19 11l-6 9-19-2-10-7Z'}/><circle cx={34} cy={down?34:23} r="1" fill="currentColor"/>
   {paw&&<path d="M40 37l-14-2-4-8"/>}{moving&&<path d="M8 46h11m-8 8h9"/>}{name==='fetch'&&<circle cx="15" cy="52" r="5"/>}<path d="M11 57h78" opacity=".35"/>
  </svg><span>1 · Watch</span></li>
  <li data-current={step===1} aria-current={step===1?'step':undefined}><svg viewBox="0 0 100 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 9h70v36H48L32 56V45H15Z"/><text x="50" y="32" textAnchor="middle" fill="currentColor" stroke="none" fontSize={word.length>6?12:17}>{word}</text></svg><span>2 · Say it</span></li>
  <li data-current={step===2} aria-current={step===2?'step':undefined}><svg viewBox="0 0 100 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 49l19-15q4-3 8 0l9 7 20-4q13-1 8 6L49 56H27M7 44l13 15"/><circle cx="58" cy="22" r="4" fill="currentColor"/><path d="M58 6v6m-12 3 4 3m20-3-4 3"/></svg><span>3 · Tiny treat</span></li>
 </ol>;
}
