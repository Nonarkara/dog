/**
 * THE SMALL "?".
 *
 * Hover, focus or tap it and one short sentence says what this part does.
 * The tip is fixed to the viewport so a panel's overflow never clips it.
 */
import React, {useEffect, useId, useRef, useState} from 'react';

export const Help:React.FC<{text:string;label?:string}>=({text,label='What is this?'})=>{
  const id=useId(),ref=useRef<HTMLButtonElement>(null),touch=useRef(false);
  const [at,setAt]=useState<{x:number;y:number;up:boolean}|null>(null);
  const show=()=>{const r=ref.current?.getBoundingClientRect();if(r){const up=r.bottom+110>window.innerHeight;setAt({x:Math.min(Math.max(8,r.right-240),window.innerWidth-248),y:up?r.top-6:r.bottom+6,up});}};
  // Close on a tap elsewhere, a scroll or a resize: a fixed tip must not drift from its "?".
  useEffect(()=>{if(!at)return;const hide=(e:Event)=>{if(e.target!==ref.current)setAt(null);};
    document.addEventListener('pointerdown',hide,true);window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
    return()=>{document.removeEventListener('pointerdown',hide,true);window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);};},[at]);
  return <>
    <button ref={ref} type="button" className="help-dot" aria-label={label} aria-describedby={at?id:undefined}
      onPointerEnter={e=>{if(e.pointerType==='mouse')show();}} onPointerLeave={e=>{if(e.pointerType==='mouse')setAt(null);}} onFocus={()=>{if(!touch.current)show();}} onBlur={()=>setAt(null)}
      onPointerDown={e=>{touch.current=e.pointerType!=='mouse';}}
      onClick={e=>{e.stopPropagation();e.preventDefault();if(touch.current&&at)setAt(null);else show();}} onKeyDown={e=>{if(e.key==='Escape')setAt(null);}}>?</button>
    {at&&<span id={id} role="tooltip" className="help-tip" style={{left:at.x,top:at.y,transform:at.up?'translateY(-100%)':undefined}}>{text}</span>}
  </>;
};
