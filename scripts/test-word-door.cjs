const {chromium}=require('playwright'),assert=require('node:assert/strict');
/* A WORD MUST HAVE A DOOR.
 *
 * The engine has always understood a spoken cue: say a word, then care for
 * him within thirty seconds, and the word starts to mean what followed it.
 * The streamlining of the command bar removed the talk input, and with it
 * the only way to reach that mechanic — while the word book still told the
 * reader to "say a word". A working feature with no door is a feature the
 * product does not have, and copy that instructs an impossible action is a
 * lie told to the owner.
 *
 * So the way to say a word lives where the words live: inside "Words he
 * know", in the coach. This test proves the door opens, the word reaches
 * the engine, and the dog answers honestly about a word he has not learned.
 */
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play';
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,args:process.env.DOG_NATIVE_GL?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const p=await b.newPage({viewport:{width:390,height:844}});
    p.setDefaultTimeout(60000);
    const errors=[]; p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.waitForSelector('canvas',{timeout:60000});
    await p.waitForTimeout(4000);
    await p.getByRole('tab',{name:'Coach',exact:true}).click();
    await p.getByText('Words he knows',{exact:true}).click();
    const box=p.getByRole('textbox',{name:'Say a word to Expo'});
    await box.waitFor({state:'visible'});
    await box.fill('hello');
    await p.getByRole('button',{name:'Say',exact:true}).click();
    // The save is asynchronous (it goes through the progress store), so the
    // test waits for the word to land rather than for a fixed number of
    // milliseconds. A fixed wait is a flaky test, not a strict one.
    await p.waitForFunction(()=>{
      const raw=JSON.parse(localStorage.getItem('canine_os_save_v3')||'{}');
      const s=(raw.pets||{})['expo-2021']||{};
      return 'hello' in (s.associations||{});
    },{timeout:30000});
    const state=await p.evaluate(()=>{
      const raw=JSON.parse(localStorage.getItem('canine_os_save_v3')||'{}');
      const s=(raw.pets||{})['expo-2021']||{};
      return {associations:s.associations||{},cueMemory:s.cueMemory||{}};
    });
    assert('hello' in state.associations,'The word must reach the engine');
    assert('hello' in state.cueMemory,'The dog must remember the word he heard');
    const reply=await p.evaluate(()=>[...document.querySelectorAll('[role=status]')].map(n=>n.innerText).join(' '));
    assert(/hello/i.test(reply),'The dog must answer about the word he was given');
    assert(/doesn't know|wait|shown/i.test(reply),'A word he has not learned must be answered honestly, not celebrated');
    assert.deepEqual(errors,[]);
    console.log('PASS a word reaches the engine and the dog answers it honestly;',reply.trim().slice(0,90));
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
