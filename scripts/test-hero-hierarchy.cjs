const {chromium}=require('playwright'),assert=require('node:assert/strict');
/* THE HERO IS THE DOG.
 *
 * The tricks used to open by themselves on a wide stage, and seven icons
 * stood over the picture like a strip left on the floor. The phone had them
 * closed; the desktop did not. The dog is the hero, so the tricks belong at
 * his edge and open when the reader asks.
 *
 * And the reading is hidden UNDER the dog: open it, and the dog keeps his
 * room, the page does not scroll, and the choices come back when it closes.
 */
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play';
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,args:process.env.DOG_NATIVE_GL?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const p=await b.newPage({viewport:{width:1440,height:900}});
    p.setDefaultTimeout(60000);
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.waitForSelector('.region-stage canvas',{timeout:60000});
    await p.waitForTimeout(4000);

    /* The stage must not wear a strip of icons. */
    const toys=await p.evaluate(()=>{
      const group=document.querySelector('.dog-toys');
      return {open:group?.getAttribute('data-open'),buttons:group?group.querySelectorAll('button').length:0};
    });
    assert.equal(toys.open,'false','The tricks must start closed');
    assert.equal(toys.buttons,1,'Only the disclosure stands over the picture until the reader asks for the tricks');

    /* The reading opens under the dog and the dog keeps his room. */
    const entry=await b.newPage({viewport:{width:390,height:844}});
    entry.setDefaultTimeout(60000);
    await entry.goto((process.env.DOG_URL||'http://127.0.0.1:4178/').split('?mode=')[0],{waitUntil:'domcontentloaded'});
    await entry.waitForSelector('.entry',{timeout:60000});
    await entry.waitForTimeout(2500);
    const before=await entry.evaluate(()=>{
      const dog=document.querySelector('.entry-dog').getBoundingClientRect();
      return {dogH:Math.round(dog.height),vh:window.innerHeight};
    });
    await entry.getByRole('button',{name:'Read about this project'}).click();
    await entry.waitForSelector('.entry-reading',{timeout:30000});
    await entry.waitForTimeout(600);
    const reading=await entry.evaluate(()=>{
      const dog=document.querySelector('.entry-dog').getBoundingClientRect();
      const body=document.querySelector('.entry-reading-body');
      const tabs=[...document.querySelectorAll('.entry-reading-tab')];
      return {
        dogH:Math.round(dog.height),
        dogShare:Math.round(dog.height/window.innerHeight*100),
        pageScroll:document.documentElement.scrollHeight-window.innerHeight,
        readsInside:body.scrollHeight>body.clientHeight,
        tabs:tabs.map(t=>t.textContent),
        choicesGone:!document.querySelector('.entry-choice'),
      };
    });
    assert(reading.dogShare>=45,`The dog must keep the screen when the reading is open, not ${reading.dogShare}%`);
    assert.equal(reading.pageScroll,0,'The page must never scroll');
    assert.equal(reading.readsInside,true,'The reading scrolls inside its own region');
    assert.deepEqual(reading.tabs,['How this was made','The idea','Dr Non']);
    assert.equal(reading.choicesGone,true,'The choices step aside while the reading is open');

    /* The keyboard reaches every reading. */
    await entry.getByRole('tab',{name:'How this was made'}).focus();
    await entry.keyboard.press('ArrowRight');
    assert.equal(await entry.getByRole('tab',{name:'The idea'}).getAttribute('aria-selected'),'true','ArrowRight moves to the next reading');
    await entry.keyboard.press('End');
    assert.equal(await entry.getByRole('tab',{name:'Dr Non'}).getAttribute('aria-selected'),'true','End reaches the last reading');
    await entry.getByRole('button',{name:'Close the reading'}).click();
    await entry.waitForTimeout(400);
    assert.equal(await entry.locator('.entry-choice').count()>0,true,'Closing the reading brings the choices back');
    assert.deepEqual(errors,[]);
    console.log('PASS the tricks start closed and the reading opens under the dog;',`dog keeps ${reading.dogShare}% of the frame`);
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
