/** A lazy Play app may have no canvas yet. Decide from the route, never from
 * a one-frame canvas count that mistakes its loader for the welcome screen. */
async function openPlay(page,url){
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.bringToFront();
 const mode=new URL(page.url()).searchParams.get('mode');
 if(mode==='own')throw new Error('Household visual tests require the root or ?mode=play URL');
 if(mode!=='play'){
  await page.getByRole('link',{name:/Play/}).first().click();
  await page.waitForURL(u=>u.searchParams.get('mode')==='play');
 }
}
module.exports={openPlay};
