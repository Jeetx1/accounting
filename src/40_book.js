/* =====================================================================
   BOOK
   ===================================================================== */
let entwurf = null, bearbeitet = null, letztesDatum = null, vtAn = false, bucht = false, fokusKonto = null;
const leereSplit = (b, t) => ({k:"", b:b||"", t:t||"", fw:"", kurs:""});
const leereZeile = () => ({k:"", s:"", h:"", t:"", fw:"", kurs:""});
const WT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function startDatum(){
  const h = heute();
  if(letztesDatum && letztesDatum.slice(0,4) === String(state.jahr)) return letztesDatum;
  return h.slice(0,4) === String(state.jahr) ? h : state.jahr+"-01-01";
}
function neuerEntwurf(behalte){
  entwurf = {modus:"schnell", datum: behalte ? startDatum() : startDatum(), text:"", betrag:"", soll:"", haben:"",
             fw:"", kurs:"", splitAktiv:false, split:[], z:[leereZeile(), leereZeile()]};
  bearbeitet = null; vtAn = false;
  const vs = $("#vt-start"); if(vs){ vs.value = ""; delete vs.dataset.manuell; }
}
function zahlFmt(n){ return isFinite(n) ? betrag(E.r2(n)) : ""; }

/* ---------- Loading and copying -------------------------------------- */
function entwurfAusBuchung(b){
  const soll = b.z.filter(z=>(z[1]||0) > 0 && !(z[2]||0)), haben = b.z.filter(z=>(z[2]||0) > 0 && !(z[1]||0));
  const sauber = soll.length + haben.length === b.z.length;
  const e = {modus:"zeilen", datum:b.datum, text:b.text||"", betrag:"", soll:"", haben:"", fw:"", kurs:"", splitAktiv:false, split:[],
    z:b.z.map(z=>({k:z[0], s:z[1]?zahlFmt(z[1]):"", h:z[2]?zahlFmt(z[2]):"", t:z[5]||"", fw:z[3]?zahlFmt(z[3]):"", kurs:z[4]?String(z[4]):""}))};
  if(!sauber || b.eb) return e;
  const fwVon = z => z && z[3] ? {fw:zahlFmt(z[3]), kurs:String(z[4])} : null;
  if(soll.length === 1 && haben.length === 1 && Math.abs(soll[0][1]-haben[0][2]) < .005 && !soll[0][5] && !haben[0][5]){
    const fx = fwVon(soll[0]) || fwVon(haben[0]) || {fw:"", kurs:""};
    return Object.assign(e, {modus:"schnell", betrag:zahlFmt(soll[0][1]), soll:soll[0][0], haben:haben[0][0], fw:fx.fw, kurs:fx.kurs});
  }
  const einzeln = soll.length === 1 ? "soll" : (haben.length === 1 ? "haben" : null);
  if(einzeln){
    const haupt = einzeln === "soll" ? soll[0] : haben[0], rest = einzeln === "soll" ? haben : soll;
    const summe = E.r2(rest.reduce((a,z)=>a+(z[1]||0)+(z[2]||0),0)), total = (haupt[1]||0)+(haupt[2]||0);
    if(Math.abs(summe-total) < .005){
      const fx = fwVon(haupt) || {fw:"", kurs:""};
      return Object.assign(e, {modus:"schnell", betrag:zahlFmt(total), soll: einzeln==="soll" ? haupt[0] : "", haben: einzeln==="haben" ? haupt[0] : "",
        fw:fx.fw, kurs:fx.kurs, splitAktiv:true,
        split:rest.map(z=>({k:z[0], b:zahlFmt((z[1]||0)+(z[2]||0)), t:z[5]||b.text||"", fw:z[3]?zahlFmt(z[3]):"", kurs:z[4]?String(z[4]):""}))});
    }
  }
  return e;
}
// The base booking of a spread as it was entered: the accrual line(s) replaced by the expense or income
// accounts of the plan, so it can be spread anew (other first month, months, amount or accounts).
function urBuchung(b){
  if(!b || !b.plan || b.plan.rolle !== "basis") return null;
  const ein = Object.assign({}, state.einstellungen||{}), abgr = [ein.ara, ein.araJahr, ein.pra, ein.praJahr].filter(Boolean);
  let konten = b.plan.konten && typeof b.plan.konten === "object" ? b.plan.konten : null;
  if(!konten){   // older spreads: the split per account from the releases booked so far
    const total = E.r2(b.z.reduce((a,z)=> abgr.indexOf(z[0]) >= 0 ? a + (z[1]||0) - (z[2]||0) : a, 0));
    const summe = {}; let gesamt = 0;
    state.buchungen.filter(x=> x.plan && x.plan.id === b.plan.id && x.plan.rolle === "aufloesung").forEach(x=> x.z.forEach(z=>{
      if(E.istER(E.grp(ix, z[0]))){ const v = E.r2((z[1]||0)-(z[2]||0)); summe[z[0]] = E.r2((summe[z[0]]||0) + v); gesamt = E.r2(gesamt + v); } }));
    if(!gesamt) return null;
    konten = {}; Object.keys(summe).forEach(k=> konten[k] = E.r2(total * summe[k] / gesamt));
  }
  const z = b.z.filter(x=> abgr.indexOf(x[0]) < 0).map(x=> x.slice());
  Object.keys(konten).forEach(k=>{ const a = E.r2(konten[k]); if(a > 0) z.push([k, a, 0]); else if(a < 0) z.push([k, 0, -a]); });
  const s = E.r2(z.reduce((a,x)=> a + (x[1]||0) - (x[2]||0), 0));
  if(Math.abs(s) >= .005 || !z.some(x=> ix.km[x[0]] && E.istER(E.grp(ix, x[0])))) return null;
  return {datum:b.datum, beleg:b.beleg||"", text:b.plan.text || b.text || "", z:z};
}
function ladeEntwurf(id){
  const b = state.buchungen.find(x=>x.id===id); if(!b) return;
  bearbeitet = id; vtAn = false;
  const ur = urBuchung(b);
  entwurf = entwurfAusBuchung(ur || b); entwurf.eb = !!b.eb; entwurf.plan = b.plan || null;
  if(ur){   // a spread: open with the spread switched on and its plan filled in
    entwurf.neuVerteilen = true; vtAn = true;
    $("#vt-start").value = b.plan.start || b.datum.slice(0,7); $("#vt-start").dataset.manuell = "1";
    $("#vt-monate").value = b.plan.monate || 12;
  }
  zeigeTab("buchen");
}
function kopiereBuchung(id){
  const b = state.buchungen.find(x=>x.id===id); if(!b) return;
  const datum = (entwurf && E.istDatum(entwurf.datum)) ? entwurf.datum : startDatum();
  entwurf = entwurfAusBuchung(urBuchung(b) || b); entwurf.datum = datum; delete entwurf.eb; delete entwurf.plan;
  bearbeitet = null; vtAn = false;
  if(state.ui.tab !== "buchen") zeigeTab("buchen"); else renderBuchen();
  const t = $("#bu-text"); if(t){ t.focus(); t.select && t.select(); }
  meldung("Copied. Adjust the date and text, then book.");
}
function alsKopie(){ if(bearbeitet) kopiereBuchung(bearbeitet); }
function naechsteId(){
  const ids = new Set(state.buchungen.map(b=>b.id));
  let n = state.buchungen.reduce((a,b)=>Math.max(a, parseInt(String(b.id).replace(/\D/g,""),10)||0), 0) + 1;
  while(ids.has("b"+String(n).padStart(4,"0"))) n++;
  return "b"+String(n).padStart(4,"0");
}

/* ---------- Account search ------------------------------------------- */
const norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
// the one open drop-down list; a touch or click outside its field closes it
let offeneListe = null;
document.addEventListener("pointerdown", e=>{ if(offeneListe && !offeneListe.box.contains(e.target)){ const o = offeneListe; offeneListe = null; o.zu(); } }, true);
// keep the active entry in view without scrolling the page
// a list wider than its field: shift it left so it stays inside the window
function listeEinpassen(liste){
  liste.style.left = "";
  const r = liste.getBoundingClientRect(), rand = 8, zuviel = r.right - (document.documentElement.clientWidth - rand);
  if(zuviel > 0) liste.style.left = (-Math.min(zuviel, r.left - rand))+"px";
}
function listeSichtbar(liste){
  const on = liste.querySelector(".on"); if(!on) return;
  if(on.offsetTop < liste.scrollTop) liste.scrollTop = on.offsetTop - 4;
  else if(on.offsetTop + on.offsetHeight > liste.scrollTop + liste.clientHeight) liste.scrollTop = on.offsetTop + on.offsetHeight - liste.clientHeight + 4;
}
function kontoWahl(input, beiWahl, aktuell){
  let liste = null, treffer = [], aktiv = 0, getippt = false;
  const box = input.parentNode;
  function zu(){ if(liste){ liste.remove(); liste = null; } }
  function suche(){
    const roh = getippt ? input.value.trim() : "";
    const erstes = roh.split(/\s+/)[0];
    const q = /^\d[\d.]*$/.test(erstes) ? erstes : roh, qn = norm(q);
    let alle = kontenSortiert();
    if(q){
      const a = alle.filter(k=>k.nr.indexOf(q) === 0);
      const b = alle.filter(k=>k.nr.indexOf(q) !== 0 && (norm(k.name).indexOf(qn) >= 0 || norm((ix.gm[k.grp]||{}).t).indexOf(qn) >= 0));
      alle = a.concat(b);
    }
    return alle.slice(0, getippt ? 60 : 400);
  }
  function zeichne(){
    treffer = suche();
    if(!getippt){ const jetzt = aktuell ? aktuell() : ""; const i = treffer.findIndex(k=>k.nr===jetzt); aktiv = i >= 0 ? i : 0; }
    aktiv = Math.min(aktiv, Math.max(0, treffer.length-1));
    if(!liste){ liste = document.createElement("div"); liste.className = "liste"; liste.setAttribute("role","listbox"); box.appendChild(liste); listeEinpassen(liste); }
    const bis = periodeAktiv().bis, s = E.saldoPer(state, bis);
    liste.innerHTML = treffer.length ? treffer.map((k,i)=>{
      const g = ix.gm[k.grp], v = g && g.s === "P" ? -(s[k.nr]||0) : (s[k.nr]||0);
      return `<button type="button" role="option" tabindex="-1" data-i="${i}" class="${i===aktiv?"on":""}"><span class="nr">${esc(k.nr)}</span>
        <span>${esc(k.name)}${k.wkz?` <span class="chip">${esc(k.wkz)}</span>`:""}</span><span class="num mut klein">${f(v)}</span>
        <span class="g">${esc(g?g.t:"")}</span></button>`; }).join("")
      : `<div class="leer">No account found. Add it under Accounts.</div>`;
    Array.prototype.forEach.call(liste.querySelectorAll("button"), b=>{
      // mouse: choose at once; touch: only a tap (click) chooses, so the list can be scrolled with the finger
      b.addEventListener("pointerdown", e=>{ if(e.pointerType === "mouse"){ e.preventDefault(); waehle(+b.dataset.i); } });
      b.addEventListener("click", e=>{ e.preventDefault(); waehle(+b.dataset.i); });
    });
    listeSichtbar(liste);
    offeneListe = {box:box, zu:zu};
  }
  function waehle(i){ if(!liste) return; const k = treffer[i]; if(!k) return; zu(); getippt = false; beiWahl(k); }
  input.addEventListener("focus", ()=>{ getippt = false; zeichne(); if(input.select) input.select(); });
  input.addEventListener("pointerdown", ()=>{ if(document.activeElement === input && !liste){ getippt = false; zeichne(); } });
  input.addEventListener("input", ()=>{ getippt = true; aktiv = 0; zeichne(); });
  input.addEventListener("blur", ()=> setTimeout(()=>{ if(!(liste && liste.dataset.touch)) zu(); }, 120));
  // a finger on the list (scrolling it) must not close it; a touch outside closes it (see offeneListe)
  box.addEventListener("touchstart", e=>{ if(liste && liste.contains(e.target)) liste.dataset.touch = "1"; }, {passive:true});
  input.addEventListener("keydown", e=>{
    if(e.key === "ArrowDown"){ if(!liste) zeichne(); e.preventDefault(); aktiv = Math.min(aktiv+1, treffer.length-1); zeichne(); return; }
    if(e.key === "ArrowUp"){ if(!liste) return; e.preventDefault(); aktiv = Math.max(aktiv-1, 0); zeichne(); return; }
    if(!liste) return;
    if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); zu(); return; }
    const roh = input.value.trim();
    if(e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)){
      if(!getippt){ zu(); return; }                              // nothing typed: keep the current account
      if(!roh){ zu(); beiWahl(null); return; }                    // field emptied on purpose
      const exakt = treffer.findIndex(k=>k.nr === roh.split(/\s+/)[0]);
      if(exakt >= 0){ if(e.key === "Enter") e.preventDefault(); e.__gewaehlt = true; waehle(exakt); return; }
      if(treffer.length){ if(e.key === "Enter") e.preventDefault(); e.__gewaehlt = true; waehle(aktiv); }
    }
  });
}
kontoWahl($("#hb-konto"), k=>{ if(!k) return; state.ui.hbKonto = k.nr; $("#hb-konto").value = k.nr+" "+k.name; renderHauptbuch(); }, ()=>state.ui.hbKonto);

/* ---------- Derived lines -------------------------------------------- */
function splitSeite(){
  const s = !!ix.km[entwurf.soll], h = !!ix.km[entwurf.haben];
  if(s && !h && !String(entwurf.haben||"").trim()) return "haben";
  if(h && !s && !String(entwurf.soll||"").trim()) return "soll";
  return null;
}
function betragWert(){ const v = E.betragAusEingabe(entwurf.betrag); return isFinite(v) ? E.r2(v) : NaN; }
function abgeleitet(){
  const D = [];
  if(entwurf.modus === "zeilen"){
    entwurf.z.forEach(z=>{
      const s = E.betragAusEingabe(z.s), h = E.betragAusEingabe(z.h);
      const x = {k:String(z.k||"").trim(), s:isFinite(s)?E.r2(Math.abs(s)):0, h:isFinite(h)?E.r2(Math.abs(h)):0, t:String(z.t||"").trim(),
        fw:E.betragAusEingabe(z.fw), kurs:E.zahl(z.kurs)};
      if(x.k || x.s || x.h) D.push(x);
    });
    return D;
  }
  const b = betragWert(), betr = isFinite(b) ? Math.abs(b) : 0;
  const fw = E.betragAusEingabe(entwurf.fw), kurs = E.zahl(entwurf.kurs);
  const sp = entwurf.splitAktiv ? splitSeite() : null;
  const haupt = (k, seite) => ({k:k, s:seite==="s"?betr:0, h:seite==="h"?betr:0, t:"", fw:fw, kurs:kurs});
  if(!sp){
    if(entwurf.soll || betr) D.push(haupt(entwurf.soll, "s"));
    if(entwurf.haben || betr) D.push(haupt(entwurf.haben, "h"));
    return D;
  }
  D.push(sp === "soll" ? haupt(entwurf.haben, "h") : haupt(entwurf.soll, "s"));
  entwurf.split.forEach(x=>{
    const v = E.betragAusEingabe(x.b), a = isFinite(v) ? E.r2(Math.abs(v)) : 0;
    if(!x.k && !a) return;
    const t = String(x.t||"").trim();
    D.push({k:String(x.k||"").trim(), s: sp==="soll" ? a : 0, h: sp==="haben" ? a : 0, t: t && t !== entwurf.text.trim() ? t : "",
      fw:E.betragAusEingabe(x.fw), kurs:E.zahl(x.kurs)});
  });
  return D;
}
function splitRest(){
  const b = betragWert(); if(!isFinite(b)) return NaN;
  return E.r2(Math.abs(b) - entwurf.split.reduce((a,x)=>{ const v = E.betragAusEingabe(x.b); return a + (isFinite(v) ? Math.abs(v) : 0); }, 0));
}

/* ---------- Checks ---------------------------------------------------- */
// a spread being booked anew runs in the year of its own booking date, under its plan id
function respread(){ return !!(bearbeitet && entwurf && entwurf.neuVerteilen); }
function vtStand(){ return respread() && E.istDatum(entwurf.datum) ? Object.assign({}, state, {jahr:parseInt(entwurf.datum.slice(0,4),10)}) : state; }
function verteilungsVorschau(D){
  if(!vtAn || (bearbeitet && !respread())) return null;
  return E.verteilung(vtStand(), ix, {id: respread() && entwurf.plan ? entwurf.plan.id : undefined, datum:entwurf.datum, text:entwurf.text,
    start:$("#vt-start").value, monate:$("#vt-monate").value, zeilen:D.filter(z=>ix.km[z.k]).map(z=>[z.k, z.s, z.h, 0, 0, z.t])});
}
// bookings of the spread being re-spread that lie in a closed year: then it cannot be booked anew
function respreadGesperrt(){
  if(!respread() || !entwurf.plan) return null;
  const b = state.buchungen.find(x=> x.plan && x.plan.id === entwurf.plan.id && istGeschlossen(String(x.datum).slice(0,4)));
  return b ? String(b.datum).slice(0,4) : null;
}
function pruefe(){
  const D = abgeleitet(), p = [];
  let soll = 0, haben = 0; D.forEach(z=>{ soll = E.r2(soll+z.s); haben = E.r2(haben+z.h); });
  const diff = E.r2(soll-haben);
  if(!E.istDatum(entwurf.datum)) p.push(["fehler","Enter a valid date.", "#bu-datum"]);
  else if(istGeschlossen(entwurf.datum.slice(0,4))) p.push(["fehler","The year "+entwurf.datum.slice(0,4)+" is closed. Reopen it under Years and closings to book in it.", "#bu-datum"]);
  else if(entwurf.datum.slice(0,4) !== String(state.jahr)) p.push(["warn","The date is outside the selected year "+state.jahr+"; the booking goes into "+entwurf.datum.slice(0,4)+"."]);
  const alt = bearbeitet ? state.buchungen.find(x=>x.id===bearbeitet) : null;
  if(alt && istGeschlossen(String(alt.datum).slice(0,4))) p.push(["fehler","This booking belongs to the closed year "+String(alt.datum).slice(0,4)+". You can copy it, but not change it."]);
  else if(respreadGesperrt()) p.push(["fehler","Part of this spread lies in the closed year "+respreadGesperrt()+", so it cannot be booked anew. Reopen that year first."]);
  if(entwurf.modus === "schnell"){
    const b = betragWert();
    if(String(entwurf.betrag).trim() === "") p.push(["fehler","Enter an amount.", "#bu-betrag"]);
    else if(!isFinite(b)) p.push(["fehler","The amount cannot be read.", "#bu-betrag"]);
    else if(b <= 0) p.push(["fehler","The amount must be positive; swap debit and credit instead.", "#bu-betrag"]);
    const ks = String(entwurf.soll||"").trim(), kh = String(entwurf.haben||"").trim();
    if(!ks && !kh) p.push(["fehler","Choose a debit and a credit account.", "#bu-soll"]);
    else if(ks && !ix.km[ks]) p.push(["fehler","Unknown debit account "+ks+".", "#bu-soll"]);
    else if(kh && !ix.km[kh]) p.push(["fehler","Unknown credit account "+kh+".", "#bu-haben"]);
    else if(!ks || !kh){
      if(!entwurf.splitAktiv) p.push(["fehler", !ks ? "Choose a debit account, or split the debit side." : "Choose a credit account, or split the credit side.", !ks ? "#bu-soll" : "#bu-haben"]);
      else {
        const rest = splitRest();
        entwurf.split.forEach((x,i)=>{ if(x.k && !ix.km[x.k]) p.push(["fehler","Unknown account "+x.k+" in split line "+(i+1)+".", `[data-sp="${i}"][data-f="k"]`]);
          else if(!x.k && isFinite(E.betragAusEingabe(x.b)) && E.betragAusEingabe(x.b)) p.push(["fehler","Split line "+(i+1)+" needs an account.", `[data-sp="${i}"][data-f="k"]`]); });
        if(isFinite(rest) && Math.abs(rest) >= .005) p.push(["fehler", rest > 0 ? "Still "+fz(rest)+" to split." : "The split lines exceed the amount by "+fz(-rest)+".", null]);
      }
    }
    if(ks && kh && ks === kh) p.push(["warn","Debit and credit are the same account."]);
  }else{
    const unbekannt = D.filter(z=>z.k && !ix.km[z.k]).map(z=>z.k);
    if(unbekannt.length) p.push(["fehler","Unknown account: "+unbekannt.join(", ")+"."]);
    if(D.some(z=>!z.k && (z.s||z.h))) p.push(["fehler","A line with an amount has no account."]);
    if(D.filter(z=>ix.km[z.k] && (z.s||z.h)).length < 2) p.push(["fehler","A booking needs at least two lines with amounts."]);
    if(Math.abs(diff) >= .005) p.push(["fehler","Debit and credit differ by "+fz(diff)+"."]);
  }
  if(!(entwurf.text||"").trim()) p.push(["warn","Without a text the booking is hard to find later."]);
  D.forEach(z=>{ const k = ix.km[z.k]; if(k && k.wkz && (z.s||z.h) && !(z.fw > 0)) p.push(["warn","No "+k.wkz+" amount for "+k.nr+"; its currency balance will be off."]); });
  const vt = verteilungsVorschau(D);
  if(vt){ if(!vt.ok) vt.fehler.forEach(x=>p.push(["fehler",x])); else vt.warnungen.forEach(x=>p.push(["warn",x])); }
  const fehler = p.some(x=>x[0]==="fehler") || !soll || Math.abs(diff) >= .005;
  return {p:p, fehler:fehler, soll:soll, haben:haben, diff:diff, D:D, vt:vt};
}

/* ---------- Rendering ------------------------------------------------- */
function renderBuchen(){
  if(!entwurf) neuerEntwurf(true);
  setzeUntertitel(bearbeitet ? "Edit an existing booking" : "New booking, financial year "+state.jahr);
  const b = bearbeitet ? state.buchungen.find(x=>x.id===bearbeitet) : null;
  let banner = "";
  if(b && istGeschlossen(String(b.datum).slice(0,4))) banner = "This booking belongs to the closed year "+String(b.datum).slice(0,4)+". It can be viewed and copied, not changed.";
  else if(b && b.eb) banner = "This is the opening balance. Changes affect every opening balance of the year.";
  else if(b && b.plan && b.plan.rolle === "aufloesung") banner = "Part of a spread (month "+b.plan.nr+" of "+b.plan.von+"). Changes only affect this booking.";
  else if(b && b.plan && respread()){
    const n = state.buchungen.filter(x=> x.plan && x.plan.id === b.plan.id && x.id !== b.id).length;
    banner = "Spread over "+b.plan.monate+" months from "+E.MONATE[+String(b.plan.start||b.datum).slice(5,7)-1]+" "+String(b.plan.start||b.datum).slice(0,4)+
      ". Change the first month, the months, the amount or the accounts and save: its "+n+" other booking"+(n===1?"":"s")+" (releases and carry-over) are replaced by the new plan. Switch the spread off to book it as a normal booking.";
  }
  else if(b && b.plan) banner = "Base booking of a spread over "+b.plan.monate+" months. The monthly releases stay as they are.";
  $("#bu-banner").innerHTML = banner ? `<div class="banner">${esc(banner)}</div>` : "";
  const schnell = entwurf.modus === "schnell";
  $("#bu-schnell").hidden = !schnell; $("#bu-zeilenmodus").hidden = schnell;
  $("#bu-modus").textContent = schnell ? "Enter as lines" : "Back to quick entry";
  $("#bu-modus").hidden = !schnell && !quickMoeglich();
  if(document.activeElement !== $("#bu-datum")) $("#bu-datum").value = E.istDatum(entwurf.datum) ? fd(entwurf.datum) : (entwurf.datumRoh||"");
  $("#bu-text").value = entwurf.text;
  if(schnell){
    if(document.activeElement !== $("#bu-betrag")) $("#bu-betrag").value = entwurf.betrag;
    setzeKontofeld("#bu-soll", entwurf.soll); setzeKontofeld("#bu-haben", entwurf.haben);
    renderFW(); renderSplit();
  }else renderZeilenmodus();
  $("#bu-del").hidden = !bearbeitet || (b && istGeschlossen(String(b.datum).slice(0,4))); $("#bu-kopie").hidden = !bearbeitet;
  $("#bu-verteilung-box").hidden = !!bearbeitet && (!respread() || !!(b && istGeschlossen(String(b.datum).slice(0,4))));
  $("#vt-an").checked = vtAn; $("#vt-panel").hidden = !vtAn;
  if(vtAn && !$("#vt-start").value) $("#vt-start").value = (entwurf.datum||"").slice(0,7);
  aktualisiere();
  renderVerlauf(); renderPlaene(); renderLetzte();
}
// the last 20 bookings entered, whatever account or year
function idNr(b){ return parseInt(String(b.id).replace(/\D/g,""),10) || 0; }
function renderLetzte(){
  const liste = state.buchungen.filter(b=>!(b.plan && b.plan.rolle === "aufloesung"))
    .sort((a,b)=> idNr(b) - idNr(a) || (a.datum<b.datum?1:-1)).slice(0,20);
  $("#bu-letzte").innerHTML = liste.length
    ? `<table class="jo">${joKopf(true)}${liste.map(b=>joBuchung(b, {kopie:true, an:b.id===bearbeitet})).join("")}</table>`
    : `<p class="mut klein">Nothing booked yet.</p>`;
  $$("#bu-letzte [data-edit]").forEach(el=> el.onclick = ()=> ladeEntwurf(el.dataset.edit));
  $$("#bu-letzte [data-kopie]").forEach(el=> el.onclick = e=>{ e.stopPropagation(); kopiereBuchung(el.dataset.kopie); });
}
function quickMoeglich(){
  const D = abgeleitet().filter(z=>z.k);
  const s = D.filter(z=>z.s && !z.h), h = D.filter(z=>z.h && !z.s);
  return D.length === s.length + h.length && (s.length === 1 || h.length === 1) && !D.some(z=>z.fw > 0);
}
function setzeKontofeld(sel, nr){
  const el = $(sel); if(document.activeElement === el) return;
  const k = ix.km[nr]; el.value = k ? nr+" "+k.name : (nr||"");
  el.classList.toggle("fehler", !!nr && !k);
}
function kontoInfo(nr, el){
  if(!el) return;
  const k = ix.km[nr];
  if(!nr){ el.innerHTML = ""; el.className = "kontoinfo"; return; }
  if(!k){ el.innerHTML = `<span class="name">unknown account</span>`; el.className = "kontoinfo fehler"; return; }
  const g = ix.gm[k.grp], s = E.saldoPer(state, E.istDatum(entwurf.datum) ? entwurf.datum : periodeAktiv().bis)[k.nr]||0;
  const v = g && g.s === "P" ? -s : s;
  el.className = "kontoinfo";
  el.innerHTML = `<span class="name">${esc(g?g.t:"")}${k.wkz?", "+k.wkz:""}</span><span class="num">${g&&g.s==="E"?"":"Balance "+f(v)}</span>`;
}
function renderFW(){
  const ks = ix.km[entwurf.soll], kh = ix.km[entwurf.haben];
  const w = (ks && ks.wkz) || (kh && kh.wkz);
  if(!w){ $("#bu-fw").innerHTML = ""; entwurf.fw = ""; return; }
  if(ks && kh && ks.wkz && kh.wkz && ks.wkz !== kh.wkz){
    $("#bu-fw").innerHTML = `<div class="fuss info">Two different currencies: use “Enter as lines” to record both foreign amounts.</div>`; return; }
  if(!entwurf.kurs) entwurf.kurs = String(state.kurse[w]||"");
  $("#bu-fw").innerHTML = `<div class="fwzeile"><div class="feld"><label for="bu-fwbetrag">Amount in ${esc(w)}</label>
      <input class="eingabe num" id="bu-fwbetrag" inputmode="decimal" autocomplete="off" value="${esc(entwurf.fw)}"></div>
    <div class="feld"><label for="bu-kurs">Rate</label><input class="eingabe num" id="bu-kurs" inputmode="decimal" autocomplete="off" value="${esc(entwurf.kurs)}"></div>
    <div class="klein mut">${esc(state.waehrung)} amount = ${esc(w)} amount × rate</div></div>`;
  const fwRechne = ()=>{ const a = E.betragAusEingabe(entwurf.fw), r = E.zahl(entwurf.kurs);
    if(isFinite(a) && a && isFinite(r) && r){ entwurf.betrag = zahlFmt(Math.abs(a)*r); $("#bu-betrag").value = entwurf.betrag; } aktualisiere(); };
  $("#bu-fwbetrag").addEventListener("input", e=>{ entwurf.fw = e.target.value; fwRechne(); });
  $("#bu-kurs").addEventListener("input", e=>{ entwurf.kurs = e.target.value; fwRechne(); });
  [$("#bu-fwbetrag"), $("#bu-kurs")].forEach(el=> el.addEventListener("keydown", e=>{ if(e.key === "Enter"){ e.preventDefault(); enter(); } }));
}
function renderSplit(fokus){
  const sp = entwurf.splitAktiv ? splitSeite() : null;
  if(!sp){ $("#bu-split").innerHTML = ""; return; }
  const fw = entwurf.split.some(x=>ix.km[x.k] && ix.km[x.k].wkz);
  const rest = splitRest(), restKl = !isFinite(rest) ? "" : (Math.abs(rest) < .005 ? "null" : (rest > 0 ? "offen" : "zuviel"));
  $("#bu-split").innerHTML = `<div class="split"><div class="split-kopf"><span><b>Split the ${sp==="soll"?"debit":"credit"} side</b> of ${fz(betragWert()||0)}</span>
      <span>Remaining <span class="rest ${restKl}" id="bu-rest">${isFinite(rest)?fz(rest):"–"}</span></span></div>`+
    entwurf.split.map((x,i)=>{ const k = ix.km[x.k], wkz = k && k.wkz;
      return `<div class="splitzeile${fw?" fw":""}">
        <div class="feld kontofeld"><input class="eingabe${x.k&&!k?" fehler":""}" data-sp="${i}" data-f="k" value="${esc(k?x.k+" "+k.name:x.k)}" placeholder="Account" autocomplete="off" aria-label="Account, split line ${i+1}">
          <div class="kontoinfo" data-spinfo="${i}"></div></div>`+
        (fw ? `<div class="feld"><input class="eingabe num" data-sp="${i}" data-f="fw" value="${esc(x.fw)}" ${wkz?"":"disabled"} placeholder="${wkz||""}" aria-label="Foreign amount"></div>
               <div class="feld"><input class="eingabe num" data-sp="${i}" data-f="kurs" value="${esc(x.kurs)}" ${wkz?"":"disabled"} placeholder="${wkz?(state.kurse[wkz]||""):""}" aria-label="Rate"></div>` : "")+
        `<div class="feld"><input class="eingabe num" data-sp="${i}" data-f="b" value="${esc(x.b)}" inputmode="decimal" autocomplete="off" aria-label="Amount, split line ${i+1}"></div>
        <div class="feld"><input class="eingabe" data-sp="${i}" data-f="t" value="${esc(x.t)}" autocomplete="off" placeholder="Line text" aria-label="Text, split line ${i+1}"></div>
        <button type="button" class="weg" data-spweg="${i}" tabindex="-1" aria-label="Remove split line ${i+1}">×</button></div>`; }).join("")+`</div>`;
  $$("#bu-split input").forEach(inp=>{
    const i = +inp.dataset.sp, feld = inp.dataset.f;
    if(feld === "k"){
      kontoWahl(inp, k=>{
        const x = entwurf.split[i]; if(!x) return;
        x.k = k ? k.nr : ""; fokusKonto = x.k || fokusKonto;
        if(k && k.wkz && !x.kurs) x.kurs = String(state.kurse[k.wkz]||"");
        inp.value = k ? k.nr+" "+k.name : ""; inp.classList.remove("fehler");
        const brauchtFW = entwurf.split.some(y=>ix.km[y.k] && ix.km[y.k].wkz);
        if(brauchtFW !== !!$("#bu-split .splitzeile.fw")) renderSplit({i:i, f:"b"});
        kontoInfo(x.k, document.querySelector(`[data-spinfo="${i}"]`)); aktualisiere(); renderVerlauf();
      }, ()=> (entwurf.split[i]||{}).k);
      inp.addEventListener("input", ()=>{ const t = inp.value.trim().split(/\s+/)[0]; entwurf.split[i].k = /^\d[\d.]*$/.test(t) ? t : inp.value.trim(); aktualisiere(); });
      kontoInfo(entwurf.split[i].k, document.querySelector(`[data-spinfo="${i}"]`));
    }else{
      inp.addEventListener("input", ()=>{
        const x = entwurf.split[i]; x[feld] = inp.value;
        if(feld === "fw" || feld === "kurs"){ const a = E.betragAusEingabe(x.fw), r = E.zahl(x.kurs);
          if(isFinite(a) && a && isFinite(r) && r){ x.b = zahlFmt(Math.abs(a)*r); const el = document.querySelector(`[data-sp="${i}"][data-f="b"]`); if(el) el.value = x.b; } }
        aktualisiereRest(); aktualisiere();
      });
      if(feld === "b") inp.addEventListener("blur", ()=>{ const v = E.betragAusEingabe(entwurf.split[i] && entwurf.split[i].b); if(isFinite(v) && entwurf.split[i]){ entwurf.split[i].b = zahlFmt(Math.abs(v)); inp.value = entwurf.split[i].b; } });
    }
    inp.addEventListener("keydown", e=>{
      if(e.key === "Enter" && !e.__gewaehlt && !e.defaultPrevented){ e.preventDefault(); splitWeiter(i, true); return; }
      if(e.key === "Tab" && !e.shiftKey && feld === "t"){ if(splitWeiter(i, false)) e.preventDefault(); }
    });
  });
  $$("#bu-split [data-spweg]").forEach(b=> b.onclick = ()=>{
    const i = +b.dataset.spweg;
    entwurf.split.splice(i,1);
    if(!entwurf.split.length){ entwurf.splitAktiv = false; renderSplit(); aktualisiere(); return; }
    renderSplit(); aktualisiere();
  });
  if(fokus){ const el = document.querySelector(`#bu-split [data-sp="${fokus.i}"][data-f="${fokus.f}"]`); if(el){ el.focus(); el.select && el.select(); } }
}
function aktualisiereRest(){
  const el = $("#bu-rest"); if(!el) return;
  const rest = splitRest();
  el.textContent = isFinite(rest) ? fz(rest) : "–";
  el.className = "rest " + (!isFinite(rest) ? "" : (Math.abs(rest) < .005 ? "null" : (rest > 0 ? "offen" : "zuviel")));
}
// After the last field of a split line: add the next line with the remaining amount, or book when balanced.
function splitWeiter(i, istEnter){
  const rest = splitRest(), x = entwurf.split[i], letzte = i === entwurf.split.length - 1;
  if(letzte && x && x.k && isFinite(rest) && rest >= .005){
    entwurf.split.push(leereSplit(zahlFmt(rest), entwurf.text));
    renderSplit({i:i+1, f:"k"}); aktualisiere(); return true;
  }
  if(istEnter){ enter(); return true; }
  return false;
}
function aktiviereSplit(){
  if(entwurf.splitAktiv || !splitSeite() || !(betragWert() > 0)) return false;
  entwurf.splitAktiv = true;
  if(!entwurf.split.length) entwurf.split = [leereSplit(zahlFmt(betragWert()), entwurf.text)];
  renderSplit({i:0, f:"k"}); aktualisiere();
  return true;
}
function renderZeilenmodus(fokus){
  const fw = entwurf.z.some(z=>ix.km[z.k] && ix.km[z.k].wkz);
  $("#bu-zeilenmodus").innerHTML = `<div class="zl kopf"><span>Account</span><span style="text-align:right">Debit</span><span style="text-align:right">Credit</span><span>Line text</span><span></span></div>`+
    entwurf.z.map((z,i)=>{ const k = ix.km[z.k], wkz = k && k.wkz;
      return `<div class="zl"><div class="feld kontofeld"><input class="eingabe${z.k&&!k?" fehler":""}" data-zl="${i}" data-f="k" value="${esc(k?z.k+" "+k.name:z.k)}" placeholder="Account" autocomplete="off" aria-label="Account, line ${i+1}">
          <div class="kontoinfo" data-zlinfo="${i}"></div>${wkz?`<div style="display:flex;gap:6px;margin-top:4px"><input class="eingabe num" data-zl="${i}" data-f="fw" value="${esc(z.fw)}" placeholder="${wkz}" aria-label="Foreign amount" style="min-height:30px">
          <input class="eingabe num" data-zl="${i}" data-f="kurs" value="${esc(z.kurs||state.kurse[wkz]||"")}" placeholder="Rate" aria-label="Rate" style="min-height:30px;max-width:90px"></div>`:""}</div>
        <div class="feld"><input class="eingabe num" data-zl="${i}" data-f="s" value="${esc(z.s)}" inputmode="decimal" placeholder="Debit" aria-label="Debit"></div>
        <div class="feld"><input class="eingabe num" data-zl="${i}" data-f="h" value="${esc(z.h)}" inputmode="decimal" placeholder="Credit" aria-label="Credit"></div>
        <div class="feld"><input class="eingabe" data-zl="${i}" data-f="t" value="${esc(z.t)}" placeholder="optional" aria-label="Line text"></div>
        <button type="button" class="weg" data-zlweg="${i}" tabindex="-1" aria-label="Remove line ${i+1}">×</button></div>`; }).join("")+
    `<button type="button" class="btn leicht mini" id="bu-zlplus">Add line</button>`;
  $$("#bu-zeilenmodus input").forEach(inp=>{
    const i = +inp.dataset.zl, feld = inp.dataset.f;
    if(feld === "k"){
      kontoWahl(inp, k=>{ const z = entwurf.z[i]; if(!z) return; const warFW = !!(ix.km[z.k]||{}).wkz;
        z.k = k ? k.nr : ""; fokusKonto = z.k || fokusKonto; inp.value = k ? k.nr+" "+k.name : "";
        if(!!(k||{}).wkz !== warFW) renderZeilenmodus({i:i, f:"s"}); else kontoInfo(z.k, document.querySelector(`[data-zlinfo="${i}"]`));
        aktualisiere(); renderVerlauf(); }, ()=> (entwurf.z[i]||{}).k);
      inp.addEventListener("input", ()=>{ const t = inp.value.trim().split(/\s+/)[0]; entwurf.z[i].k = /^\d[\d.]*$/.test(t) ? t : inp.value.trim(); aktualisiere(); });
      kontoInfo(entwurf.z[i].k, document.querySelector(`[data-zlinfo="${i}"]`));
    }else{
      inp.addEventListener("input", ()=>{
        const z = entwurf.z[i]; z[feld] = inp.value;
        if((feld === "s" || feld === "h") && isFinite(E.betragAusEingabe(inp.value)) && E.betragAusEingabe(inp.value)){
          const g = feld === "s" ? "h" : "s"; z[g] = ""; const el = document.querySelector(`[data-zl="${i}"][data-f="${g}"]`); if(el) el.value = ""; }
        if(feld === "fw" || feld === "kurs"){ const a = E.betragAusEingabe(z.fw), r = E.zahl(z.kurs || state.kurse[(ix.km[z.k]||{}).wkz]);
          if(isFinite(a) && a && isFinite(r) && r){ const seite = (E.betragAusEingabe(z.h) && !E.betragAusEingabe(z.s)) ? "h" : "s";
            z[seite] = zahlFmt(Math.abs(a)*r); z[seite==="s"?"h":"s"] = "";
            ["s","h"].forEach(x=>{ const el = document.querySelector(`[data-zl="${i}"][data-f="${x}"]`); if(el) el.value = z[x]; }); } }
        aktualisiere();
      });
      if(feld === "s" || feld === "h") inp.addEventListener("blur", ()=>{ const v = E.betragAusEingabe(entwurf.z[i] && entwurf.z[i][feld]);
        if(isFinite(v) && entwurf.z[i] && entwurf.z[i][feld] !== ""){ entwurf.z[i][feld] = zahlFmt(Math.abs(v)); inp.value = entwurf.z[i][feld]; } });
    }
    inp.addEventListener("keydown", e=>{ if(e.key === "Enter" && !e.__gewaehlt && !e.defaultPrevented){ e.preventDefault(); enter(); } });
  });
  $$("#bu-zeilenmodus [data-zlweg]").forEach(b=> b.onclick = ()=>{ const i = +b.dataset.zlweg;
    if(entwurf.z.length > 2) entwurf.z.splice(i,1); else entwurf.z[i] = leereZeile(); renderZeilenmodus(); aktualisiere(); });
  $("#bu-zlplus").onclick = ()=>{ entwurf.z.push(leereZeile()); renderZeilenmodus({i:entwurf.z.length-1, f:"k"}); aktualisiere(); };
  if(fokus){ const el = document.querySelector(`#bu-zeilenmodus [data-zl="${fokus.i}"][data-f="${fokus.f}"]`); if(el) el.focus(); }
}
function aktualisiere(){
  const r = pruefe();
  // date and amount hints
  const di = $("#bu-datum-info");
  if(di){ if(E.istDatum(entwurf.datum)){ const d = new Date(entwurf.datum+"T12:00:00Z"); di.className = "kontoinfo"; di.innerHTML = `<span class="name">${WT[d.getUTCDay()]} ${fd(entwurf.datum)}</span>`; }
          else { di.className = "kontoinfo fehler"; di.innerHTML = entwurf.datumRoh ? `<span class="name">not a date</span>` : ""; } }
  const bi = $("#bu-betrag-info");
  if(bi){ const roh = String(entwurf.betrag||""), v = betragWert();
    bi.className = "kontoinfo" + (roh && !isFinite(v) ? " fehler" : "");
    bi.innerHTML = roh && !isFinite(v) ? `<span class="name">cannot read</span>` : (/[+*\/]|\d-\d/.test(roh) && isFinite(v) ? `<span class="name">= ${fz(v)}</span>` : ""); }
  if(entwurf.modus === "schnell"){ kontoInfo(entwurf.soll, $("#bu-soll-info")); kontoInfo(entwurf.haben, $("#bu-haben-info")); }
  // posting preview
  const soll = r.D.filter(z=>z.s && ix.km[z.k]), haben = r.D.filter(z=>z.h && ix.km[z.k]);
  const seite = (liste, titel) => `<div class="bs-seite"><div class="titel">${titel}</div>`+(liste.length ? liste.map(z=>
    `<div><span><b class="nr">${esc(z.k)}</b> ${esc(kontoName(z.k))}${z.t?` <span class="mut">· ${esc(z.t)}</span>`:""}</span><span class="betrag">${fz(z.s||z.h)}</span></div>`).join("") : `<div class="mut">–</div>`)+`</div>`;
  $("#bu-satz").innerHTML = (soll.length || haben.length)
    ? `<div class="buchungssatz">${seite(soll,"Debit")}<div class="an">to</div>${seite(haben,"Credit")}</div>`
    : `<div class="buchungssatz leer">The posting appears here once accounts and an amount are entered.</div>`;
  // balance beam
  const w = $("#bu-waage");
  if(!w.querySelector("svg")){
    w.innerHTML = `<svg width="120" height="52" viewBox="0 0 132 58" aria-hidden="true">
      <path d="M66 56 L58 56 L66 46 L74 56 Z" fill="currentColor" opacity=".35"/><line x1="66" y1="20" x2="66" y2="47" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
      <g class="balken" style="transform-box:view-box;transform-origin:66px 20px">
        <line x1="14" y1="20" x2="118" y2="20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M20 20 L12 36 M20 20 L28 36 M8 36 Q20 44 32 36" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M112 20 L104 36 M112 20 L120 36 M100 36 Q112 44 124 36" fill="none" stroke="currentColor" stroke-width="1.4"/>
      </g><circle cx="66" cy="20" r="3" fill="currentColor"/></svg>
      <div class="werte"><span>Debit</span><b id="w-s"></b><span>Credit</span><b id="w-h"></b></div><div class="urteil" id="w-u"></div>`;
  }
  const max = Math.max(r.soll, r.haben, 1), winkel = Math.max(-11, Math.min(11, -(r.diff/max)*14));
  w.querySelector(".balken").style.transform = `rotate(${winkel.toFixed(2)}deg)`;
  const gleich = Math.abs(r.diff) < .005 && r.soll > 0;
  w.style.color = gleich ? "var(--gruen)" : (r.soll||r.haben ? "var(--amber)" : "var(--text3)");
  $("#w-s").textContent = fz(r.soll); $("#w-h").textContent = fz(r.haben);
  $("#w-u").textContent = gleich ? "Balanced" : (r.soll||r.haben ? "Difference "+fz(r.diff) : "");
  // spread preview
  if(vtAn && (!bearbeitet || respread())){
    const vj = vtStand().jahr;
    const ein = state.einstellungen;
    const v = r.vt;
    // which side: expense spreads run through 1305 → 1300, income spreads through 2305 → 2300
    const ertrag = v && v.ok && v.basis && v.basis.z.some(z=> (z[0] === v.praJahr || z[0] === v.pra) && z[2]);
    const jk = v && v.ok ? (ertrag ? v.praJahr : v.araJahr) : "", fk = v && v.ok ? (ertrag ? v.pra : v.ara) : "";
    $("#vt-erklaerung").textContent = v && v.ok && v.nurAufloesung
      ? "The amount already sits on the accrual account, so only the monthly releases are booked."
      : v && v.ok && jk !== fk
        ? "The amount first goes to "+jk+" ("+kontoName(jk)+") and is released at each month end. On 31.12."+vj+" the months still to come move to "+fk+" ("+kontoName(fk)+"), so "+jk+" ends the year at zero."
        : "The amount first goes to "+ein.ara+" ("+kontoName(ein.ara)+") and is released at each month end. Months after 31.12."+vj+" stay there.";
    $("#vt-vorschau").innerHTML = v && v.ok ? `<div class="vt-vorschau"><table class="band"><thead><tr><th>Month</th><th>Released on</th><th class="num">Amount</th><th></th></tr></thead><tbody>`+
      v.vorschau.map(x=>`<tr><td>${E.MONATE[+x.monat.slice(5)-1]} ${x.monat.slice(0,4)}</td><td>${x.gebucht?fd(x.datum):"–"}</td><td class="num">${fz(x.betrag)}</td>
        <td>${x.gebucht?'<span class="chip gruen">booked now</span>':'<span class="chip amber">'+(v.uebertrag ? "carried to " : "stays on ")+esc(fk)+'</span>'}</td></tr>`).join("")+
      `</tbody></table></div><div class="vt-summe">${v.aufloesungen.length} releases will be booked.${v.uebertrag?` On 31.12.${vj}, <b>${fz(v.uebertrag.z[0][1])}</b> move from ${esc(jk)} to ${esc(fk)} for ${vj+1}.`:""}${v.rest && !v.uebertrag?` At 31.12.${vj}, <b>${fz(v.rest)}</b> remain on ${esc(v.basis && v.basis.z.some(z=>z[0]===v.pra&&z[2])?v.pra:v.ara)}.`:""}${!v.rest?" Nothing remains deferred.":""}</div>` : "";
  }
  // checks: problems only, or one calm line
  const sym = {ok:"✓", warn:"!", fehler:"×", info:"i"};
  const probleme = r.p.filter(x=>x[0] !== "ok");
  $("#bu-pruefungen").innerHTML = probleme.length
    ? probleme.map(x=>`<div class="pz ${x[0]==="info"?"":x[0]}"><span class="i">${sym[x[0]]}</span><span>${esc(x[1])}</span></div>`).join("")
    : `<div class="pz ok"><span class="i">✓</span><span>Ready to book.</span></div>`;
  const knopf = $("#bu-ok");
  knopf.disabled = r.fehler;
  const warBereit = knopf.classList.contains("bereit");
  knopf.classList.toggle("bereit", !r.fehler);
  if(!r.fehler && !warBereit && BEWEGUNG){ knopf.classList.remove("neu"); void knopf.offsetWidth; knopf.classList.add("neu"); }
  if(r.fehler) knopf.classList.remove("neu");
  const nVt = r.vt && r.vt.ok ? (r.vt.basis?1:0)+r.vt.aufloesungen.length+(r.vt.uebertrag?1:0) : 0;
  knopf.innerHTML = (bearbeitet ? (respread() ? (nVt ? "Save and spread anew ("+nVt+" bookings)" : "Save as a normal booking") : "Save changes")
    : (nVt ? "Book spread ("+nVt+" bookings)" : "Book"))+" <kbd>⏎</kbd>";
}
function renderVerlauf(){
  const k = [fokusKonto, entwurf && entwurf.soll, entwurf && entwurf.haben].find(nr=> nr && ix.km[nr]);
  const titel = $("#bu-verlauf-titel");
  let liste;
  if(k){
    titel.textContent = "Recent on "+k+" "+kontoName(k);
    liste = state.buchungen.filter(b=>b.z.some(z=>z[0]===k));
  }else{ titel.textContent = "Recent bookings"; liste = state.buchungen.slice(); }
  // balance of that account: today (within the selected year) and at the year end, if different
  const sEl = $("#bu-verlauf-saldo");
  if(k){
    const g = ix.gm[ix.km[k].grp], vz = g && g.s === "P" ? -1 : 1, h = heute(), ende = state.jahr+"-12-31";
    const per = h.slice(0,4) === String(state.jahr) ? h : ende;
    const jetzt = E.r2(vz*(E.saldoPer(state, per)[k]||0)), amEnde = E.r2(vz*(E.saldoPer(state, ende)[k]||0));
    sEl.innerHTML = `<div class="vl-saldo"><span>Balance${g && g.s === "E" ? " (year to date)" : ""}<small>at ${fd(per)}</small></span><b class="${jetzt<0?"neg":""}">${fz(jetzt)}</b></div>`+
      (per !== ende && Math.abs(amEnde-jetzt) >= .005 ? `<div class="klein mut" style="margin:-6px 0 10px;text-align:right">incl. later bookings to ${fd(ende)}: ${fz(amEnde)}</div>` : "");
  }else sEl.innerHTML = "";
  liste = liste.slice().sort((a,b)=> a.datum===b.datum ? String(b.id).localeCompare(String(a.id)) : (a.datum<b.datum?1:-1)).slice(0,12);
  $("#bu-verlauf").innerHTML = liste.length ? `<div class="verlauf-kopf"><span>Date</span><span>Text</span><span style="text-align:right">Amount</span><span>Debit</span><span>Credit</span></div>`+liste.map(b=>{
    const bf = buchungsform(b), zk = k ? b.z.filter(z=>z[0]===k) : [];
    const betr = k ? E.r2(zk.reduce((a,z)=>a+(z[1]||0)-(z[2]||0),0)) : bf.betrag;
    const text = (k && zk[0] && zk[0][5]) || b.text || "(no text)";
    const kt = nr => nr ? `<span class="kt" title="${esc(nr+" "+kontoName(nr))}">${esc(nr)}</span>` : `<span class="kt splitchip" style="font-size:10px">Split</span>`;
    const teile = bf.teile.map(z=>esc(z[0])+" "+fz(Math.abs((z[1]||0)-(z[2]||0)))).join(" · ");
    return `<div class="e" data-copy="${esc(b.id)}" tabindex="0" role="button" aria-label="Copy booking ${esc(text)}">
      <span class="d">${fd(b.datum).slice(0,6)}</span><span class="t" title="${esc(text)}">${esc(text)}</span>
      <span class="num klein ${betr<0?"neg":""}">${fz(betr)}</span>${kt(bf.sollNr)}${kt(bf.habenNr)}
      ${teile ? `<span class="gegen">↳ ${teile}</span>` : ""}
      <span class="a"><button type="button" class="btn leicht mini" data-edit="${esc(b.id)}" tabindex="-1">Edit</button></span></div>`;
  }).join("") : `<p class="mut klein">${k?"No bookings on this account yet.":"Nothing booked yet."}</p>`;
  $$("#bu-verlauf [data-copy]").forEach(el=>{
    el.onclick = e=>{ if(e.target.closest("[data-edit]")) return; kopiereBuchung(el.dataset.copy); };
    el.onkeydown = e=>{ if(e.key === "Enter"){ e.preventDefault(); kopiereBuchung(el.dataset.copy); } };
  });
  $$("#bu-verlauf [data-edit]").forEach(el=> el.onclick = e=>{ e.stopPropagation(); ladeEntwurf(el.dataset.edit); });
}
function renderPlaene(){
  // spreads of earlier years that run into this year and have not been continued yet
  const fort = istGeschlossen(state.jahr) ? {plaene:[], bookings:[]} : E.spreadsFortfuehren(state, ix, state.jahr);
  const fortA = istGeschlossen(state.jahr) ? {anlagen:[], bookings:[]} : E.anlagenFortfuehren(state, ix, state.jahr);
  const teile = [];
  if(fort.plaene.length) teile.push(fort.plaene.length+" spread"+(fort.plaene.length>1?"s":"")+" ("+fort.bookings.length+" releases, "+fz(fort.plaene.reduce((s,p)=>s+p.betrag,0))+")");
  if(fortA.anlagen.length) teile.push(fortA.anlagen.length+" fixed asset"+(fortA.anlagen.length>1?"s":"")+" ("+fortA.bookings.length+" depreciation booking"+(fortA.bookings.length>1?"s":"")+", "+fz(fortA.anlagen.reduce((s,a)=>s+a.betrag,0))+")");
  const angebot = teile.length ? `<div class="fuss info" style="margin-bottom:10px;flex-wrap:wrap"><span>Not booked yet in ${state.jahr}: ${esc(teile.join(" and "))}.</span>
    <button type="button" class="btn mini" id="bu-fort" style="margin-left:auto">Book them</button></div>` : "";
  const imJahr = new Set((state.buchungen||[]).filter(b=> b.plan && b.plan.id && String(b.datum).slice(0,4) === String(state.jahr)).map(b=> b.plan.id));
  const pl = E.plaene(state, ix).filter(p=> String(p.datum||"").slice(0,4) === String(state.jahr) || imJahr.has(p.id))
    .sort((a,b)=> (b.rest > .005) - (a.rest > .005));
  $("#bu-plaene").innerHTML = angebot + (pl.length ? pl.map(p=>`<div class="e" data-edit="${esc(p.basisId||"")}"><span class="t">${esc((p.text||"Spread").replace(/ \(\d+\/\d+\)$/,""))}${String(p.datum||"").slice(0,4) !== String(state.jahr) ? ` <span class="chip">from ${String(p.datum).slice(0,4)}</span>` : ""}</span>
    <span class="num klein">${fz(p.total)}</span><span class="m">${p.gebucht} of ${p.monate} months released</span><span class="m">${p.rest > .005 ? "Remaining "+fz(p.rest) : "complete"}</span></div>`).join("")
    : `<p class="mut klein">No spreads yet.</p>`);
  $$("#bu-plaene [data-edit]").forEach(el=> el.onclick = ()=>{ if(el.dataset.edit) ladeEntwurf(el.dataset.edit); });
  const fb = $("#bu-fort"); if(fb) fb.onclick = ()=> fortfuehrenDialog(fort, fortA);
}
// spreads of earlier years and the depreciation of registered assets: what is still to book in the year
async function fortfuehrenDialog(fort, fortA){
  const J = state.jahr;
  let liste = "";
  if(fort.plaene.length) liste += `<table class="band" style="margin-top:10px"><thead><tr><th>Spread</th><th>Months in ${J}</th><th class="num">Released in ${J}</th><th class="num">Left after</th></tr></thead><tbody>`+
    fort.plaene.map(p=>`<tr><td>${esc(p.text)}</td><td>${p.monate} (${esc(p.von.slice(5))}–${esc(p.bis.slice(5))})</td><td class="num">${fz(p.betrag)}</td><td class="num">${p.rest > .005 ? fz(p.rest)+" (after "+J+")" : "–"}</td></tr>`).join("")+
    `<tr><td><b>Total</b></td><td></td><td class="num"><b>${fz(fort.plaene.reduce((s,p)=>s+p.betrag,0))}</b></td><td></td></tr></tbody></table>`;
  if(fortA.anlagen.length) liste += `<table class="band" style="margin-top:10px"><thead><tr><th>Fixed asset</th><th>Months in ${J}</th><th class="num">Depreciation ${J}</th></tr></thead><tbody>`+
    fortA.anlagen.map(a=>`<tr><td>${esc(a.text)}</td><td>${a.monate} (${esc(a.von.slice(5))}–${esc(a.bis.slice(5))})</td><td class="num">${fz(a.betrag)}</td></tr>`).join("")+
    `<tr><td><b>Total</b></td><td></td><td class="num"><b>${fz(fortA.anlagen.reduce((s,a)=>s+a.betrag,0))}</b></td></tr></tbody></table>`;
  const n = fort.bookings.length + fortA.bookings.length;
  const ok = await frage("Book the rest of "+J+"?", (fort.plaene.length ? "Spread releases go against "+esc(state.einstellungen.ara||"1300")+" / "+esc(state.einstellungen.pra||"2300")+" at each month end, under the spread's own plan. " : "")+
    (fortA.anlagen.length ? "Depreciation goes against the contra account of each asset, under the asset's own plan. " : "")+"Everything can be undone in one step."+liste,
    [{text:"Cancel", wert:false, art:"leicht"}, {text:"Book "+n+" booking"+(n===1?"":"s"), wert:true}]);
  if(!ok) return;
  if(aendere("Continued into "+J, ()=>{ fort.bookings.concat(fortA.bookings).forEach(b=> state.buchungen.push(Object.assign({id:naechsteId()}, b))); }))
    meldung(n+" bookings made for "+J+".", {aktion:{text:"Undo", fn:rueckgaengig}});
}

/* ---------- Booking and deleting ------------------------------------- */
function siegel(){
  if(!BEWEGUNG) return;
  const s = $("#siegel"), m = $("#maske");
  s.classList.remove("los"); m.classList.remove("gebucht"); void s.getBoundingClientRect();
  s.classList.add("los"); m.classList.add("gebucht");
}
function enter(){
  if(entwurf.modus === "schnell" && !entwurf.splitAktiv && aktiviereSplit()) return;
  const r = pruefe();
  if(!r.fehler){ buchen(r); return; }
  const x = r.p.find(y=>y[0]==="fehler");
  if(x && x[2]){ const el = document.querySelector(x[2]); if(el){ el.focus(); el.select && el.select(); return; } }
  if(x) meldung(x[1], {fehler:true});
}
function versucheBuchen(){ enter(); }
function buchen(r){
  if(bucht) return; bucht = true;
  try{ buchenIntern(r); } finally { bucht = false; }
}
function buchenIntern(r){
  r = r || pruefe(); if(r.fehler) return;
  const zeilen = r.D.filter(z=>ix.km[z.k] && (z.s||z.h)).map(z=>{
    const x = [z.k, z.s, z.h], k = ix.km[z.k], hatFW = k.wkz && z.fw > 0 && z.kurs > 0;
    if(hatFW || z.t){ x.push(hatFW ? E.r2(Math.abs(z.fw)) : 0); x.push(hatFW ? z.kurs : 0); }
    if(z.t) x.push(z.t);
    return x;
  });
  const kopf = {datum:entwurf.datum, beleg:"", text:(entwurf.text||"").trim()};
  let text = "";
  if(bearbeitet && respread()){
    // a spread booked anew: every booking of the old plan goes, the new plan is booked under the same plan id
    // (the base keeps its booking id); later years that had releases get them again from the new plan
    const alt = state.buchungen.find(b=>b.id===bearbeitet), pid = alt.plan.id, J = parseInt(kopf.datum.slice(0,4),10);
    const vorher = state.buchungen.filter(b=> b.plan && b.plan.id === pid).length - 1;
    const spaeter = state.buchungen.filter(b=> b.plan && b.plan.id === pid && parseInt(String(b.datum).slice(0,4),10) > J)
      .map(b=> parseInt(b.datum.slice(0,4),10)).filter((y,i,a)=> a.indexOf(y) === i).sort();
    let v = null;
    if(vtAn){
      v = E.verteilung(vtStand(), ix, {id:pid, datum:kopf.datum, text:kopf.text, beleg:alt.beleg||"", start:$("#vt-start").value, monate:$("#vt-monate").value, zeilen:zeilen.map(z=>z.slice())});
      if(!v.ok){ meldung(v.fehler.join(" "), {fehler:true}); return; }
      // and the later years the new plan runs into, up to the year that is open now
      v.vorschau.forEach(x=>{ const y = parseInt(x.monat.slice(0,4),10); if(y > J && y <= Math.max(state.jahr, J) && spaeter.indexOf(y) < 0) spaeter.push(y); });
      spaeter.sort();
    }
    let neu = 0;
    aendere(v ? "Spread booked anew" : "Spread turned into a normal booking", ()=>{
      state.buchungen = state.buchungen.filter(b=> !(b.plan && b.plan.id === pid));
      if(v){
        if(v.basis) state.buchungen.push(Object.assign({id:alt.id}, v.basis, alt.beleg ? {beleg:alt.beleg} : {}));
        v.aufloesungen.forEach(a=>{ state.buchungen.push(Object.assign({id:naechsteId()}, a)); neu++; });
        if(v.uebertrag){ state.buchungen.push(Object.assign({id:naechsteId()}, v.uebertrag)); neu++; }
        spaeter.forEach(Y=>{ if(istGeschlossen(Y)) return;
          E.spreadsFortfuehren(state, ix, Y).bookings.filter(b=> b.plan.id === pid).forEach(b=>{ state.buchungen.push(Object.assign({id:naechsteId()}, b)); neu++; }); });
      }else state.buchungen.push(Object.assign({id:alt.id}, kopf, {z:zeilen}, alt.beleg ? {beleg:alt.beleg} : {}));
    }, {render:false});
    text = v ? "Spread booked anew: "+vorher+" old bookings replaced by "+neu+(spaeter.length ? " (incl. "+spaeter.join(", ")+")" : "")
             : "Saved as a normal booking; "+vorher+" spread bookings removed";
  }else if(bearbeitet){
    const id = bearbeitet;
    aendere("Booking changed", ()=>{
      const i = state.buchungen.findIndex(b=>b.id===id), alt = state.buchungen[i];
      const neu = Object.assign({id:id}, kopf, {z:zeilen}); if(alt.beleg) neu.beleg = alt.beleg;
      if(alt.eb) neu.eb = true; if(alt.plan) neu.plan = alt.plan;
      state.buchungen[i] = neu;
    }, {render:false});
    text = "Saved";
  }else if(r.vt && r.vt.ok){
    const v = E.verteilung(state, ix, {datum:kopf.datum, text:kopf.text, start:$("#vt-start").value, monate:$("#vt-monate").value, zeilen:zeilen.map(z=>z.slice())});
    if(!v.ok){ meldung(v.fehler.join(" "), {fehler:true}); return; }
    aendere("Spread booked", ()=>{
      if(v.basis) state.buchungen.push(Object.assign({id:naechsteId()}, v.basis));
      v.aufloesungen.forEach(a=> state.buchungen.push(Object.assign({id:naechsteId()}, a)));
      if(v.uebertrag) state.buchungen.push(Object.assign({id:naechsteId()}, v.uebertrag));
    }, {render:false});
    text = "Spread booked: "+((v.basis?1:0)+v.aufloesungen.length+(v.uebertrag?1:0))+" bookings"+(v.rest?", "+fz(v.rest)+" carried into "+(state.jahr+1):"");
  }else{
    aendere("Booking recorded", ()=>{ state.buchungen.push(Object.assign({id:naechsteId()}, kopf, {z:zeilen})); }, {render:false});
    text = "Booked: "+(kopf.text||"no text")+", "+fz(r.soll);
    // a purchase on a fixed-asset account: the register asks for the details
    const anlageZ = zeilen.find(z=> (z[1]||0) > 0.005 && E.anlageKonto(ix, z[0]));
    if(anlageZ){ const neuId = state.buchungen[state.buchungen.length-1].id;
      setTimeout(()=> anlageDialog({ausBuchung:true, buchung:neuId, konto:anlageZ[0], kosten:anlageZ[1], datum:kopf.datum, text:kopf.text}), 60); }
  }
  letztesDatum = kopf.datum;
  siegel();
  neuerEntwurf(true);
  render();
  meldung(text, {aktion:{text:"Undo", fn:rueckgaengig}});
  const frisch = $("#bu-verlauf .e"); if(frisch && BEWEGUNG) frisch.classList.add("frisch");
  const d = $("#bu-datum"); if(d){ d.focus(); d.select && d.select(); }
}
async function loeschen(){
  if(!bearbeitet) return;
  const b = state.buchungen.find(x=>x.id===bearbeitet); if(!b) return;
  let wahl;
  if(b.plan){
    const alle = state.buchungen.filter(x=>x.plan && x.plan.id===b.plan.id);
    wahl = await frage("Delete a booking of a spread", "This booking belongs to a spread of "+alle.length+" bookings.",
      [{text:"Cancel", wert:null, art:"leicht"}, {text:"Only this one", wert:"eine", art:"leicht"}, {text:"Whole spread", wert:"alle", art:"gefahr"}]);
  }else{
    wahl = await frage("Delete booking?", esc((b.text||"No text")+", "+fd(b.datum)+", "+fz(b.z.reduce((a,z)=>a+(z[1]||0),0))),
      [{text:"Cancel", wert:null, art:"leicht"}, {text:"Delete", wert:"eine", art:"gefahr"}]);
  }
  if(!wahl) return;
  const id = bearbeitet, plan = b.plan ? b.plan.id : null;
  aendere(wahl === "alle" ? "Spread deleted" : "Booking deleted", ()=>{
    state.buchungen = state.buchungen.filter(x=> wahl === "alle" ? !(x.plan && x.plan.id===plan) : x.id !== id);
  }, {render:false});
  neuerEntwurf(true); render();
  meldung(wahl === "alle" ? "Spread deleted" : "Booking deleted", {aktion:{text:"Undo", fn:rueckgaengig}});
}

/* ---------- Wiring of the booking screen ----------------------------- */
$("#bu-datum").addEventListener("input", e=>{
  const iso = E.datumAusEingabe(e.target.value, entwurf.datum || startDatum());
  entwurf.datumRoh = e.target.value; entwurf.datum = iso || "";
  if(vtAn && !$("#vt-start").dataset.manuell && iso) $("#vt-start").value = iso.slice(0,7);
  aktualisiere();
});
$("#bu-datum").addEventListener("blur", e=>{ if(E.istDatum(entwurf.datum)) e.target.value = fd(entwurf.datum); });
$("#bu-datum").addEventListener("focus", e=>{ e.target.select && e.target.select(); });
$("#bu-text").addEventListener("input", e=>{
  const alt = entwurf.text; entwurf.text = e.target.value;
  entwurf.split.forEach((x,i)=>{ if(x.t === alt){ x.t = entwurf.text; const el = document.querySelector(`#bu-split [data-sp="${i}"][data-f="t"]`); if(el) el.value = x.t; } });
  aktualisiere();
});
$("#bu-betrag").addEventListener("input", e=>{
  const alt = betragWert(); entwurf.betrag = e.target.value;
  if(entwurf.splitAktiv && entwurf.split.length === 1 && Math.abs((E.betragAusEingabe(entwurf.split[0].b)||0) - (alt||0)) < .005){
    entwurf.split[0].b = isFinite(betragWert()) ? zahlFmt(betragWert()) : ""; const el = document.querySelector('#bu-split [data-sp="0"][data-f="b"]'); if(el) el.value = entwurf.split[0].b; }
  aktualisiereRest(); aktualisiere();
});
$("#bu-betrag").addEventListener("blur", e=>{ const v = betragWert(); if(isFinite(v) && entwurf.betrag !== ""){ entwurf.betrag = zahlFmt(v); e.target.value = entwurf.betrag; } });
$("#bu-betrag").addEventListener("focus", e=>{ e.target.select && e.target.select(); });
function hauptKonto(sel, feld){
  const el = $(sel);
  kontoWahl(el, k=>{
    entwurf[feld] = k ? k.nr : ""; fokusKonto = entwurf[feld] || fokusKonto;
    el.value = k ? k.nr+" "+k.name : ""; el.classList.remove("fehler");
    if(k && k.wkz && !entwurf.kurs) entwurf.kurs = String(state.kurse[k.wkz]||"");
    if(splitSeite() === null) { entwurf.splitAktiv = false; }
    renderFW(); renderSplit(); aktualisiere(); renderVerlauf();
  }, ()=> entwurf[feld]);
  el.addEventListener("input", ()=>{ const t = el.value.trim().split(/\s+/)[0]; entwurf[feld] = /^\d[\d.]*$/.test(t) ? t : el.value.trim(); aktualisiere(); });
  el.addEventListener("keydown", e=>{
    if(e.key === "Enter" && !e.__gewaehlt && !e.defaultPrevented){ e.preventDefault(); enter(); return; }
    // Tab out of the credit field with only one side filled: open the split right here
    if(e.key === "Tab" && !e.shiftKey && feld === "haben" && !entwurf.splitAktiv){
      setTimeout(()=>{ if(aktiviereSplit()){ /* focus moved to the first split line */ } }, 0);
    }
  });
  el.addEventListener("blur", ()=> setTimeout(()=>{
    if(document.activeElement === el) return;          // back in the field: nothing to do
    if(feld === "haben" && document.activeElement !== $("#bu-soll") && !entwurf.splitAktiv && splitSeite() && betragWert() > 0){
      const vorher = document.activeElement; aktiviereSplit(); if(vorher && vorher !== document.body && !vorher.closest("#bu-split")) vorher.focus(); }
  }, 140));
}
hauptKonto("#bu-soll", "soll");
hauptKonto("#bu-haben", "haben");
// Texts of earlier bookings, proposed while typing. Arrow down picks one, Enter or Tab takes it.
function textVorschlag(input){
  let liste = null, treffer = [], aktiv = -1;
  const box = input.parentNode;
  function zu(){ if(liste){ liste.remove(); liste = null; } aktiv = -1; }
  function kandidaten(roh){
    const q = norm(roh.trim()); if(q.length < 2) return [];
    const m = new Map();
    state.buchungen.forEach(b=>{
      const t = String(b.text||"").trim(); if(!t || b.eb || (b.plan && b.plan.rolle === "aufloesung")) return;
      const n = norm(t), i = n.indexOf(q); if(i < 0 || n === q) return;
      const rang = i === 0 ? 0 : (/[\s\-\/(.,]/.test(n.charAt(i-1)) ? 1 : 2);
      const x = m.get(n);
      if(!x || b.datum > x.datum) m.set(n, {text:t, datum:b.datum, rang:rang, n:(x?x.n:0)+1, bf:buchungsform(b)});
      else x.n++;
    });
    return Array.from(m.values()).sort((a,b)=> a.rang-b.rang || (a.datum<b.datum?1:-1)).slice(0,8);
  }
  function zeichne(){
    treffer = kandidaten(input.value);
    if(!treffer.length){ zu(); return; }
    aktiv = Math.min(aktiv, treffer.length-1);
    if(!liste){ liste = document.createElement("div"); liste.className = "liste texte"; liste.setAttribute("role","listbox"); box.appendChild(liste); listeEinpassen(liste); }
    const q = norm(input.value.trim());
    liste.innerHTML = treffer.map((x,i)=>{
      const n = norm(x.text), p = n.indexOf(q), t = p >= 0 && n.length === x.text.length
        ? esc(x.text.slice(0,p))+"<mark>"+esc(x.text.slice(p,p+q.length))+"</mark>"+esc(x.text.slice(p+q.length)) : esc(x.text);
      const kz = (x.bf.sollNr||"Split")+" → "+(x.bf.habenNr||"Split");
      return `<button type="button" role="option" tabindex="-1" data-i="${i}" class="${i===aktiv?"on":""}"><span class="t">${t}</span><span class="kz">${esc(kz)} · ${fd(x.datum)}${x.n>1?" · "+x.n+"×":""}</span></button>`;
    }).join("");
    Array.prototype.forEach.call(liste.querySelectorAll("button"), b=>{
      b.addEventListener("pointerdown", e=>{ if(e.pointerType === "mouse"){ e.preventDefault(); waehle(+b.dataset.i); } });
      b.addEventListener("click", e=>{ e.preventDefault(); waehle(+b.dataset.i); });
    });
    listeSichtbar(liste);
    offeneListe = {box:box, zu:zu};
  }
  function waehle(i){
    const x = treffer[i]; if(!x) return; zu();
    input.value = x.text; input.dispatchEvent(new Event("input"));
    zu(); input.focus();
  }
  input.addEventListener("input", e=>{ if(e.isTrusted){ aktiv = -1; zeichne(); } });
  input.addEventListener("blur", ()=> setTimeout(()=>{ if(!(liste && liste.dataset.touch)) zu(); }, 120));
  box.addEventListener("touchstart", e=>{ if(liste && liste.contains(e.target)) liste.dataset.touch = "1"; }, {passive:true});
  input.addEventListener("keydown", e=>{
    if(e.key === "ArrowDown"){ if(!liste) zeichne(); if(!liste) return; e.preventDefault(); aktiv = Math.min(aktiv+1, treffer.length-1); zeichne(); return; }
    if(!liste) return;
    if(e.key === "ArrowUp"){ e.preventDefault(); aktiv = Math.max(aktiv-1, -1); zeichne(); return; }
    if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); zu(); return; }
    if((e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) && aktiv >= 0){
      const x = treffer[aktiv]; e.stopImmediatePropagation();
      if(e.key === "Enter"){ e.preventDefault(); waehle(aktiv); return; }
      zu(); input.value = x.text; input.dispatchEvent(new Event("input")); return;   // Tab: take it and move on
    }
    if(e.key === "Tab" || e.key === "Enter") zu();
  });
}
textVorschlag($("#bu-text"));
["#bu-datum","#bu-text","#bu-betrag"].forEach(s=> $(s).addEventListener("keydown", e=>{ if(e.key === "Enter"){ e.preventDefault(); enter(); } }));
$("#bu-heute").onclick = ()=>{ entwurf.datum = heute(); entwurf.datumRoh = ""; $("#bu-datum").value = fd(entwurf.datum); aktualisiere(); };
$("#bu-monatsende").onclick = ()=>{ const d = E.istDatum(entwurf.datum) ? entwurf.datum : heute(); entwurf.datum = E.monatsende(d.slice(0,7)); entwurf.datumRoh = ""; $("#bu-datum").value = fd(entwurf.datum); aktualisiere(); };
$("#bu-ok").onclick = versucheBuchen;
$("#bu-kopie").onclick = alsKopie;
$("#bu-reset").onclick = ()=>{ neuerEntwurf(true); renderBuchen(); $("#bu-datum").focus(); };
$("#bu-del").onclick = loeschen;
$("#bu-modus").onclick = ()=>{
  if(entwurf.modus === "schnell"){
    const D = abgeleitet();
    entwurf.z = D.length ? D.map(z=>({k:z.k, s:z.s?zahlFmt(z.s):"", h:z.h?zahlFmt(z.h):"", t:z.t||"", fw:isFinite(z.fw)&&z.fw?zahlFmt(z.fw):"", kurs:z.kurs?String(z.kurs):""})) : [leereZeile(), leereZeile()];
    while(entwurf.z.length < 2) entwurf.z.push(leereZeile());
    entwurf.modus = "zeilen";
  }else{
    const temp = {text:entwurf.text, datum:entwurf.datum, z:abgeleitet().filter(z=>z.k).map(z=>[z.k, z.s, z.h, isFinite(z.fw)?z.fw:0, z.kurs||0, z.t])};
    const e = entwurfAusBuchung(temp); e.datum = entwurf.datum; entwurf = e;
  }
  renderBuchen();
};
$("#vt-an").onchange = e=>{ vtAn = e.target.checked; $("#vt-panel").hidden = !vtAn; if(vtAn && !$("#vt-start").value) $("#vt-start").value = (entwurf.datum||"").slice(0,7); aktualisiere(); };
$("#vt-start").addEventListener("input", e=>{ e.target.dataset.manuell = "1"; aktualisiere(); });
$("#vt-monate").addEventListener("input", aktualisiere);

