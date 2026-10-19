/* =====================================================================
   IMPORT OF CLOSING BALANCES
   ===================================================================== */
let imp = null;
function oeffneImport(zweck){
  imp = {zeilen:null, blaetter:null, quelle:"", analyse:null, zuordnung:{}, zweck: zweck === "eroeffnung" ? "eroeffnung" : "vergleich"};
  $("#im-text").value = ""; $("#im-dateiname").textContent = ""; $("#im-blatt-box").hidden = true;
  $("#im-analyse").innerHTML = ""; $("#im-ok").disabled = true;
  oeffneDialog("#dlg-import");
}
function importAnalyse(){
  if(!imp || !imp.zeilen){ $("#im-analyse").innerHTML = ""; $("#im-ok").disabled = true; return; }
  const a = E.analysiereSalden(imp.zeilen, ix);
  imp.analyse = a;
  if(!a.ok){ $("#im-analyse").innerHTML = `<div class="fuss schlecht">${esc(a.fehler)}</div>`; $("#im-ok").disabled = true; return; }
  if(imp.saldo === undefined || !a.zahlSpalten.some(s=>s.idx===imp.saldo)) imp.saldo = a.vorschlagSaldo;
  if(imp.vorjahr === undefined) imp.vorjahr = a.vorschlagVorjahr;
  if(!imp.jahrManuell){
    const titel = (a.zahlSpalten.find(s=>s.idx===imp.saldo)||{}).titel || "";
    const ausTitel = /(\d{4})-\d{2}-\d{2}/.exec(titel) || /\d{1,2}\.\d{1,2}\.(\d{4})/.exec(titel);
    const ausName = /(20\d{2})/.exec(imp.quelle||"");
    imp.jahr = ausTitel ? +ausTitel[1] : (ausName ? +ausName[1] : state.jahr - 1);
  }
  if(!imp.modus) imp.modus = E.besterModus(a, imp.saldo, ix, importZuordnung());
  importDarstellen();
}
function importZuordnung(){
  const zu = {};
  Object.keys(imp.zuordnung).forEach(nr=>{ const g = ix.gm[imp.zuordnung[nr]];
    if(g) zu[nr] = {natur:(g.s === "A" || (g.s === "E" && g.vz !== -1)) ? "soll" : "haben", aktiv: g.s === "A"}; });
  return zu;
}
function importBerechne(spalte){
  const extra = {};
  Object.keys(imp.zuordnung).forEach(nr=>{ const g = ix.gm[imp.zuordnung[nr]]; if(g) extra[nr] = g; });
  const r = E.saldenAusImport(imp.analyse, spalte, imp.modus, ix, importZuordnung());
  r.pruefung = E.pruefeSalden(r.salden, ix, extra);
  return r;
}
function importDarstellen(){
  const a = imp.analyse, eroeffnung = imp.zweck === "eroeffnung";
  const opt = sel => a.zahlSpalten.map(s=>`<option value="${s.idx}"${s.idx===sel?" selected":""}>${esc(s.titel)}</option>`).join("");
  const haupt = importBerechne(imp.saldo);
  const vj = !eroeffnung && imp.vorjahr >= 0 ? importBerechne(imp.vorjahr) : null;
  const unbekannt = haupt.unbekannt.concat(vj ? vj.unbekannt.filter(u=>!haupt.unbekannt.some(x=>x.nr===u.nr)) : []);
  const pz = (j, r) => { const p = r.pruefung, ok = Math.abs(p.differenz) < .005;
    return `<tr><td><b>${j}</b></td><td class="num">${f(p.aktiven)}</td><td class="num">${f(p.passiven)}</td><td class="${cls(p.ergebnis)}">${p.mitErfolg?f(p.ergebnis):"not included"}</td>
      <td>${ok?'<span class="chip gruen">balances</span>':'<span class="chip rot">difference '+fz(p.differenz)+'</span>'}</td></tr>`; };
  const okH = Math.abs(haupt.pruefung.differenz) < .005, okV = !vj || Math.abs(vj.pruefung.differenz) < .005;
  const hinweise = [];
  if(a.ignoriert.length) hinweise.push(a.ignoriert.length+" group or total row(s) skipped ("+a.ignoriert.slice(0,4).map(x=>x.nr+(x.text?" "+x.text:"")).join(", ")+(a.ignoriert.length>4?" …":"")+").");
  if(a.doppelt.length) hinweise.push("Listed twice and added up: "+a.doppelt.join(", ")+".");
  if(haupt.mehrStellen) hinweise.push(haupt.mehrStellen+" amount(s) with more than two decimals. Check the number format.");
  let eb = null;
  if(eroeffnung){
    const ziel = Object.assign({}, haupt.salden);
    eb = E.eroeffnungAusSalden(state, Object.assign({}, ix, {km:Object.assign({}, ix.km, Object.keys(imp.zuordnung).reduce((o,nr)=>{ o[nr] = {nr:nr, grp:imp.zuordnung[nr]}; return o; }, {}))}), ziel);
    const vorhanden = state.buchungen.some(b=>b.eb);
    hinweise.push("Opening balance "+state.jahr+": equity of "+fz(eb.eigenkapital)+" on "+(eb.gewinnvortrag||"?")+" (including the result "+(imp.jahr)+" of "+fz(eb.ergebnis)+"), "+eb.zeilen.length+" lines."+(vorhanden?" Replaces the current opening balance.":""));
    if(!eb.gewinnvortrag) hinweise.push("The equity-at-beginning account is missing; set it under Accounts.");
    hinweise.push("The closing "+imp.jahr+" is also kept as comparison year.");
  }else{
    const vorhanden = (state.vergleichsjahre||[]).filter(v=>v.jahr===imp.jahr || (vj && v.jahr===imp.jahr-1)).map(v=>v.jahr);
    if(vorhanden.length) hinweise.push("Replaces the imported closing "+vorhanden.join(" and ")+".");
    if(imp.jahr === state.jahr) hinweise.push("That is the current financial year of this file.");
    if(imp.jahr === state.jahr-1 || (vj && imp.jahr-1 === state.jahr-1)) hinweise.push("The closing "+(state.jahr-1)+" becomes the opening balance "+state.jahr+" of this file. Nothing is booked.");
  }
  if(!haupt.pruefung.mitErfolg) hinweise.push("The list has no income statement accounts. The balance sheet difference counts as the result.");
  $("#im-analyse").innerHTML = `<div class="schritt"><h4>Found ${a.konten.length} accounts</h4>
    <div style="display:grid;grid-template-columns:repeat(${eroeffnung?3:4},minmax(0,1fr));gap:10px">
      <div class="feld"><label for="im-sp">Closing balance</label><select class="eingabe" id="im-sp">${opt(imp.saldo)}</select></div>
      <div class="feld"><label for="im-jahr">of the year</label><input class="eingabe num" type="number" id="im-jahr" value="${imp.jahr}" ${eroeffnung?"disabled":""}></div>
      ${eroeffnung?"":`<div class="feld"><label for="im-vj">Prior-year column</label><select class="eingabe" id="im-vj"><option value="-1">none</option>${opt(imp.vorjahr)}</select></div>`}
      <div class="feld"><label for="im-modus">Signs</label><select class="eingabe" id="im-modus">
        <option value="darstellung"${imp.modus==="darstellung"?" selected":""}>As in the statements (assets +, others reversed)</option>
        <option value="soll"${imp.modus==="soll"?" selected":""}>Debit positive, credit negative</option>
        <option value="betrag"${imp.modus==="betrag"?" selected":""}>All amounts positive</option>
        <option value="haben"${imp.modus==="haben"?" selected":""}>Credit positive, debit negative</option></select></div>
    </div>
    </div>
    <div class="schritt"><h4>Check</h4><table><thead><tr><th>Year</th><th class="num">Assets</th><th class="num">Liabilities and equity</th><th class="num">Result</th><th></th></tr></thead><tbody>
      ${pz(imp.jahr, haupt)}${vj?pz(imp.jahr-1, vj):""}</tbody></table>
      ${hinweise.length?`<div class="fuss info" style="display:block">${hinweise.map(esc).join("<br>")}</div>`:""}
      ${(!okH||!okV)?`<label class="schalter" style="margin-top:10px"><input type="checkbox" id="im-trotzdem"${imp.trotzdem?" checked":""}${eroeffnung?" disabled":""}> Import despite the difference</label>
        <div class="klein mut" style="margin-top:4px">${eroeffnung?"An opening balance must balance. Usually the sign setting is wrong or accounts are missing.":"Usually the sign setting is wrong or accounts are missing."}</div>`:""}</div>
    ${unbekannt.length?`<div class="schritt"><h4>${unbekannt.length} account(s) not in the chart</h4><table><tbody>`+
      unbekannt.map(u=>`<tr><td class="nr">${esc(u.nr)}</td><td>${esc(u.name||"")}</td><td class="num">${fz(u.saldo)}</td>
        <td style="width:280px"><select class="eingabe" data-zu="${esc(u.nr)}"><option value="">do not import</option>
        ${state.gruppen.map(g=>`<option value="${esc(g.c)}"${imp.zuordnung[u.nr]===g.c?" selected":""}>${esc(g.t)}</option>`).join("")}</select></td></tr>`).join("")+
      `</tbody></table><div class="klein mut">Choosing a group adds the account to the chart.</div></div>`:""}`;
  $("#im-sp").onchange = e=>{ imp.saldo = +e.target.value; imp.modus = E.besterModus(a, imp.saldo, ix, importZuordnung()); importAnalyse(); };
  if($("#im-vj")) $("#im-vj").onchange = e=>{ imp.vorjahr = +e.target.value; importDarstellen(); };
  $("#im-jahr").onchange = e=>{ const j = parseInt(e.target.value,10); if(j>1900 && j<2200){ imp.jahr = j; imp.jahrManuell = true; } importDarstellen(); };
  $("#im-modus").onchange = e=>{ imp.modus = e.target.value; importDarstellen(); };
  if($("#im-trotzdem")) $("#im-trotzdem").onchange = e=>{ imp.trotzdem = e.target.checked; importDarstellen(); };
  $$("#im-analyse [data-zu]").forEach(s=> s.onchange = ()=>{ if(s.value) imp.zuordnung[s.dataset.zu] = s.value; else delete imp.zuordnung[s.dataset.zu]; importDarstellen(); });
  const ebOk = !eroeffnung || (eb && eb.gewinnvortrag && Math.abs(eb.differenz) < .005 && eb.zeilen.length);
  $("#im-ok").disabled = !Object.keys(haupt.salden).length || !ebOk || (eroeffnung ? !okH : !((okH && okV) || imp.trotzdem));
  $("#im-ok").textContent = eroeffnung ? "Create opening balance "+state.jahr : (vj ? "Import closings "+imp.jahr+" and "+(imp.jahr-1) : "Import closing "+imp.jahr);
  imp.ergebnis = {haupt:haupt, vj:vj, eb:eb};
}
function importUebernehmen(){
  if(!imp || !imp.ergebnis) return;
  const r = imp.ergebnis, j = imp.jahr, quelle = imp.quelle || "Pasted list", eroeffnung = imp.zweck === "eroeffnung";
  const neueKonten = Object.keys(imp.zuordnung).map(nr=>{ const k = imp.analyse.konten.find(x=>x.nr===nr); return [nr, (k && k.name) || "Account "+nr, imp.zuordnung[nr], null, null]; });
  const ok = aendere(eroeffnung ? "Opening balance "+state.jahr+" created" : "Closing "+j+" imported", ()=>{
    neueKonten.forEach(k=>{ if(!state.konten.some(x=>x[0]===k[0])) state.konten.push(k); });
    const setze = (jahr, salden) => {
      state.vergleichsjahre = (state.vergleichsjahre||[]).filter(v=>v.jahr !== jahr);
      state.vergleichsjahre.push({jahr:jahr, quelle:quelle, importiert:heute(), salden:salden});
    };
    setze(j, r.haupt.salden);
    if(r.vj) setze(j-1, r.vj.salden);
    if(eroeffnung){
      const alt = state.buchungen.find(b=>b.eb);
      const eb = {id: alt ? alt.id : naechsteId(), datum:state.jahr+"-01-01", beleg:"", text:"Opening balance", eb:true, z:r.eb.zeilen};
      if(alt) state.buchungen[state.buchungen.indexOf(alt)] = eb; else state.buchungen.unshift(eb);
    }else state.ui.vergleich = "imp:"+j;
  }, {geruest:true});
  if(ok){
    schliesseDialog("#dlg-import");
    meldung(eroeffnung ? "Opening balance "+state.jahr+" created: equity "+fz(r.eb.eigenkapital)+"." : "Closing "+j+(r.vj?" and "+(j-1):"")+" imported and available as comparison.",
      {aktion:{text:"Undo", fn:rueckgaengig}});
  }
}
let importTimer = null;
$("#im-text").addEventListener("input", ()=>{
  clearTimeout(importTimer);
  importTimer = setTimeout(()=>{
    const t = $("#im-text").value;
    imp.zeilen = t.trim() ? E.leseTabelleText(t) : null; imp.quelle = "Pasted list"; imp.saldo = undefined; imp.vorjahr = undefined; imp.modus = null;
    $("#im-dateiname").textContent = ""; $("#im-blatt-box").hidden = true;
    importAnalyse();
  }, 250);
});
$("#im-datei").onclick = async ()=>{
  const file = await waehleDatei("#importwahl"); if(!file) return;
  $("#im-dateiname").textContent = file.name; imp.quelle = file.name; imp.saldo = undefined; imp.vorjahr = undefined; imp.modus = null;
  try{
    if(/\.xlsx$/i.test(file.name)){
      const bl = await E.leseXlsx(new Uint8Array(await file.arrayBuffer()));
      imp.blaetter = bl;
      let best = 0, bestT = -1;
      bl.forEach((b,i)=>{ const a = E.analysiereSalden(b.zeilen, ix); const t = a.ok ? a.konten.length : 0; if(t > bestT){ bestT = t; best = i; } });
      $("#im-blatt").innerHTML = bl.map((b,i)=>`<option value="${i}"${i===best?" selected":""}>${esc(b.name)}</option>`).join("");
      $("#im-blatt-box").hidden = bl.length < 2;
      imp.zeilen = bl[best].zeilen;
    }else{ imp.zeilen = E.leseTabelleText(await file.text()); $("#im-blatt-box").hidden = true; }
    $("#im-text").value = "";
    importAnalyse();
  }catch(err){ $("#im-analyse").innerHTML = `<div class="fuss schlecht">${esc(err.message)}</div>`; }
};
$("#im-blatt").onchange = e=>{ imp.zeilen = imp.blaetter[+e.target.value].zeilen; imp.saldo = undefined; imp.vorjahr = undefined; imp.modus = null; importAnalyse(); };
$("#im-ok").onclick = importUebernehmen;

