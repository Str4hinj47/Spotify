// Feature smokes that are not testing the economy need a well-funded garage.
// Seed once per isolated browser context so reloads still test persistence.
export async function seedEconomy(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('smoke-economy-seeded')) return;
    localStorage.setItem('overtake-progression-v2', JSON.stringify({version:2,money:1_000_000,dev:false,owned:['golf','mercedes','audi','mustang','ferrari','r8','challenger'],upgrades:{},tunes:{}}));
    sessionStorage.setItem('smoke-economy-seeded','1');
  });
}
