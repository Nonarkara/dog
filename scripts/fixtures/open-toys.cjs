/** The dog's tricks live behind a disclosure: the toys row is closed until
 * the reader asks for it, so a test that wants a trick opens it first.
 *
 * The toys are a disclosure, not a row of always-visible buttons, because
 * eight extra controls on a phone toolbar would cost the dog his screen.
 * A test that reaches for "Find the treat" without opening the toys is
 * asking for a button that is deliberately not there yet.
 *
 * It waits for the disclosure to exist, because a test that opens the toys
 * too early finds nothing there and then times out on the toy it wanted.
 * And it never throws: on a surface with no toys there is nothing to open,
 * and a helper that raised would fail a test that was never about toys. */
async function openToys(page){
  const toys=page.getByRole('button',{name:'Tricks and toys'});
  try{
    await toys.first().waitFor({state:'visible',timeout:10000});
    const button=toys.first();
    if(await button.getAttribute('aria-expanded')==='true')return; // already open
    await button.click();
    await page.waitForTimeout(300);
  }catch{/* no disclosure on this surface: the toys are simply not here */}
}
module.exports={openToys};
