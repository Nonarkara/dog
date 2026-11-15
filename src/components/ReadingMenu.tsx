/**
 * THE HIDDEN READING.
 *
 * Three things worth reading, for the reader who wants to know what this is
 * and who made it: how the thing was built, what it is for, and the person
 * whose laws shaped it.
 *
 * It is hidden because the DOG is the hero. On the entry screen the dog owns
 * the middle of the frame, and the reading sits UNDER him in the column
 * where the choices were, so nothing covers the animal and nothing scrolls
 * the page. Open the reading and the choices step aside; close it and they
 * come back. The wordmark in the app's own header is already the way back
 * to this screen, so one place is enough.
 *
 * The words are the product's own: the laws the agents obey, the decisions
 * each design note records, and the history the repository carries. Nothing
 * here is filler, and nothing here sells anything.
 */
import React,{useRef,useState} from 'react';
import {BookOpen,X} from 'lucide-react';

type ReadingKey='made'|'idea'|'person';

interface Reading{
  key:ReadingKey;
  label:string;
  body:React.ReactNode;
}

const READINGS:Reading[]=[
  {
    key:'made',
    label:'How this was made',
    body:<>
      <p>Tama-Dog-Chi was built in about two weeks by several AI agents working in one repository. None of them wrote the rules. The rules came first: a written law for how a screen should be built, a production doctrine for how work gets verified, and one standing order that the agent which builds never audits its own work.</p>
      <p>Every change ships with the test that would catch it breaking. The layout is measured too: the receipt in <code>design/spatial-baseline.json</code> holds 156 measurements across the three surfaces this app has, taken at every width the CSS changes at. A hole with no reason written down fails the gate.</p>
      <p>The dog is drawn, not modelled. Every pose is a drawing and movement is a sequence of drawings. That is why his feet stay on the floor and his face does not swim when he turns.</p>
    </>,
  },
  {
    key:'idea',
    label:'The idea',
    body:<>
      <p>The first digital pets wanted feeding and cleaning on a screen. This one wants you to look after a real dog.</p>
      <p>Expo is a Thai Bangkaew you actually own. The app keeps his needs, his memory and his mood. Say a word, then care for him within thirty seconds, and the word starts to mean what followed it. Practise sit, stay and wait with him on screen, then log what the real dog did.</p>
      <p>None of the numbers measure your dog. They are a game model of reward-based training, written down so the app can show you where the reward goes.</p>
    </>,
  },
  {
    key:'person',
    label:'Dr Non',
    body:<>
      <p>Dr Non Arkaraprasertkul (<span lang="th">ดร.นน อัครประเสริฐกุล</span>) builds civic systems in Thailand and Southeast Asia: smart-city dashboards for Phuket and Bangkok, Axiom and TKCPMO, the OTOP product registry, a tsunami evacuation system, a Kuching municipality dashboard, Thailand's Digital Valley, and FloodDash for the map work. Dozens of repositories, and the rules the agents obey sit at the root of them.</p>
      <p>He does not write the code. He writes the law the code obeys, and the law is short: one screen and no scroll, boxes that fit their contents, one accent colour, no gradients, no rounded corners, and the agent that builds never signs off its own work.</p>
      <p>That law is why there is one dog in the middle of this screen and everything else under him.</p>
    </>,
  },
];

export function ReadingMenu({onClose}:{onClose:()=>void}){
  const [active,setActive]=useState<ReadingKey>('made');
  const tabs=useRef<Partial<Record<ReadingKey,HTMLButtonElement|null>>>({});
  const reading=READINGS.find(r=>r.key===active)??READINGS[0];

  const onKeyDown=(event:React.KeyboardEvent<HTMLButtonElement>)=>{
    const index=READINGS.findIndex(r=>r.key===active);
    let next=index;
    if(event.key==='ArrowRight')next=(index+1)%READINGS.length;
    else if(event.key==='ArrowLeft')next=(index-1+READINGS.length)%READINGS.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=READINGS.length-1;
    else return;
    event.preventDefault();
    const key=READINGS[next].key;
    setActive(key);
    tabs.current[key]?.focus();
  };

  return <section className="entry-reading" aria-label="Read about this project">
    <header className="entry-reading-head">
      <span className="label">Read</span>
      <button type="button" className="btn-quiet" onClick={onClose} aria-label="Close the reading"><X size={18} aria-hidden="true"/></button>
    </header>
    <div role="tablist" aria-label="Readings" className="entry-reading-tabs">
      {READINGS.map(reading=>{
        const selected=reading.key===active;
        return <button
          key={reading.key}
          type="button"
          role="tab"
          id={`entry-reading-tab-${reading.key}`}
          aria-selected={selected}
          aria-controls={`entry-reading-panel-${reading.key}`}
          tabIndex={selected?0:-1}
          ref={el=>{tabs.current[reading.key]=el;}}
          onClick={()=>setActive(reading.key)}
          onKeyDown={onKeyDown}
          className={`entry-reading-tab${selected?' is-active':''}`}
        >{reading.label}</button>;
      })}
    </div>
    <div
      role="tabpanel"
      id={`entry-reading-panel-${reading.key}`}
      aria-labelledby={`entry-reading-tab-${reading.key}`}
      tabIndex={0}
      className="entry-reading-body"
    >
      {reading.body}
    </div>
  </section>;
}

export function ReadingButton({onOpen}:{onOpen:()=>void}){
  return <button type="button" className="btn-quiet entry-reading-open" onClick={onOpen} aria-label="Read about this project">
    <BookOpen size={18} aria-hidden="true"/>
  </button>;
}
