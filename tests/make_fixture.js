/* Synthetic accounting file for the tests: a fictional "Test Person", 1.1.2025 to 31.10.2026, built from the
   app's own template (chart of accounts and structure). Deterministic (seeded), so every run sees the same file.
   No real data. Usage in node:  node tests/make_fixture.js > tests/fixture.json   (needs docs/index.html)
   In a browser with the app loaded: makeFixture(VORLAGE).                                                      */
'use strict';
function makeFixture(VORLAGE){
  let seed = 20250101;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const r2 = x => Math.round(x * 100) / 100;
  const betrag = (a, b) => r2(a + rnd() * (b - a));
  const tag = (j, m, d) => j + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const buchungen = [];
  let n = 0;
  const id = () => 'b' + String(++n).padStart(4, '0');
  const buche = (datum, text, z, extra) => buchungen.push(Object.assign({ id: id(), datum: datum, beleg: '', text: text, z: z }, extra || {}));
  const einfach = (datum, text, soll, haben, b) => buche(datum, text, [[soll, b, 0], [haben, 0, b]]);

  // opening balance 2025
  buche('2025-01-01', 'Opening balance 2025', [['1020', 6200, 0], ['1021', 15000, 0], ['1000', 300, 0], ['2800', 0, 21500]], { eb: true });

  const ende = { 2025: 12, 2026: 10 };
  [2025, 2026].forEach(j => {
    for (let m = 1; m <= ende[j]; m++){
      const karte = [];
      const aufKarte = (d, text, konto, b) => { einfach(tag(j, m, d), text, konto, '2110', b); karte.push(b); };
      einfach(tag(j, m, 1), 'Rent ' + String(m).padStart(2, '0') + '/' + String(j).slice(2), '6000', '1020', 1650);
      einfach(tag(j, m, 2), 'Health insurance ' + String(m).padStart(2, '0') + '/' + String(j).slice(2), '5700', '1020', j === 2025 ? 372.4 : 389.1);
      aufKarte(3, 'Phone and internet', '6510', 49.9);
      aufKarte(4, 'Streaming subscription', '6651', 12.9);
      for (let i = 0; i < 7; i++) aufKarte(5 + i * 3, 'Supermarket, groceries', '4000', betrag(18, 140));
      for (let i = 0; i < 3; i++) aufKarte(6 + i * 7, 'Restaurant', '4001', betrag(22, 95));
      aufKarte(14, 'Fuel', '6210', betrag(60, 95));
      if (m % 2 === 0) aufKarte(16, 'Clothing', '4300', betrag(40, 220));
      // a split booking every quarter: one credit card charge on two expense accounts
      if (m % 3 === 0){
        const a = betrag(300, 900), b = betrag(40, 120);
        buche(tag(j, m, 18), 'Weekend trip, hotel and dinner', [['6660', a, 0, 0, 0, 'Hotel'], ['4001', b, 0, 0, 0, 'Dinner'], ['2110', 0, r2(a + b)]]);
        karte.push(r2(a + b));
      }
      // US dollars: buy some, spend some (foreign-currency amount and rate on the USD line)
      if (m === 5 || m === 9){
        const kurs = m === 5 ? 0.9 : 0.88, usd = 500;
        buche(tag(j, m, 10), 'Exchange CHF to USD', [['1020.2', r2(usd * kurs), 0, usd, kurs], ['1020', 0, r2(usd * kurs)]]);
        buche(tag(j, m, 20), 'Trip, USD expenses', [['6660', r2(320 * kurs), 0], ['1020.2', 0, r2(320 * kurs), 320, kurs]]);
      }
      einfach(tag(j, m, 25), 'Salary ' + String(m).padStart(2, '0') + '/' + String(j).slice(2), '1020', '3000', j === 2025 ? 5400 : 5600);
      einfach(tag(j, m, 26), 'Savings transfer', '1021', '1020', 500);
      einfach(tag(j, m, 28), 'Credit card statement', '2110', '1020', r2(karte.reduce((s, x) => s + x, 0)));
    }
    einfach(tag(j, 12 > ende[j] ? ende[j] : 12, 15), 'Bonus ' + j, '1020', '3100', 2500);
  });

  const klon = o => JSON.parse(JSON.stringify(o));
  return {
    typ: 'buchhaltung', version: 5, mandant: 'Test Person', jahr: 2026, waehrung: 'CHF',
    kurse: { USD: 0.88, EUR: 0.94 }, einstellungen: klon(VORLAGE.einstellungen || {}),
    sektionen: klon(VORLAGE.sektionen), titel: klon(VORLAGE.titel), buckets: klon(VORLAGE.buckets),
    gruppen: klon(VORLAGE.gruppen), konten: klon(VORLAGE.konten), buchungen: buchungen,
    vergleichsjahre: [], abgeschlossen: [], ui: { tab: 'uebersicht', periode: 'J', ytd: false, vergleich: 'start' }
  };
}
if (typeof module !== 'undefined'){
  module.exports = makeFixture;
  if (require.main === module){
    const fs = require('fs'), path = require('path'), vm = require('vm');
    const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
    const src = html.match(/<script id="vorlage">([\s\S]*?)<\/script>/)[1];
    const ctx = {}; vm.runInNewContext(src, ctx);
    process.stdout.write(JSON.stringify(makeFixture(ctx.VORLAGE), null, 1) + '\n');
  }
}
