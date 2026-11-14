import React,{useState} from 'react';
import type {PetState} from '../domain/types';
/** Spoken cues strengthen through care pairings; an unanswered cue can weaken. */
export function WordBook({petState,onSay,name}:{petState:PetState;onSay?:(word:string)=>void;name:string}){
 const [word,setWord]=useState('');
 const send=(e:React.FormEvent)=>{e.preventDefault();const clean=word.trim().toLowerCase();if(!clean||!onSay)return;onSay(clean);setWord('');};
 return (
      <details className="practice-attempts practice-attempts--fold border-hairline-t px-2 py-1.5">
        <summary className="label">Words {name} knows</summary>
        {/* The way in. A word is only a word if someone can say it to him, and
            this is where the words live, so the saying lives here too. */}
        {onSay&&<form onSubmit={send} className="mt-1 flex items-center gap-1">
          <input
            value={word}
            onChange={e=>setWord(e.target.value)}
            maxLength={24}
            placeholder="Say a word"
            aria-label={`Say a word to ${name}`}
            className="min-w-0 flex-1 border-hairline bg-transparent px-1.5 py-1 text-[11px]"
          />
          <button type="submit" className="btn btn-quiet border-hairline px-2 text-[11px]" disabled={!word.trim()}>Say</button>
        </form>}
        {(() => {
          const entries = Object.entries(petState.associations ?? {}).filter(([, v]) => v > 0.04).sort((a, b) => b[1] - a[1]);
          const words = entries.slice(0, 5);
          if (!words.length) return (
            <p className="mt-1 text-[11px] leading-snug text-faint">
              None yet. Say a word, then care for {name} within 30 seconds — the word starts to mean what followed it.
            </p>
          );
          return (
            <div className="mt-1 space-y-0.5 pr-1">
              {words.map(([w, v]) => {
                const lit = Math.max(1, Math.min(3, Math.round(v * 3)));
                return (
                  <div key={w} className="flex items-baseline justify-between gap-2 border-hairline-b last:border-b-0 py-0.5">
                    <span className="data text-[10px] text-zinc-300 truncate">“{w}”</span>
                    <span className="data text-[10px] shrink-0 text-zinc-500" aria-label={`strength ${Math.round(v * 100)} of 100, ${petState.cueMemory?.[w]?.pairings ?? 0} pairings`}>
                      <span className="text-accent" aria-hidden="true">{'●'.repeat(lit)}</span>
                      <span className="text-zinc-600" aria-hidden="true">{'○'.repeat(3 - lit)}</span>
                      {' '}{petState.cueMemory?.[w]?.pairings ?? 0}×
                    </span>
                  </div>
                );
              })}
              {entries.length > 5 && <p className="text-[10px] leading-snug text-faint">+{entries.length - 5} more</p>}
            </div>
          );
        })()}
      </details>
 );}
