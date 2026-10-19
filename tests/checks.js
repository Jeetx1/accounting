/* The interface checks, driven only through the DOM (the app runs inside one closure).
   Shared by tests/test_app.js (jsdom, CI) and a plain browser run, so they can be tried by hand too.
   env: { w, d, sleep(ms), check(cond, msg), openJson(text, name), lastBlob() -> {text, bin} of the last file written } */
'use strict';
async function runChecks(env, fixture){
  const { w, d, sleep, check } = env;
  const $ = s => d.querySelector(s), $$ = s => Array.prototype.slice.call(d.querySelectorAll(s));
  const fire = (el, typ, init) => el.dispatchEvent(typ === 'keydown' ? new w.KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, init))
                                                                      : new w.Event(typ, { bubbles: true }));
  const tippe = (sel, wert) => { const el = $(sel); el.focus(); el.value = wert; fire(el, 'input'); return el; };
  const tab = async id => { $('#nav button[data-tab="' + id + '"]').click(); await sleep(40); };
  const zeilen = xml => (xml.match(/<row /g) || []).length;
  const teile = b => {   // rows a booking gets in the flat Excel: one per split part, else one
    const soll = b.z.filter(z => (z[1] || 0) > (z[2] || 0)), haben = b.z.filter(z => (z[2] || 0) > (z[1] || 0));
    const einzel = soll.length === 1 && haben.length === 1 && !soll[0][5] && !haben[0][5];
    return einzel ? 1 : (soll.length === 1 ? haben.length : (haben.length === 1 ? soll.length : soll.length + haben.length));
  };

  /* 1. start screen and the neutral template */
  check($('#start').classList.contains('on'), 'start screen is shown');
  check(!!$('#s-oeffnen') && !!$('#s-neu'), 'start offers open and new');
  const V = w.VORLAGE;
  check(V && V.mandant === 'Your name', 'template owner is neutral ("Your name")');
  check(V && V.konten.length > 60, 'template has a chart of accounts');
  const nrn = V ? V.konten.map(k => k[0]) : [];
  check(V && ['ara', 'araJahr', 'pra', 'praJahr', 'gewinnvortrag', 'kursgewinn', 'kursverlust'].every(k => nrn.indexOf(V.einstellungen[k]) >= 0),
    'every account named in the template settings exists');
  check(['1020', '6810', '6815'].every(n => nrn.indexOf(n) >= 0), 'accounts the code falls back to exist (1020, 6810, 6815)');

  /* 2. open the synthetic file */
  await env.openJson(JSON.stringify(fixture), 'fixture.json');
  await sleep(60);
  check($('#shell').classList.contains('on'), 'app opens after loading the JSON');
  check($('#mandant').value === 'Test Person', 'owner from the file');

  /* 3. every page renders */
  const seiten = $$('#nav button').map(b => b.dataset.tab);
  check(seiten.length >= 15, 'navigation has all pages (' + seiten.length + ')');
  for (const id of seiten){
    await tab(id);
    const p = $('#p-' + id);
    check(p && p.classList.contains('on') && p.textContent.trim().length > 0, 'page ' + id + ' renders');
  }

  /* 4. journal: months, one row per booking, split parts below */
  await tab('journal');
  const im2026 = fixture.buchungen.filter(b => b.datum.slice(0, 4) === '2026');
  check($$('#jo-liste details.monat').length === 10, '10 months in the 2026 journal');
  const maerz = $('#jo-liste details[data-monat="2026-03"]');
  check(maerz && maerz.querySelectorAll('tbody').length === im2026.filter(b => b.datum.slice(0, 7) === '2026-03').length, 'March: one block per booking');
  check(maerz && maerz.querySelectorAll('tr.teilz').length === 2, 'March: the split booking shows its two parts');

  /* 5. journal exports: flat Excel with a filter, landscape PDF */
  $('#jo-xlsx').click(); await sleep(30);
  let x = await env.lastBlob();
  check(x.bin.slice(0, 2) === 'PK', 'journal Excel is an xlsx (zip)');
  check(/<autoFilter ref="A1:J\d+"\/>/.test(x.bin), 'journal Excel has a filter on the header');
  check(zeilen(x.bin) === 1 + im2026.reduce((s, b) => s + teile(b), 0), 'journal Excel: header plus one row per booking or split part, no blank or total rows');
  check(/<c r="A2" s="11"><v>\d+<\/v><\/c>/.test(x.bin), 'journal Excel: dates are real dates');
  const pdfKnopf = $('#jo-liste [data-jopdf="2026-03"]');
  pdfKnopf.click(); await sleep(30);
  const bericht = $('#bericht');
  check(/size:A4 landscape/.test(bericht.innerHTML), 'journal PDF is landscape');
  check(bericht.querySelectorAll('table.linie').length === 1 && /Weekend trip/.test(bericht.textContent), 'journal PDF: March with its bookings');

  /* 6. ledger exports */
  await tab('hauptbuch');
  const zeit = $('#hb-export-zeit');
  check(zeit && zeit.options.length === 13, 'ledger export: full year and twelve months');
  zeit.value = ''; $('#hb-xlsx').click(); await sleep(30);
  x = await env.lastBlob();
  const auf1020 = im2026.reduce((s, b) => s + b.z.filter(z => z[0] === '1020').length, 0);
  check(/<autoFilter ref="A1:I\d+"\/>/.test(x.bin), 'ledger Excel has a filter on the header');
  check(zeilen(x.bin) === 2 + auf1020, 'ledger Excel: header, opening balance and every entry on 1020 (' + auf1020 + ')');
  $('#hb-pdf').click(); await sleep(30);
  check(/Ledger 1020/.test($('#bericht').textContent) && /landscape/.test($('#bericht').innerHTML), 'ledger PDF, landscape');

  /* 7. book: text suggestion, ready state, the booking lands in the latest list */
  await tab('buchen');
  tippe('#bu-datum', '14.10.2026');
  const text = tippe('#bu-text', 'Super');
  fire(text, 'keydown', { key: 'ArrowDown' }); await sleep(10);
  const vorschlag = $('.liste.texte');
  check(vorschlag && /Supermarket, groceries/.test(vorschlag.textContent), 'typing proposes earlier booking texts');
  fire(text, 'keydown', { key: 'Enter' }); await sleep(10);
  check(text.value === 'Supermarket, groceries', 'Enter takes the proposed text');
  tippe('#bu-text', 'Test booking from the tests');
  tippe('#bu-betrag', '123.45');
  fire(tippe('#bu-soll', '4000'), 'keydown', { key: 'Tab' });    // Tab picks the account from the list
  fire(tippe('#bu-haben', '1020'), 'keydown', { key: 'Tab' });
  await sleep(10);
  check(/Balance/.test($('#bu-verlauf-saldo').textContent), 'picking an account shows its balance in the recent panel');
  check(!$('#bu-ok').disabled && $('#bu-ok').classList.contains('bereit'), 'Book button is active and marked ready');
  $('#bu-ok').click(); await sleep(60);
  const erste = $('#bu-letzte tbody');
  check(erste && /Test booking from the tests/.test(erste.textContent), 'new booking is first in Latest bookings');
  check(/Recent on 1020/.test($('#bu-verlauf-titel').textContent) && /Balance/.test($('#bu-verlauf-saldo').textContent), 'after booking, the recent panel stays on the last account with its balance');

  /* 8. save: the file has the new booking and nothing else changed */
  $('#speichern').click(); await sleep(120);
  x = await env.lastBlob();
  let gespeichert = null; try { gespeichert = JSON.parse(x.text); } catch (e) {}
  check(gespeichert && gespeichert.buchungen.length === fixture.buchungen.length + 1, 'saved file has one booking more');
  check(gespeichert && gespeichert.mandant === 'Test Person' && gespeichert.konten.length === fixture.konten.length, 'owner and chart of accounts kept');
  check(gespeichert && gespeichert.buchungen.some(b => b.text === 'Test booking from the tests' && b.datum === '2026-10-14'), 'the new booking is in the file');

  /* 9. spread over months, then open the original booking again and move its first month */
  const spreadText = 'Annual subscription from the tests';
  const spreadZeilen = async () => { await tab('journal'); const s = $('#jo-suche'); s.value = spreadText; fire(s, 'input'); await sleep(250);
    return $$('#jo-liste tbody').filter(tb => tb.textContent.indexOf(spreadText) >= 0); };
  await tab('buchen');
  tippe('#bu-datum', '15.03.2026'); tippe('#bu-text', spreadText); tippe('#bu-betrag', '120');
  fire(tippe('#bu-soll', '6620'), 'keydown', { key: 'Tab' }); fire(tippe('#bu-haben', '1020'), 'keydown', { key: 'Tab' });
  const an = $('#vt-an'); an.checked = true; fire(an, 'change');
  tippe('#vt-start', '2026-03'); tippe('#vt-monate', '12'); await sleep(10);
  check(/Book spread \(12 bookings\)/.test($('#bu-ok').textContent), 'spread over 12 months from March: base, 10 releases, carry-over');
  $('#bu-ok').click(); await sleep(60);
  let sz = await spreadZeilen();
  check(sz.length === 12, 'the spread is in the journal (12 bookings, got ' + sz.length + ')');
  const basisZeile = sz.find(tb => /Spread over 12 months/.test(tb.textContent));
  basisZeile.querySelector('tr').click(); await sleep(60);
  check($('#vt-an').checked && $('#vt-start').value === '2026-03' && $('#vt-monate').value === '12', 'the original booking opens with its spread plan');
  check(/^6620/.test($('#bu-soll').value) && $('#bu-betrag').value === '120.00', 'it opens as entered: expense account and amount, not the accrual account');
  tippe('#vt-start', '2026-05'); await sleep(10);
  check(/Save and spread anew \(10 bookings\)/.test($('#bu-ok').textContent), 'moving the first month to May: base, 8 releases, carry-over');
  $('#bu-ok').click(); await sleep(60);
  sz = await spreadZeilen();
  check(sz.length === 10, 'the old spread is replaced, not added to (10 bookings, got ' + sz.length + ')');
  const uebertrag = sz.find(tb => /carried into 2027/.test(tb.textContent));
  check(uebertrag && /40\.00/.test(uebertrag.textContent), 'four months (40.00) carried into 2027');
}
if (typeof module !== 'undefined') module.exports = runChecks;
