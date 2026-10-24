/* Interface tests for EVEN (accounting) in jsdom. The steps live in tests/checks.js (shared with a browser run);
   the data is the synthetic file from tests/make_fixture.js. The clock is frozen at 14.10.2026 10:00.
   Usage: node tests/test_app.js [path to a real data .json for an extra open + save round trip]          */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const makeFixture = require('./make_fixture');
const runChecks = require('./checks');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'docs/index.html'), 'utf8');
const FIXED = new Date(2026, 9, 14, 10, 0, 0).getTime();

let ok = 0, bad = 0;
const check = (cond, msg) => { if (cond) ok++; else { bad++; console.log('FAIL  ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(){
  const errors = [], blobs = [], names = [];
  const vc = new VirtualConsole();
  /* jsdom cannot parse some modern CSS of the Design Lab kit: not an app error */
  vc.on('jsdomError', e => { if (!/Not implemented|Could not parse CSS stylesheet/.test(e.message)) errors.push(e.message); });
  const dom = new JSDOM(HTML, {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w){
      const D = w.Date;
      class FakeDate extends D { constructor(...a){ if (a.length) super(...a); else super(FIXED); } static now(){ return FIXED; } }
      w.Date = FakeDate;
      /* jsdom has no TextEncoder/TextDecoder; the Excel writer needs them */
      if (!w.TextEncoder){ const u = require('util'); w.TextEncoder = u.TextEncoder; w.TextDecoder = u.TextDecoder; }
      w.matchMedia = q => ({ matches: false, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
      /* canvas: a context that accepts every call, so the background can draw */
      const ctx = new Proxy({}, { get: (t, k) => k === 'canvas' ? {} : (k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) :
        (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
      w.HTMLCanvasElement.prototype.getContext = () => ctx;
      w.URL.createObjectURL = b => { blobs.push(b); return 'blob:test/' + blobs.length; };
      w.URL.revokeObjectURL = () => {};
      w.print = () => {};
      w.scrollTo = () => {};
      w.HTMLAnchorElement.prototype.click = function(){ if (this.download) names.push(this.download); };
      w.HTMLElement.prototype.scrollIntoView = function(){};
    }
  });
  return { dom, w: dom.window, d: dom.window.document, errors, blobs, names };
}
/* jsdom's Blob has no text()/arrayBuffer(): read it with the window's FileReader */
const readBlob = (env, b, bin) => new Promise((res, rej) => { const fr = new env.w.FileReader();
  fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); bin ? fr.readAsBinaryString(b) : fr.readAsText(b); });

function harness(env){
  return {
    w: env.w, d: env.d, sleep, check,
    /* no File System Access API in jsdom: the app opens through the hidden file input */
    async openJson(text, name){
      env.d.getElementById('s-oeffnen').click(); await sleep(30);
      const inp = env.d.getElementById('dateiwahl');
      Object.defineProperty(inp, 'files', { configurable: true, value: [{ name, text: () => Promise.resolve(text) }] });
      inp.onchange(); await sleep(60);
    },
    async lastBlob(){
      const b = env.blobs[env.blobs.length - 1];
      if (!b) return { text: '', bin: '' };
      return { text: await readBlob(env, b), bin: await readBlob(env, b, true) };
    }
  };
}

(async () => {
  const env = boot(); await sleep(50);
  const fixture = makeFixture(env.w.VORLAGE);
  await runChecks(harness(env), fixture);

  /* optional: a real data file (private/, never in the repository): open, every page, save, nothing lost */
  const real = process.argv[2];
  if (real && fs.existsSync(real)){
    const env2 = boot(); await sleep(50);
    const txt = fs.readFileSync(real, 'utf8'), rd = JSON.parse(txt), h = harness(env2);
    await h.openJson(txt, path.basename(real));
    for (const b of env2.d.querySelectorAll('#nav button')){ b.click(); await sleep(30); }
    env2.d.getElementById('speichern').click(); await sleep(400);
    const back = await h.lastBlob();
    let rs = null; try { rs = JSON.parse(back.text); } catch (e) {}
    check(rs && rs.buchungen.length === rd.buchungen.length, 'real data: every booking survives open + save (' + rd.buchungen.length + ')');
    check(rs && rs.konten.length === rd.konten.length, 'real data: chart of accounts unchanged');
    env.errors.push(...env2.errors);
  }

  /* Design Lab remodel (24.10.2026): KPI cards, the look in the file, file names, build version, donuts, net worth dots */
  {
    const e3 = boot(); await sleep(50); const h3 = harness(e3), d = e3.d, $ = s => d.querySelector(s), $$ = s => Array.from(d.querySelectorAll(s));
    const fx = makeFixture(e3.w.VORLAGE);
    /* three fixed assets on the books, registered */
    fx.buchungen.push({ id: 'fa1', datum: '2025-03-10', beleg: '', text: 'Laptop', z: [['1500', 2400, 0], ['1020', 0, 2400]] },
                      { id: 'fa2', datum: '2026-02-15', beleg: '', text: 'Sofa', z: [['1510', 3200, 0], ['1020', 0, 3200]] });
    fx.anlagen = [{ id: 'a1', text: 'Laptop', konto: '1500', aufwand: '6800', datum: '2025-03-10', start: '2025-03', monate: 36, kosten: 2400, restwert: 0 },
                  { id: 'a2', text: 'Sofa', konto: '1510', aufwand: '6800', datum: '2026-02-15', start: '2026-02', monate: 60, kosten: 3200, restwert: 0 }];
    fx.settings = { theme: 'glass' };
    await h3.openJson(JSON.stringify(fx), '2026-10-01_EVEN.json'); await sleep(120);
    for (let k = 0; k < 2; k++){ const q = $('#dlg-frage.on #fr-knoepfe button'); if (q){ q.click(); await sleep(60); } }
    check(d.documentElement.dataset.theme === 'glass', 'opening a file applies its look');
    const tab = async id => { $('#nav button[data-tab="' + id + '"]').click(); await sleep(60); };
    await tab('uebersicht');
    const kpis = $$('#ue-leiste .kpi');
    check(kpis.map(k => k.querySelector('.kpi__label').textContent).join('|') === 'Income|Expenses|Result|Equity ratio|Operating cash flow|Free cash flow', 'Overview: six KPI cards (' + kpis.length + ')');
    check(kpis.every(k => k.querySelector('svg.spark')), 'every KPI card has its line');
    check(kpis.slice(0, 3).every(k => / vs 2025$/.test((k.querySelector('.delta') || {}).textContent || '')), 'income, expenses, result compared with 2025');
    check(!$('#ue-leiste .delta--down'), 'no red deltas');
    const ex = kpis[1] && kpis[1].querySelector('.delta');
    check(ex && (ex.textContent.charAt(0) === '+' ? ex.classList.contains('delta--flat') : ex.classList.contains('delta--up')), 'lower expenses count as better, higher as neutral');
    /* the look: never an unsaved change, written into the file */
    e3.w.Kit.set('ember', 'user'); await sleep(40);
    check($('#speichern').textContent.trim() === 'Saved', 'changing the look is not an unsaved change');
    $('#speichern').click(); await sleep(400);
    const saved = JSON.parse((await h3.lastBlob()).text || '{}');
    check(saved.settings && saved.settings.theme === 'ember', 'the look is written into the data file');
    check(e3.names[e3.names.length - 1] === '2026-10-14_EVEN.json', 'data file named YYYY-MM-DD_EVEN.json (got ' + e3.names[e3.names.length - 1] + ')');
    $('#dmenu [data-aktion="kopie"]').click(); await sleep(400);
    check(e3.names[e3.names.length - 1] === '2026-10-14_EVEN COPY.json', 'dated copy named YYYY-MM-DD_EVEN COPY.json (got ' + e3.names[e3.names.length - 1] + ')');
    const ver = $('meta[name="build"]').getAttribute('content');
    check(/^\d{4}-\d\d-\d\d\.\d+$/.test(ver) && $('#buildzeile').textContent === 'EVEN · build ' + ver, 'file menu shows the build version ' + ver);
    check(!e3.w.Kit.isOn('ledger') && !/fx-ledger/.test(d.documentElement.innerHTML), 'no ledger lines');
    /* fixed assets: a donut that turns, one slice per asset */
    await tab('sachanlagen');
    check($$('#saDonut .dreh .seg').length === 2 && $$('#saDonutListe .z').length === 2, 'fixed assets: donut with one slice per asset');
    e3.dom.window.close();
  }
  {
    /* Overview (Years): more than 40 months of reports: the net worth line keeps only the latest dot */
    const e4 = boot(); await sleep(50); const h4 = harness(e4), d = e4.d, $ = s => d.querySelector(s);
    const fx = makeFixture(e4.w.VORLAGE);
    for (let j = 2021; j <= 2024; j++) for (let m = 1; m <= 12; m++){ const t = j + '-' + String(m).padStart(2, '0') + '-25';
      fx.buchungen.push({ id: 'x' + j + m, datum: t, beleg: '', text: 'Salary', z: [['1020', 5000, 0], ['3000', 0, 5000]] }); }
    await h4.openJson(JSON.stringify(fx), 'long.json'); await sleep(120);
    for (let k = 0; k < 2; k++){ const q = $('#dlg-frage.on #fr-knoepfe button'); if (q){ q.click(); await sleep(60); } }
    $('#nav button[data-tab="ueberjahre"]').click(); await sleep(150);
    const dots = d.querySelectorAll('#ovLine circle:not(.ovdot)').length;
    check(dots <= 1, 'net worth line with many months: no row of beads (' + dots + ' dots)');
    e4.dom.window.close();
  }

  check(env.errors.length === 0, 'no script errors' + (env.errors.length ? ': ' + env.errors.slice(0, 3).join(' | ') : ''));
  console.log((bad ? 'FAILED ' : 'OK ') + ok + ' of ' + (ok + bad) + ' checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
