/* =====================================================================
   FIXED ASSETS — the register and its depreciation (engine: E.anlage*)
   ===================================================================== */
let saGewaehlt = null;                                   // the asset whose schedule is open
function saKonten(pred){ return kontenSortiert().filter(k=> pred(k, ix.gm[k.grp])); }
function saOption(liste, wert, leer){ return (leer ? `<option value="">${esc(leer)}</option>` : "") + liste.map(k=>`<option value="${esc(k.nr)}"${k.nr===wert?" selected":""}>${esc(k.nr)} · ${esc(k.name.slice(0,60))}</option>`).join(""); }
// the accounts for a gain or loss on disposal exist; created in the depreciation group when missing
function saAbgangKonten(){
  const ein = state.einstellungen || {}, gewinn = ein.abgangGewinn || "6815", verlust = ein.abgangVerlust || "6810";
  const fehlt = [gewinn, verlust].filter(nr=> !ix.km[nr]);
  if(!fehlt.length) return {gewinn, verlust, neu:[]};
  const grp = state.gruppen.find(g=> E.istER(g) && /depreciation|abschreib|amortis/i.test(g.t)) || state.gruppen.find(g=> E.istER(g) && g.vz !== -1);
  const neu = fehlt.map(nr=> [nr, nr === gewinn ? "Gewinn aus Abgang Anlagevermögen" : "Verlust aus Abgang Anlagevermögen", grp ? grp.c : "I11", null, null]);
  return {gewinn, verlust, neu};
}
function saBis(){ const p = periodeAktiv(); return p.bis; }
/* ---------- the page ---------- */
function renderSachanlagen(){
  const bis = state.jahr+"-12-31", heuteBis = heute() < bis && heute().slice(0,4) === String(state.jahr) ? E.monatsende(heute().slice(0,7)) : bis;
  const ue = E.anlagenUebersicht(state, ix, heuteBis), reihe = E.anlagenJahresreihe(state, ix, state.jahr);
  setzeUntertitel("Register at "+fd(heuteBis)+", schedule for "+state.jahr);
  const aktiv = ue.anlagen.filter(x=> !x.abgegangen && x.kosten > 0);
  const jahresAufwand = E.r2(reihe.reduce((s, r)=> s + r.aufwand, 0));
  const gesamt = Math.max(ue.total.buchwert, 1);
  const farben = ["#1F3F66","#2F5E91","#4A7DB5","#7FA3CC","#627A94","#8FA6BF","#3D5A80","#98AEC8"];
  const bloecke = aktiv.length ? aktiv.sort((a,b)=> b.buchwert - a.buchwert).map((x, i)=>{
    const w = Math.max(0, x.buchwert), anteil = w/gesamt; if(w < .005) return "";
    return `<div class="bb-block${anteil<.17?" klein":""}" style="flex:${w} 1 0;background:${farben[i % farben.length]}" data-tip="${esc(`<b>${esc(x.anlage.text)}</b>`+tipZeile("Cost", fz(x.kosten))+tipZeile("Depreciated", fz(x.gebucht))+tipZeile("Net book value", fz(x.buchwert))+tipZeile("Monthly charge", fz(x.monatlich)))}">
      <span>${esc(x.anlage.text)}</span><b>${fk(x.buchwert)}</b></div>`; }).join("") : `<div class="mut klein" style="padding:20px 0">No asset in the register yet.</div>`;
  $("#sa-held").innerHTML = `<div class="held">
    <div><div class="bilanzbild" style="grid-template-columns:1fr">
      <div class="bb-spalte"><div class="bb-kopf"><span>Net book value by asset</span><span>${fk(ue.total.buchwert)}</span></div>${bloecke}</div>
    </div></div>
    <div>
      <div class="kennwert"><div class="l">Net book value at ${fd(heuteBis)}</div><div class="v">${fz(ue.total.buchwert)}</div><div class="linie"></div></div>
      <div class="kenngitter">
        <div><div class="l">Cost</div><div class="v">${fz(ue.total.kosten)}</div></div>
        <div><div class="l">Accumulated depreciation</div><div class="v">${fz(ue.total.gebucht)}</div></div>
        <div><div class="l">Depreciation ${state.jahr} (schedule)</div><div class="v">${fz(jahresAufwand)}</div></div>
        <div><div class="l">Residual values</div><div class="v">${fz(aktiv.reduce((s, x)=> s + x.anlage.restwert, 0))}</div></div>
      </div>
    </div></div>`;
  const naechstes = E.anlagenJahresreihe(state, ix, state.jahr+1).reduce((s, r)=> s + r.aufwand, 0);
  const fort = istGeschlossen(state.jahr) ? {bookings:[], anlagen:[]} : E.anlagenFortfuehren(state, ix, state.jahr);
  $("#sa-leiste").innerHTML = [
    ["Assets in use", String(aktiv.length)], ["Monthly charge", fz(aktiv.reduce((s, x)=> s + x.monatlich, 0))],
    ["Depreciation "+(state.jahr+1), fz(naechstes)], ["Not booked yet in "+state.jahr, fz(fort.anlagen.reduce((s, a)=> s + a.betrag, 0))],
    ["Schedule vs. booked", Math.abs(ue.total.fehlt) < .005 ? "in line" : fz(ue.total.fehlt)]
  ].map(x=>`<div><div class="l">${x[0]}</div><div class="v ${String(x[1]).charAt(0)==="\u2212"?"neg":""}">${x[1]}</div></div>`).join("");
  $("#sa-dia1").innerHTML = diaSigniert(reihe, "buchwert", r=>`<b>End of ${r.name} ${state.jahr}</b>`+tipZeile("Net book value", fz(r.buchwert))+tipZeile("Charge in month", fz(r.aufwand)));
  $("#sa-dia2").innerHTML = diaSigniert(reihe, "aufwand", r=>`<b>${r.name} ${state.jahr}</b>`+tipZeile("Depreciation", fz(r.aufwand)));
  // the offer to book this year's depreciation
  $("#sa-fort").innerHTML = fort.anlagen.length ? `<div class="fuss info" style="margin:0 0 12px;flex-wrap:wrap"><span>${fort.anlagen.length} asset${fort.anlagen.length>1?"s":""} with depreciation not booked yet in ${state.jahr}: ${fort.bookings.length} booking${fort.bookings.length>1?"s":""}, ${fz(fort.anlagen.reduce((s,a)=>s+a.betrag,0))}.</span>
    <button type="button" class="btn mini" id="sa-fort-ok" style="margin-left:auto">Book them</button></div>` : "";
  const fb = $("#sa-fort-ok"); if(fb) fb.onclick = ()=> fortfuehrenDialog({plaene:[], bookings:[]}, fort);
  // the register
  const liste = ue.anlagen.slice().sort((a, b)=> (a.abgegangen - b.abgegangen) || (a.anlage.datum < b.anlage.datum ? -1 : 1));
  $("#sa-tabelle").innerHTML = liste.length ? `<table class="band"><thead><tr><th>Asset</th><th>Account</th><th>Acquired</th><th class="num">Cost</th><th class="num">Residual</th><th>Life</th><th class="num">Depreciated</th><th class="num">Net book value</th><th class="num">Per month</th><th>Until</th><th>Status</th><th></th></tr></thead><tbody>`+
    liste.map(x=>{ const a = x.anlage, zu = istGeschlossen(state.jahr);
      const status = a.abgang ? `<span class="chip">${a.abgang.erloes > 0 ? "sold" : "scrapped"} ${fd(a.abgang.datum)}</span>` : (x.vorStart ? `<span class="chip">from ${a.start}</span>` : (Math.abs(x.fehlt) < .005 ? `<span class="chip gruen">in line</span>` : `<span class="chip amber">${x.fehlt > 0 ? "to book "+fz(x.fehlt) : "over by "+fz(-x.fehlt)}</span>`));
      return `<tr class="klickbar${saGewaehlt === a.id ? " an" : ""}" data-sa="${esc(a.id)}" title="Show the schedule"><td><b>${esc(a.text)}</b></td><td class="klein">${esc(a.konto)}${a.wb ? " / "+esc(a.wb) : ""} → ${esc(a.aufwand)}</td><td>${fd(a.datum)}</td>
        <td class="num">${f(a.kosten)}</td><td class="num">${f(a.restwert)}</td><td>${a.monate} m${a.rhythmus === "jahr" ? " · yearly" : ""}</td><td class="num">${f(x.abgegangen ? 0 : x.gebucht)}</td><td class="num"><b>${f(x.buchwert)}</b></td><td class="num">${x.abgegangen ? "–" : f(x.monatlich)}</td><td>${fd(x.ende+"-01").slice(3)}</td><td>${status}</td>
        <td style="white-space:nowrap">${zu ? "" : `<button type="button" class="btn leicht mini" data-sa-edit="${esc(a.id)}">Edit</button> ${a.abgang ? "" : `<button type="button" class="btn leicht mini" data-sa-abgang="${esc(a.id)}">Sell / scrap</button>`} <button type="button" class="weg" data-sa-del="${esc(a.id)}" aria-label="Remove">×</button>`}</td></tr>`; }).join("")+
    `<tr><td><b>Total</b></td><td></td><td></td><td class="num"><b>${f(ue.total.kosten)}</b></td><td></td><td></td><td class="num"><b>${f(ue.total.gebucht)}</b></td><td class="num"><b>${f(ue.total.buchwert)}</b></td><td colspan="4"></td></tr></tbody></table>`
    : `<p class="mut klein">No asset yet. Book a purchase onto an asset account and the register asks for the details, or register an asset that is already on the books.</p>`;
  $$("#sa-tabelle [data-sa]").forEach(tr=> tr.onclick = ()=>{ saGewaehlt = tr.dataset.sa; render(); });
  $$("#sa-tabelle [data-sa-edit]").forEach(b=> b.onclick = e=>{ e.stopPropagation(); anlageDialog({id:b.dataset.saEdit}); });
  $$("#sa-tabelle [data-sa-abgang]").forEach(b=> b.onclick = e=>{ e.stopPropagation(); abgangDialog(b.dataset.saAbgang); });
  $$("#sa-tabelle [data-sa-del]").forEach(b=> b.onclick = e=>{ e.stopPropagation(); anlageEntfernen(b.dataset.saDel); });
  // the schedule of the chosen asset
  const gew = liste.find(x=> x.anlage.id === saGewaehlt) || liste.find(x=> !x.abgegangen) || liste[0];
  if(!gew){ $("#sa-plan-titel").textContent = ""; $("#sa-plan").innerHTML = ""; return; }
  saGewaehlt = gew.anlage.id;
  const jahre = E.anlageJahre(state, gew.anlage), plan = E.anlagePlan(state, gew.anlage);
  $("#sa-plan-titel").textContent = gew.anlage.text+", straight-line to "+fz(gew.anlage.restwert)+" over "+gew.anlage.monate+" months from "+gew.anlage.start;
  const maxW = Math.max(gew.anlage.kosten, 1);
  $("#sa-plan").innerHTML = `<div class="zweispaltig"><div><table class="band"><thead><tr><th>Year</th><th class="num">Opening</th><th class="num">Depreciation</th><th class="num">Closing</th><th>Booked</th></tr></thead><tbody>`+
    jahre.map(j=>`<tr><td>${esc(j.jahr)}</td><td class="num">${f(j.anfang)}</td><td class="num">${f(j.aufwand)}</td><td class="num"><b>${f(j.ende)}</b></td><td>${j.offen === undefined ? `<span class="chip">by hand</span>` : (j.offen < .005 ? `<span class="chip gruen">booked</span>` : (j.gebucht > .005 ? `<span class="chip amber">${fz(j.offen)} open</span>` : `<span class="chip">open</span>`))}</td></tr>`).join("")+
    `</tbody></table></div><div><div class="bb-kopf"><span>Net book value at year end</span><span></span></div>`+diaSigniert(jahre.map(j=>({kurz:String(j.jahr).replace(/^before /,"<"), name:j.jahr, v:j.ende})), "v", r=>`<b>${esc(r.name)}</b>`+tipZeile("Net book value", fz(r.v)))+
    `<details style="margin-top:12px"><summary class="klein mut" style="cursor:pointer">Every month (${plan.zeilen.length})</summary><div class="tabelle" style="max-height:260px;overflow:auto"><table class="band klein"><tbody>`+
    plan.zeilen.map(z=>`<tr><td>${z.nr}</td><td>${esc(z.monat)}</td><td class="num">${z.betrag === null ? "–" : f(z.betrag)}</td><td class="mut">${({vorher:"before the register", fest:"booked, year closed", gebucht:"booked", offen:"to book", nach:"after the disposal"})[z.quelle]}</td></tr>`).join("")+`</tbody></table></div></details></div></div>`;
}
/* ---------- the dialog: a new asset, an existing one, or editing ---------- */
let anDialog = null;
function anlageDialog(o){
  o = o || {};
  const vorhanden = o.id ? (state.anlagen||[]).find(a=> a.id === o.id) : null;
  const a = vorhanden ? E.anlageNorm(vorhanden) : E.anlageNorm(Object.assign({id:"", datum:o.datum || heute(), konto:o.konto || "", kosten:o.kosten || 0, text:o.text || ""}, o.vorgabe||{}));
  if(!vorhanden){
    const v = E.anlageVorschlag(state, ix, a.konto); if(!a.wb && !("wb" in (o.vorgabe||{}))) a.wb = v.wb; if(!a.aufwand) a.aufwand = v.aufwand;
    if(!a.start) a.start = a.datum.slice(0,7);
    if(o.bestehend){ a.ab = heute().slice(0,4) === String(state.jahr) ? heute().slice(0,7) : state.jahr+"-01"; } else a.ab = a.start;
    if(!a.monate) a.monate = /auto|fahrzeug|car|vehicle/i.test(a.text+" "+kontoName(a.konto)) ? 48 : 36;
  }
  anDialog = {a:a, neu:!vorhanden, bestehend:!!o.bestehend, buchung:o.buchung || null, ausBuchung:!!o.ausBuchung};
  $("#an-titel").textContent = vorhanden ? "Edit asset" : (o.bestehend ? "Register an asset already on the books" : "New asset");
  $("#an-lead").textContent = vorhanden ? "Bookings of closed years stay as they are; the rest of the cost is spread evenly over the remaining months (prospective change of estimate)."
    : (o.bestehend ? "The depreciation booked by hand so far is entered once; the register continues from the month you choose." : "The register books the depreciation month by month against the contra account and shows the schedule before you confirm.");
  const anlageKonten = saKonten((k, g)=> E.istAnlageGruppe(g) && !/^\s*(abschreibung|wb|wertberichtigung|kumulierte|accumulated)/i.test(k.name));
  $("#an-konto").innerHTML = saOption(anlageKonten, a.konto, "Choose …");
  $("#an-text").value = a.text; $("#an-datum").value = fd(a.datum); $("#an-start").value = a.start; $("#an-ab").value = a.ab;
  $("#an-monate").value = a.monate; $("#an-kosten").value = a.kosten ? zahlFmt(a.kosten) : ""; $("#an-restwert").value = a.restwert ? zahlFmt(a.restwert) : ""; $("#an-vorher").value = a.vorher ? zahlFmt(a.vorher) : "";
  $("#an-rhythmus").value = a.rhythmus;
  $("#an-ab-box").hidden = !(o.bestehend || vorhanden); $("#an-vorher-box").hidden = !(o.bestehend || vorhanden);
  $("#an-nicht").hidden = !o.ausBuchung;
  $("#an-ok").textContent = vorhanden ? "Save and rebook" : "Register and book";
  anKontenFuellen(a); anVorschau();
  oeffneDialog("#dlg-anlage");
  setTimeout(()=>{ const el = $("#an-text"); if(el){ el.focus(); el.select && el.select(); } }, 30);
}
function anKontenFuellen(a){
  const k = ix.km[a.konto], grp = k ? k.grp : null;
  const wbListe = saKonten((x, g)=> x.grp === grp && x.nr !== a.konto);
  $("#an-wb").innerHTML = saOption(wbListe, a.wb, "— none, write the asset account down —");
  $("#an-aufwand").innerHTML = saOption(saKonten((x, g)=> E.istER(g) && g.vz !== -1), a.aufwand, "Choose …");
}
function anLesen(){
  const a = anDialog.a;
  a.text = $("#an-text").value.trim(); a.konto = $("#an-konto").value; a.wb = $("#an-wb").value; a.aufwand = $("#an-aufwand").value;
  a.datum = E.datumAusEingabe($("#an-datum").value, a.datum) || ""; a.start = $("#an-start").value; a.ab = anDialog.bestehend || !anDialog.neu ? ($("#an-ab").value || a.start) : a.start;
  a.monate = parseInt($("#an-monate").value, 10) || 0; a.kosten = E.r2(E.betragAusEingabe($("#an-kosten").value) || 0); a.restwert = E.r2(E.betragAusEingabe($("#an-restwert").value) || 0);
  a.vorher = anDialog.bestehend || !anDialog.neu ? E.r2(E.betragAusEingabe($("#an-vorher").value) || 0) : 0; a.rhythmus = $("#an-rhythmus").value;
  return E.anlageNorm(a);
}
function anVorschau(){
  if(!anDialog) return;
  const a = anLesen(); anDialog.a = a;
  const fehler = E.anlagePruefen(a, ix);
  const box = $("#an-vorschau");
  if(fehler.length){ box.innerHTML = `<div class="fuss schlecht" style="margin-top:8px">${esc(fehler[0])}</div>`; $("#an-ok").disabled = true; return; }
  $("#an-ok").disabled = false;
  const probe = Object.assign({}, state, {anlagen:(state.anlagen||[]).filter(x=> x.id !== a.id).concat([a])});
  const jahre = E.anlageJahre(probe, a), plan = E.anlagePlan(probe, a);
  const dieses = jahre.find(j=> j.jahr === String(state.jahr));
  box.innerHTML = `<div class="leiste" style="margin-top:10px"><div><div class="l">Depreciable</div><div class="v">${fz(plan.basis)}</div></div><div><div class="l">Per month</div><div class="v">${fz(plan.monatlich)}</div></div><div><div class="l">${state.jahr}</div><div class="v">${fz(dieses ? dieses.offen + dieses.gebucht : 0)}</div></div><div><div class="l">Last month</div><div class="v">${esc(plan.ende)}</div></div></div>
    <div class="zweispaltig" style="margin-top:12px;gap:14px"><div class="tabelle" style="max-height:220px;overflow:auto"><table class="band klein"><thead><tr><th>Year</th><th class="num">Opening</th><th class="num">Charge</th><th class="num">Closing</th></tr></thead><tbody>`+
    jahre.map(j=>`<tr><td>${esc(j.jahr)}</td><td class="num">${f(j.anfang)}</td><td class="num">${f(j.aufwand)}</td><td class="num"><b>${f(j.ende)}</b></td></tr>`).join("")+`</tbody></table></div>
    <div>${diaSigniert(jahre.map(j=>({kurz:String(j.jahr).replace(/^before .*$/,"<"), name:j.jahr, v:j.ende})), "v", r=>`<b>${esc(r.name)}</b>`+tipZeile("Net book value", fz(r.v)))}</div></div>`;
}
function anSpeichern(){
  if(!anDialog) return;
  const a = anLesen(), fehler = E.anlagePruefen(a, ix);
  if(fehler.length){ meldung(fehler.join(" "), {fehler:true}); return; }
  const neu = anDialog.neu;
  if(neu) a.id = "a"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  if(anDialog.buchung) a.buchung = anDialog.buchung;
  let n = 0;
  const ok = aendere(neu ? "Asset registered" : "Asset changed", ()=>{
    state.anlagen = (state.anlagen||[]).filter(x=> x.id !== a.id); state.anlagen.push(a);
    n = E.anlageNeuBuchen(state, ix, a, state.jahr, naechsteId);
  });
  if(!ok) return;
  schliesseDialog("#dlg-anlage"); anDialog = null; saGewaehlt = a.id;
  meldung((neu ? "Registered: " : "Saved: ")+a.text+", "+n+" depreciation booking"+(n===1?"":"s")+" in "+state.jahr+".", {aktion:{text:"Undo", fn:rueckgaengig}});
}
async function anlageEntfernen(id){
  const a = (state.anlagen||[]).find(x=> x.id === id); if(!a) return;
  const eigene = (state.buchungen||[]).filter(b=> b.plan && b.plan.id === id && !istGeschlossen(b.datum.slice(0,4)));
  const wahl = await frage("Remove "+esc(a.text)+" from the register?", eigene.length ? "It has "+eigene.length+" depreciation booking"+(eigene.length===1?"":"s")+" in open years. Keep them as ordinary bookings, or delete them with it?" : "No bookings of the register are affected.",
    [{text:"Cancel", wert:null, art:"leicht"}].concat(eigene.length ? [{text:"Keep bookings", wert:"behalten", art:"leicht"}, {text:"Delete bookings too", wert:"loeschen", art:"gefahr"}] : [{text:"Remove", wert:"behalten", art:"gefahr"}]));
  if(!wahl) return;
  aendere("Asset removed from the register", ()=>{
    state.anlagen = (state.anlagen||[]).filter(x=> x.id !== id);
    if(wahl === "loeschen") state.buchungen = state.buchungen.filter(b=> !(b.plan && b.plan.id === id && !istGeschlossen(b.datum.slice(0,4))));
    else state.buchungen.forEach(b=>{ if(b.plan && b.plan.id === id) delete b.plan; });
  });
}
/* ---------- disposal ---------- */
let abDialog = null;
function abgangDialog(id){
  const a = (state.anlagen||[]).find(x=> x.id === id); if(!a) return;
  abDialog = {id:id};
  $("#ab-titel").textContent = "Sell or scrap: "+a.text;
  $("#ab-datum").value = fd(heute().slice(0,4) === String(state.jahr) ? heute() : state.jahr+"-12-31"); $("#ab-erloes").value = "";
  $("#ab-konto").innerHTML = saOption(saKonten((k, g)=> g && g.s === "A" && (E.cfKonto(ix, k) === "fonds" || /^1[01]/.test(k.nr))), "1020", "Choose …");
  const ak = saAbgangKonten(); $("#ab-konten").textContent = "Gain to "+ak.gewinn+", loss to "+ak.verlust+(ak.neu.length ? " (created in the depreciation group on booking)" : "")+".";
  abVorschau(); oeffneDialog("#dlg-abgang");
}
function abLesen(){ const ak = saAbgangKonten(); return {datum:E.datumAusEingabe($("#ab-datum").value, heute()) || "", erloes:E.r2(E.betragAusEingabe($("#ab-erloes").value) || 0), konto:$("#ab-konto").value, gewinn:ak.gewinn, verlust:ak.verlust, neu:ak.neu}; }
function abVorschau(){
  if(!abDialog) return;
  const a = (state.anlagen||[]).find(x=> x.id === abDialog.id), o = abLesen();
  const ixProbe = o.neu.length ? E.ctx(Object.assign({}, state, {konten:state.konten.concat(o.neu)})) : ix;
  const r = E.anlageAbgang(state, ixProbe, a, o);
  const box = $("#ab-vorschau");
  if(!r.ok){ box.innerHTML = `<div class="fuss schlecht" style="margin-top:8px">${esc(r.fehler[0])}</div>`; $("#ab-ok").disabled = true; return; }
  $("#ab-ok").disabled = false;
  box.innerHTML = `<div class="leiste" style="margin-top:10px"><div><div class="l">Depreciated to ${fd(o.datum)}</div><div class="v">${fz(r.gebucht)}</div></div><div><div class="l">Net book value</div><div class="v">${fz(r.buchwert)}</div></div><div><div class="l">Proceeds</div><div class="v">${fz(r.erloes)}</div></div><div><div class="l">${r.ergebnis >= 0 ? "Gain" : "Loss"} on disposal</div><div class="v ${r.ergebnis < 0 ? "neg" : ""}">${fz(r.ergebnis)}</div></div></div>
    <p class="klein mut" style="margin:10px 0 0">${r.abschreibung} depreciation booking${r.abschreibung===1?"":"s"} added up to the disposal, ${r.umdatieren.length} moved to the disposal date, ${r.entfernen.length} later one${r.entfernen.length===1?"":"s"} removed, then: ${r.bookings[r.bookings.length-1].z.map(z=> esc(z[0])+" "+(z[1] ? "Dr "+fz(z[1]) : "Cr "+fz(z[2]))).join(" · ")}</p>`;
}
function abBuchen(){
  if(!abDialog) return;
  const a = (state.anlagen||[]).find(x=> x.id === abDialog.id), o = abLesen();
  const ok = aendere("Asset disposed of", ()=>{
    if(o.neu.length){ o.neu.forEach(k=> state.konten.push(k)); ix = E.ctx(state); }
    const r = E.anlageAbgang(state, ix, a, o);
    if(!r.ok) throw new Error(r.fehler.join(" "));
    E.anlageAbgangBuchen(state, a, r, naechsteId);
  }, {geruest:!!o.neu.length});
  if(!ok) return;
  schliesseDialog("#dlg-abgang"); abDialog = null;
  meldung("Disposal booked for "+a.text+".", {aktion:{text:"Undo", fn:rueckgaengig}});
}
/* ---------- wiring ---------- */
["#an-konto","#an-wb","#an-aufwand","#an-rhythmus","#an-start","#an-ab"].forEach(s=> $(s).addEventListener("change", ()=>{ if(s === "#an-konto" && anDialog){ const a = anLesen(); const v = E.anlageVorschlag(state, ix, a.konto); a.wb = v.wb; a.aufwand = v.aufwand || a.aufwand; anKontenFuellen(a); } anVorschau(); }));
["#an-text","#an-datum","#an-monate","#an-kosten","#an-restwert","#an-vorher"].forEach(s=> $(s).addEventListener("input", anVorschau));
$$("[data-an-jahre]").forEach(b=> b.onclick = ()=>{ $("#an-monate").value = +b.dataset.anJahre*12; anVorschau(); });
$("#an-ok").onclick = anSpeichern;
$("#an-nicht").onclick = ()=>{ schliesseDialog("#dlg-anlage"); anDialog = null; };
$("#an-abbruch").onclick = ()=>{ schliesseDialog("#dlg-anlage"); anDialog = null; };
["#ab-datum","#ab-erloes"].forEach(s=> $(s).addEventListener("input", abVorschau)); $("#ab-konto").addEventListener("change", abVorschau);
$("#ab-ok").onclick = abBuchen; $("#ab-abbruch").onclick = ()=>{ schliesseDialog("#dlg-abgang"); abDialog = null; };
$("#sa-neu").onclick = ()=>{
  const konten = saKonten((k, g)=> E.anlageKonto(ix, k.nr));
  const s = E.saldoPer(state, state.jahr+"-12-31");
  const mit = konten.filter(k=> Math.abs(s[k.nr]||0) > .005 && !(state.anlagen||[]).some(a=> a.konto === k.nr && a.status !== "abgegangen"));
  const k = mit[0] || konten[0];
  if(!k){ meldung("No fixed-asset account in the chart. Flag the group on the Structure page first.", {fehler:true}); return; }
  const v = E.anlageVorschlag(state, ix, k.nr), heuteM = heute().slice(0,7);
  const vorMonat = E.monatPlus(heuteM, -1), sVor = E.saldoPer(state, E.monatsende(vorMonat));
  const vorher = v.wb ? E.r2(-(sVor[v.wb]||0)) : 0;
  anlageDialog({bestehend:true, konto:k.nr, kosten:E.r2(s[k.nr]||0), text:kontoName(k.nr).replace(/\s*\(.*$/, ""), datum:state.jahr+"-01-01", vorgabe:{vorher:vorher > 0 ? vorher : 0}});
};

/* ---------- Hooks: how the engine talks to the app ------------------- */
let FS_AKTUELL = null;      // engine of the page on screen; its S holds the editable settings
function fsHooks(){
  return {
    toast: (m, art) => meldung(m, {fehler: art === "err"}),
    touch: neu => fsSpeichern(neu),
    go: p => zeigeTab({bs:"bilanz", is:"erfolg", cf:"geldfluss", inv:"anlagen", ov:"ueberjahre"}[p] || p)
  };
}
function fsSpeichern(neuZeichnen){
  const S = FS_AKTUELL && FS_AKTUELL.S; if(!S) return;
  aendere("Statement settings changed", ()=>{
    state.auswertung = state.auswertung || {};
    ["cfOverrides","ncOverrides","ncTx","investments","forecast","invView"].forEach(k=>{ if(S[k] !== undefined && S[k] !== null) state.auswertung[k] = JSON.parse(JSON.stringify(S[k])); });
  }, {render: !!neuZeichnen});
}
// statements, settings and exports: the selected year with its months
function fsKern(){
  const st = state.ui.fs || {};
  const K = fsDaten(state, ix, E, {jahr:state.jahr, p:st.p, c:st.c, hooks:fsHooks(),
    zerosBS: $("#bi-null") && $("#bi-null").checked, zerosIS: $("#er-null") && $("#er-null").checked, cfShowAll: $("#cfShowAll") && $("#cfShowAll").checked});
  FS_AKTUELL = K;
  return K;
}
// overview and investments: every month end of every year, up to the last completed month
function fsVerlauf(){
  const h = heute(), jetzt = h.slice(0,7);
  const vor = h.slice(5,7) === "01" ? (+h.slice(0,4)-1)+"-12" : h.slice(0,4)+"-"+String(+h.slice(5,7)-1).padStart(2,"0");
  const jahre = Object.keys(E.jahreMitBuchungen(state)).map(Number);
  const letztes = jahre.length ? Math.max.apply(null, jahre) : state.jahr;
  const bis = String(letztes) < vor.slice(0,4) ? letztes+"-12" : vor;
  const j = +bis.slice(0,4);
  const K = fsDaten(state, ix, E, {jahr:j, alleMonate:true, ohneEroeffnung:true, bis:bis, hooks:fsHooks()});
  const per = K.periods(), p = per.indexOf(bis) >= 0 ? bis : per[per.length-1];
  const c = per.indexOf((j-1)+"-12") >= 0 && p !== (j-1)+"-12" ? (j-1)+"-12" : per[Math.max(0, per.indexOf(p)-1)];
  K.S.activePeriod = p; K.S.comparePeriod = c;
  FS_AKTUELL = K;
  return K;
}
function renderUeberJahre(){
  const K = fsVerlauf();
  setzeUntertitel("All years in this file, up to the last completed month");
  K.renderOverview();
  fsDonut(K);
}
// doughnut of the investments ticked under Statement settings
const DONUT_FARBEN = ["#1F3F66","#2F5E91","#4A7DB5","#7FA3CC","#A9BDD6","#627A94","#8FA6BF","#C7D6EA","#3D5A80","#98AEC8"];
function fsDonut(K){
  const p = K.S.activePeriod, summe = accs => K.r2(accs.reduce((s, a)=> s + K.accVal(p, a), 0));
  const teile = K.investments().filter(i=> i.include).map(i=>({label:i.label, wert:K.r2(summe(i.pay)+summe(i.adj)), bezahlt:summe(i.pay)}))
    .filter(x=> x.wert > .005).sort((a,b)=> b.wert - a.wert);
  const total = K.r2(teile.reduce((s, x)=> s + x.wert, 0));
  $("#ovDonutMeta").textContent = "as at "+fd(K.rep(p).asOf)+", "+K.CUR();
  const svg = $("#ovDonut"), liste = $("#ovDonutListe");
  if(!teile.length){ svg.innerHTML = ""; liste.innerHTML = `<p class="mut klein">No investment ticked yet. Tick them under Setup, Statement settings.</p>`; return; }
  const r = 84, u = 2*Math.PI*r; let lauf = 0;
  svg.innerHTML = `<circle cx="110" cy="110" r="${r}" fill="none" stroke="var(--papier2)" stroke-width="26"/>`+
    teile.map((x, i)=>{ const l = x.wert/total*u, gap = teile.length > 1 ? Math.min(2, l/3) : 0;
      const seg = `<circle class="seg" data-i="${i}" cx="110" cy="110" r="${r}" fill="none" stroke="${DONUT_FARBEN[i % DONUT_FARBEN.length]}" stroke-width="26"
        stroke-dasharray="${(l-gap).toFixed(2)} ${(u-l+gap).toFixed(2)}" stroke-dashoffset="${(-lauf).toFixed(2)}" transform="rotate(-90 110 110)"
        data-tip="${esc(`<b>${esc(x.label)}</b>`+tipZeile("Value", K.fmt(x.wert))+tipZeile("Paid in", K.fmt(x.bezahlt))+tipZeile("Share", (x.wert/total*100).toFixed(1)+"%"))}"/>`;
      lauf += l; return seg; }).join("")+
    `<text x="110" y="104" text-anchor="middle" class="d-l">Invested</text><text x="110" y="126" text-anchor="middle" class="d-v">${esc(K.fmt(total))}</text>`;
  liste.innerHTML = teile.map((x, i)=>`<div class="z" data-i="${i}"><i style="background:${DONUT_FARBEN[i % DONUT_FARBEN.length]}"></i><span class="t">${esc(x.label)}</span>
    <span class="num">${K.fmt(x.wert)}</span><span class="num mut">${(x.wert/total*100).toFixed(1)}%</span></div>`).join("");
  const hell = i => { $$("#ovDonut .seg").forEach(c=> c.classList.toggle("blass", i !== null && c.dataset.i !== String(i)));
    $$("#ovDonutListe .z").forEach(z=> z.classList.toggle("an", z.dataset.i === String(i))); };
  $$("#ovDonut .seg, #ovDonutListe .z").forEach(el=>{ el.addEventListener("mouseenter", ()=> hell(el.dataset.i)); el.addEventListener("mouseleave", ()=> hell(null)); });
  if(BEWEGUNG) svg.classList.remove("ein"), void svg.getBoundingClientRect(), svg.classList.add("ein");
}
function renderAnlagen(){
  const K = fsVerlauf();
  setzeUntertitel("");
  K.renderInv();
}
function renderFsEinstellungen(){
  const K = fsKern(); fsWahl(K);
  setzeUntertitel("Movements from "+K.periodLabel(K.S.comparePeriod)+" to "+K.periodLabel(K.S.activePeriod));
  renderCfKlassen(K);
  K.renderInvMap();
}
// cash flow class of every balance sheet account (stored as cfOverrides where it differs from the number range)
const CF_KLASSEN = [["cash","Cash"],["opAsset","Operating (assets)"],["opLiab","Operating (liabilities)"],["invest","Investing"],["finLiab","Financing (debt)"],["equity","Financing (equity)"]];
function renderCfKlassen(K){
  const t = $("#cfMapTable"); if(!t) return;
  const w = fsWahl(K), alle = $("#cfShowAll").checked, ov = K.S.cfOverrides = K.S.cfOverrides || {};
  const cf = w.p !== w.c ? cfDirektZwischen(K, state, w.p, w.c) : null, fluss = {};
  if(cf) ["op","inv","fin","fx"].forEach(k=> cf.bereiche[k].forEach(l=> l.konten.forEach(o=> fluss[o.a] = o.v)));
  const auto = a => { const o = ov[a]; delete ov[a]; const k = K.cfClassOf(a); if(o !== undefined) ov[a] = o; return k; };
  const zeile = (state.auswertung || {}).cfZeile || {};
  const isGruppen = K.IS.filter(n=> n.k === "g");
  const liste = K.allAccounts().filter(a=> +a < 3000 && (alle || ov[a] || zeile[a] || fluss[a] !== undefined));   // bank accounts only with "Show every account"; cards in cash carry an override
  t.innerHTML = `<thead><tr><th>Acct</th><th>Name</th><th class="num">Cash flow</th><th>Section</th><th>Shown under</th></tr></thead><tbody>`+
    liste.map(a=>{
      const k = K.cfClassOf(a), eigen = ov[a] && ov[a] !== auto(a);
      return `<tr><td style="font-variant-numeric:tabular-nums;font-size:12px">${esc(a)}</td><td>${esc(K.nameOf(a))}</td>`+
        `<td class="num">${fluss[a] !== undefined ? K.fmt(fluss[a]) : k === "cash" ? '<span class="mut">cash</span>' : "–"}</td>`+
        `<td><select class="pill" style="padding:5px 26px 5px 9px;font-size:12px" data-cfk="${esc(a)}">`+
        CF_KLASSEN.map(([v, l])=>`<option value="${v}"${v === k ? " selected" : ""}>${esc(l)}${v === auto(a) && eigen ? " (default)" : ""}</option>`).join("")+
        `</select>${eigen ? ' <span class="chip">set</span>' : ""}</td>`+
        `<td>${k === "opAsset" || k === "opLiab" ? `<select class="pill" style="padding:5px 26px 5px 9px;font-size:12px" data-cfz="${esc(a)}">`+
          `<option value="">its own group</option>`+isGruppen.map(g=>`<option value="${esc(g.id)}"${zeile[a] === g.id ? " selected" : ""}>${esc(g.l)}</option>`).join("")+`</select>` : ""}</td></tr>`;
    }).join("")+`</tbody>`;
  $$("[data-cfz]", t).forEach(sel=> sel.onchange = ()=>{
    const a = sel.dataset.cfz;
    aendere("Cash flow: "+a+(sel.value ? " shown under "+((K.GROUPS[sel.value] || {}).l || sel.value) : " shown under its own group"), ()=>{
      state.auswertung = state.auswertung || {}; const z = state.auswertung.cfZeile = state.auswertung.cfZeile || {};
      if(sel.value) z[a] = sel.value; else delete z[a];
    });
  });
  $$("[data-cfk]", t).forEach(sel=> sel.onchange = ()=>{
    const a = sel.dataset.cfk, d = auto(a);
    if(sel.value === d) delete ov[a]; else ov[a] = sel.value;
    K.S.touch(true);
  });
}
/* ---------- Financial statements report (layout of 10 October) ------- */
// rows straight from the engine's own tables, so figures and grouping are exactly the statement pages'
function fsZeilen(html, detail){
  const t = document.createElement("table"); t.innerHTML = html;
  const reihen = Array.from(t.querySelectorAll("tbody tr")), aus = [];
  reihen.forEach((tr, i)=>{
    const k = tr.classList;
    if(k.contains("spacer")) return;
    if(k.contains("sec")){ aus.push({typ:"bereich", text:tr.textContent.trim()}); return; }
    if(k.contains("leaf") && !detail) return;
    const nums = Array.from(tr.querySelectorAll("td.num")).map(td=>({t:td.textContent.trim(), neg:td.classList.contains("neg")}));
    const acct = tr.querySelector("td.acct"), lbl = tr.querySelector("td.lbl") || tr.children[1];
    let typ = k.contains("leaf") ? "konto" : k.contains("grp") ? "position" : k.contains("tot") ? "total" : "summe";
    if(typ === "position" && detail){ const n = reihen[i+1]; if(n && n.classList.contains("leaf")) typ = "gruppe"; }
    aus.push({typ:typ, nr:acct ? acct.textContent.trim() : "", text:(lbl ? lbl.textContent : "").replace(/[▸▾]/g,"").trim(), w:nums[0], v:nums[1], d:nums[2]});
  });
  return aus;
}
function fsBericht(sum){
  const K = fsKern(); const w = fsWahl(K), p = w.p, c = w.c, G = K.GROUPS, R = K.rep(p);
  const status = $("#ex-status").value, detail = !sum;
  const titel = R.basis === "YTD" ? "Interim statements as at "+fd(R.asOf) : "Annual statements "+p.slice(0,4);
  const vgl = K.periodLabel(c), cur = K.CUR();
  const fussText = (state.mandant+" · "+titel).replace(/["\\]/g,"");
  const zelle = (x, kl) => !x ? `<td class="z ${kl||""}"></td>` : `<td class="z ${kl||""} ${x.neg?"neg":""}">${x.t === "0.00" ? "–" : esc(x.t)}</td>`;
  const zahl = (n, kl) => `<td class="z ${kl||""} ${n < -0.005 ? "neg" : ""}">${Math.abs(n) < .005 ? "–" : K.fmt(n)}</td>`;
  const tabelle = (zeilen, kopfW, kopfV) => `<table><thead><tr><th class="l" colspan="2"></th><th>${esc(kopfW)}</th>${kopfV?`<th>${esc(kopfV)}</th><th>Change</th>`:""}</tr></thead><tbody>`+
    zeilen.map(x=> x.typ === "bereich" ? `<tr class="bereich"><td colspan="${kopfV?5:3}">${esc(x.text)}</td></tr>`
      : `<tr class="${x.typ}"><td class="nr">${esc(x.nr||"")}</td><td class="t">${esc(x.text)}</td>${zelle(x.w)}${kopfV?zelle(x.v,"v")+zelle(x.d,"d"):""}</tr>`).join("")+`</tbody></table>`;
  let rosette = ""; for(let j=0;j<10;j++) rosette += `<path d="${rosettenPfad(100,100,48+j*4.2,3.2,24,j*.45)}"/>`;
  // key figures, all from the statement engine
  const ta = K.nodeVal(G.TA,p), tl = K.nodeVal(G.TL,p), eq = K.nodeVal(G.EQ,p), cash = K.nodeVal(G.FONDS,p);
  const taC = K.nodeVal(G.TA,c), tlC = K.nodeVal(G.TL,c), eqC = K.nodeVal(G.EQ,c), cashC = K.nodeVal(G.FONDS,c);
  const ti = K.nodeVal(G.TI,p), np = K.nodeVal(G.NP,p), tiC = K.nodeVal(G.TI,c), npC = K.nodeVal(G.NP,c);
  const pz2 = x => isFinite(x) ? (x*100).toFixed(1)+"%" : "–";
  const cf = p !== c ? cfDirektZwischen(K, state, p, c) : null;
  const kennz = [["Total assets", ta, taC], ["Total liabilities", tl, tlC], ["Net worth (equity)", eq, eqC], ["Cash and cash equivalents", cash, cashC],
    ["Cash, equivalents and investments", cash+K.investedAt(p), cashC+K.investedAt(c)], ["Total income", ti, tiC], ["Total expenses", -(ti-np), -(tiC-npC)],
    ["Result for the period", np, npC]];
  const set = K.investments().filter(i=> i.include);
  const summe = (q, accs) => K.r2(accs.reduce((s, a)=> s + K.accVal(q, a), 0));
  const teile = [{id:"kennzahlen", t:"Key figures"}, {id:"bilanz", t:"Balance sheet"}, {id:"erfolg", t:"Income statement"}].concat(cf ? [{id:"geldfluss", t:"Cash flow statement"}] : []).concat(set.length ? [{id:"anlagen", t:"Investments"}] : []);
  let erste = true; const seite = () => { const k = erste ? "rb-erste" : "rb-seite"; erste = false; return k; };
  const sub = `<div class="rb-sub">${esc(state.mandant)}, ${esc(titel)}, compared with ${esc(vgl)}, amounts in ${esc(cur)}</div>`;
  let h = `<style>
    @page{size:A4;margin:18mm 17mm 20mm 17mm;@bottom-left{content:"${fussText}";font:8pt -apple-system,"Segoe UI",sans-serif;color:#6b7684}
      @bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt -apple-system,"Segoe UI",sans-serif;color:#6b7684}}
    #bericht{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#101C2B;font-size:9.5pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    #bericht .rb-seite{page-break-before:always} #bericht .rb-erste{page-break-before:auto}
    #bericht .rb-deck{height:245mm;display:flex;flex-direction:column;justify-content:center;position:relative}
    #bericht .rb-deck svg{position:absolute;right:-6mm;top:8mm;width:96mm;height:96mm;opacity:.9}
    #bericht .rb-deck .m{font-size:13pt;color:#48566A}
    #bericht .rb-deck h1{font-size:30pt;font-weight:600;letter-spacing:-.02em;margin:4mm 0 2mm;line-height:1.1}
    #bericht .rb-deck .u{font-size:11pt;color:#48566A}
    #bericht .rb-deck .meta{margin-top:24mm;font-size:9pt;color:#48566A;line-height:1.7}
    #bericht .rb-deck .inhalt{margin-top:10mm;font-size:10pt}
    #bericht .rb-deck .inhalt div{padding:1.2mm 0;border-bottom:.3pt solid #DDE4EE;max-width:90mm}
    #bericht h2{font-size:15pt;font-weight:600;margin:0 0 1mm;letter-spacing:-.01em}
    #bericht .rb-sub{color:#48566A;font-size:9pt;margin-bottom:5mm}
    #bericht table{width:100%;border-collapse:collapse}
    #bericht th{font-size:8pt;font-weight:600;color:#8592A6;text-align:right;border-bottom:.6pt solid #101C2B;padding:1.4mm 1.8mm}
    #bericht th:first-child,#bericht th.l{text-align:left}
    #bericht td{padding:1.15mm 1.8mm;vertical-align:top}
    #bericht td.z{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;width:27mm}
    #bericht td.v{color:#48566A} #bericht td.d{color:#8592A6;width:22mm}
    #bericht td.nr{width:13mm;color:#48566A}
    #bericht .neg{color:#A6262D}
    #bericht tr.bereich td{font-size:11pt;font-weight:600;padding-top:4mm;color:#101C2B}
    #bericht tr.position td,#bericht tr.konto td{border-bottom:.3pt solid #E3E8EF}
    #bericht tr.konto td{color:#48566A} #bericht tr.konto td.t{padding-left:5mm}
    #bericht tr.gruppe td{font-weight:600;border-top:.4pt solid #B8C4D4}
    #bericht tr.summe td{font-weight:600;border-top:.6pt solid #101C2B;background:#F3F6FB}
    #bericht tr.total td{font-weight:700;border-top:.6pt solid #101C2B;border-bottom:1.8pt double #101C2B;font-size:10.5pt}
    #bericht tr{page-break-inside:avoid}
    #bericht .rb-h3{font-size:11pt;font-weight:600;margin:6mm 0 1mm;color:#101C2B}
    #bericht .rb-hinweis{margin-top:4mm;font-size:8.5pt;color:#6E4C06;background:#FBF3E1;padding:2mm 3mm;border-radius:2mm}
    #bericht .rb-wz{position:fixed;left:0;right:0;top:42%;text-align:center;font-size:96pt;font-weight:700;color:rgba(166,38,45,.07);transform:rotate(-24deg);pointer-events:none;letter-spacing:.06em}
  </style>`;
  if(status === "entwurf") h += `<div class="rb-wz">Draft</div>`;
  h += `<section class="rb-deck ${seite()}"><svg viewBox="0 0 200 200" fill="none" stroke="#2F5E91" stroke-width=".5" opacity=".55">${rosette}</svg>
    <div class="m">${esc(state.mandant)}</div><h1>${esc(titel)}</h1>
    <div class="u">Compared with ${esc(vgl)}${sum ? ", summarized" : ""}</div>
    <div class="inhalt">${teile.map(x=>`<div>${esc(x.t)}</div>`).join("")}</div>
    <div class="meta">Currency ${esc(cur)}<br>${status === "entwurf" ? "Draft" : "Final version"}, created on ${fd(heute())}</div></section>`;
  h += `<section class="${seite()}"><h2>Key figures</h2>${sub}<table><thead><tr><th class="l">Key figure</th><th>${esc(K.periodLabel(p))}</th><th>${esc(vgl)}</th><th>Change</th></tr></thead><tbody>`+
    kennz.map(x=>`<tr class="position"><td>${esc(x[0])}</td>${zahl(x[1])}${zahl(x[2],"v")}${zahl(K.r2(x[1]-x[2]),"d")}</tr>`).join("")+
    `<tr class="position"><td>Savings rate</td><td class="z">${pz2(ti ? np/ti : NaN)}</td><td class="z v">${pz2(tiC ? npC/tiC : NaN)}</td><td class="z d"></td></tr>`+
    (cf ? `<tr class="bereich"><td colspan="4">Cash flow, ${esc(vgl)} → ${esc(K.periodLabel(p))}</td></tr>`+
      [["Operating activities", cf.operating], ["Investing activities", cf.investing], ["Financing activities", cf.financing]].map(x=>`<tr class="position"><td>${x[0]}</td>${zahl(x[1])}<td></td><td></td></tr>`).join("")+
      `<tr class="summe"><td>Net change in cash</td>${zahl(cf.change)}<td></td><td></td></tr>` : "")+`</tbody></table></section>`;
  h += `<section class="${seite()}"><h2>Balance sheet</h2>${sub}${tabelle(fsZeilen(K.statementHTML(K.BS, p, c, $("#bi-null").checked, true, sum), detail), K.periodLabel(p), vgl)}`+
    (K.nil(K.r2(ta - K.nodeVal(G.TLE,p))) ? "" : `<div class="rb-hinweis">Assets and liabilities differ by ${K.fmt(K.r2(ta - K.nodeVal(G.TLE,p)))}.</div>`)+`</section>`;
  h += `<section class="${seite()}"><h2>Income statement</h2>${sub}${tabelle(fsZeilen(K.statementHTML(K.IS, p, c, $("#er-null").checked, true, sum), detail), K.periodLabel(p), vgl)}`+
    (K.monthsOf(p) === K.monthsOf(c) ? "" : `<div class="rb-hinweis">${K.monthsOf(p)} months compared with ${K.monthsOf(c)}: not like for like.</div>`)+`</section>`;
  if(cf){
    const [fruehP, spaetP] = cf.rueckwaerts ? [p, c] : [c, p];
    cf.vonDatum = K.rep(fruehP).asOf; cf.bisDatum = K.rep(spaetP).asOf;
    h += `<section class="${seite()}"><h2>Cash flow statement</h2><div class="rb-sub">${esc(state.mandant)}, cash in and out from ${fd(cf.von)} to ${fd(cf.bis)}, direct method from the bookings, amounts in ${esc(cur)}</div>`+
      tabelle(gfBerichtZeilen(K, cf, detail), K.periodLabel(fruehP)+" → "+K.periodLabel(spaetP), null)+
      (cf.nichtGeld.length ? `<h3 class="rb-h3">Non-cash transactions</h3>`+tabelle(cf.nichtGeld.map(o=>({typ:"position", nr:o.konten.join(" · "), text:o.l, w:{t:K.fmt(o.betrag)}})), "Not in the cash flow", null) : "")+
      (K.nil(cf.check) ? "" : `<div class="rb-hinweis">The cash flow differs from the change in cash by ${K.fmt(cf.check)}.</div>`)+`</section>`;
  }
  if(set.length){
    const jahre = (K.S.forecast && K.S.forecast.years) || 10;
    const zeilen = set.map(i=>{ const pay = summe(p, i.pay), adj = summe(p, i.adj), ser = K.buildSeries([i], jahre), last = ser[ser.length-1];
      return {i:i, pay:pay, adj:adj, val:K.r2(pay+adj), prog: last ? last.val : NaN}; });
    const tot = k => K.r2(zeilen.reduce((s, z)=> s + (isFinite(z[k]) ? z[k] : 0), 0));
    h += `<section class="${seite()}"><h2>Investments</h2><div class="rb-sub">${esc(state.mandant)}, as at ${fd(R.asOf)}, amounts in ${esc(cur)}</div>
      <table><thead><tr><th class="l">Investment</th><th>Paid in</th><th>Value adjustment</th><th>Value</th><th>Monthly pay-in</th><th>Return p.a.</th><th>In ${jahre} years</th></tr></thead><tbody>`+
      zeilen.map(z=>`<tr class="position"><td>${esc(z.i.label)}</td>${zahl(z.pay)}${zahl(z.adj)}${zahl(z.val)}<td class="z v">${K.fmt(z.i.monthly||0)}</td><td class="z v">${((z.i.ret||0)).toFixed(1)}%</td>${zahl(z.prog,"v")}</tr>`).join("")+
      `<tr class="total"><td>Total</td>${zahl(tot("pay"))}${zahl(tot("adj"))}${zahl(tot("val"))}<td></td><td></td>${zahl(tot("prog"))}</tr></tbody></table>
      <div class="rb-sub" style="margin-top:3mm">The forecast compounds the monthly pay-in and the expected annual return of each investment. It is an assumption, not a promise.</div></section>`;
  }
  drucke(h, heute()+"_FINANCIAL STATEMENTS "+p+(sum ? " SUMMARY" : ""));
}
function fsExcelExport(){
  const K = fsKern(); const w = fsWahl(K);
  let blob;
  try{ blob = K.buildXLSX(); }catch(err){ meldung("Could not build the workbook: "+(err.message||err), {fehler:true}); return; }
  ablegen(blob, heute()+"_FINANCIAL STATEMENTS "+w.p+".xlsx");
  schliesseDialog("#dlg-export");
  meldung("Excel workbook created: "+K.periodLabel(w.p)+" compared with "+K.periodLabel(w.c)+".");
}
/* ---------- Controls on the investment and settings pages ------------ */
$("#selInv").onchange = e=>{ if(!FS_AKTUELL) return; FS_AKTUELL.S.invView = e.target.value; fsSpeichern(true); };
$("#yrsRange").addEventListener("input", e=>{ if(!FS_AKTUELL) return; FS_AKTUELL.S.forecast.years = +e.target.value;
  e.target.style.setProperty("--fill", (+e.target.value/30)*100+"%"); FS_AKTUELL.renderInv(); });
$("#yrsRange").addEventListener("change", ()=> fsSpeichern(false));
$("#btnResetFc").onclick = ()=>{ if(FS_AKTUELL) FS_AKTUELL.resetForecast(); };
$("#cfShowAll").onchange = render;

