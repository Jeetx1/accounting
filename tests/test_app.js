/* Interface tests for the Accounting app in jsdom. The steps live in tests/checks.js (shared with a browser run);
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
  const errors = [], blobs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
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
      w.HTMLAnchorElement.prototype.click = function(){};
      w.HTMLElement.prototype.scrollIntoView = function(){};
    }
  });
  return { dom, w: dom.window, d: dom.window.document, errors, blobs };
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

  check(env.errors.length === 0, 'no script errors' + (env.errors.length ? ': ' + env.errors.slice(0, 3).join(' | ') : ''));
  console.log((bad ? 'FAILED ' : 'OK ') + ok + ' of ' + (ok + bad) + ' checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
