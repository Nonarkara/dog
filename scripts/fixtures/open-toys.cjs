/** The dog's tricks live behind a disclosure: the toys row is closed until
 * the reader asks for it, so a test that wants a trick opens it first.
 *
 * The toys are a disclosure, not a row of always-visible buttons, because
 * eight extra controls on a phone toolbar would cost the dog his screen.
 * A test that reaches for "Find the treat" without opening the toys is
 * asking for a button that is deliberately not there yet. */
async function openToys(page){
 const toys=page.getByRole('button',{name:'Tricks and toys'});
 if((await toys.count()) && (await toys.first().isVisible())) await toys.first().click();
 await page.waitForTimeout(250);
}
module.exports={openToys};
