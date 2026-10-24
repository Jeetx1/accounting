/* Design Lab · smoke test for any built file (templates, remodels, new tools).
   node smoke.js "<file.html>" [shots_dir]

   Checks, per theme (Glass, Ember, Prism):
   - no page errors, theme applies, its signature-effect classes (html.fx-*) are on
   - switching the look never marks the data as unsaved (.is-dirty)
   - the page still works with reduced motion and with the effects module removed
   Writes desktop (1280) + phone (390) screenshots per theme into shots_dir. */
let pw; try { pw = require('playwright'); } catch (e){ pw = require('/opt/npm-tools/node_modules/playwright'); }
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2] || '');
const OUT = process.argv[3] || path.join(path.dirname(FILE), 'shots');
if (!fs.existsSync(FILE)){ console.error('usage: node smoke.js <file.html> [shots_dir]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + FILE, NAME = path.basename(FILE, '.html').replace(/\s+/g, '_');
const THEMES = ['glass', 'ember', 'prism'];
const setTheme = id => { if (window.Kit && Kit.set) return Kit.set(id, 'user'); if (window.DL && DL.setTheme) return DL.setTheme(id, 'user'); };
const state = () => ({ theme: document.documentElement.dataset.theme,
  fx: Array.from(document.documentElement.classList).filter(c => c.indexOf('fx-') === 0),
  dirty: !!document.querySelector('.is-dirty') });

(async () => {
  const b = await pw.chromium.launch(), fails = [];
  async function page(opts, label){
    const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    /* a theme's effects module that fails is caught by the kit (the tool keeps working) but must not pass unnoticed */
    p.on('console', m => { if (/Effects module failed/.test(m.text())) errs.push('effects module failed: ' + m.text().slice(0, 200)); });
    await p.route('**/fonts.googleapis.com/**', r => r.abort());
    await p.route('**/fonts.gstatic.com/**', r => r.abort());
    return { ctx, p, errs, label };
  }
  // 1) every theme, desktop + phone
  for (const [vp, tag] of [[{ width: 1280, height: 900 }, 'desktop'], [{ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'phone']]){
    const { ctx, p, errs } = await page({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 }, tag);
    await p.goto(URL); await p.waitForTimeout(900);
    const dirty0 = (await p.evaluate(state)).dirty;
    for (const t of THEMES){
      await p.evaluate(setTheme, t); await p.waitForTimeout(1300);
      const s = await p.evaluate(state);
      const ok = s.theme === t && s.fx.length > 0 && s.dirty === dirty0;
      console.log(`${tag.padEnd(7)} ${t.padEnd(6)} theme=${s.theme} fx=[${s.fx.join(' ')}] unsavedChanged=${s.dirty !== dirty0} ${ok ? 'OK' : 'FAIL'}`);
      if (!ok) fails.push(`${tag}/${t}: theme=${s.theme} fx=${s.fx.length} dirty ${dirty0}->${s.dirty}`);
      await p.screenshot({ path: path.join(OUT, `${NAME}_${tag}_${t}.png`) });
    }
    if (errs.length) fails.push(`${tag} errors: ` + errs.join(' | '));
    await ctx.close();
  }
  // 2) reduced motion
  { const { ctx, p, errs } = await page({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
    await p.goto(URL); await p.waitForTimeout(600);
    for (const t of THEMES){ await p.evaluate(setTheme, t); await p.waitForTimeout(300); }
    console.log('reduced motion:', errs.length ? 'FAIL ' + errs.join(' | ') : 'OK');
    if (errs.length) fails.push('reduced motion: ' + errs.join(' | '));
    await ctx.close(); }
  // 3) effects modules removed: the tool must work the same
  { const { ctx, p, errs } = await page({ viewport: { width: 1280, height: 900 } });
    await p.addInitScript(() => { const k = setInterval(() => { if (window.DL_THEMES) Object.values(window.DL_THEMES).forEach(x => { try { Object.defineProperty(x, 'fx', { get: () => null, set(){}, configurable: true }); } catch (e){} }); }, 0); setTimeout(() => clearInterval(k), 3000); });
    await p.goto(URL); await p.waitForTimeout(600);
    for (const t of THEMES){ await p.evaluate(setTheme, t); await p.waitForTimeout(300); }
    const s = await p.evaluate(state);
    console.log('no effects modules:', errs.length ? 'FAIL ' + errs.join(' | ') : 'OK', 'theme=' + s.theme);
    if (errs.length) fails.push('no effects: ' + errs.join(' | '));
    await ctx.close(); }
  await b.close();
  console.log(fails.length ? '\nFAILED:\n- ' + fails.join('\n- ') : '\nALL CHECKS PASSED · screenshots in ' + OUT);
  process.exit(fails.length ? 1 : 0);
})();
