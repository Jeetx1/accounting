/* =====================================================================
   STATEMENTS on the engine of the Financial Statements file
   ===================================================================== */
function fsKern(){
  const st = state.ui.fs || {};
  return fsDaten(state, ix, E, {jahr:state.jahr, p:st.p, c:st.c});
}
function fsWahl(K){
  const per = K.periods();
  let w = state.ui.fs;
  if(!w || w.jahr !== state.jahr || per.indexOf(w.p) < 0 || per.indexOf(w.c) < 0){
    const d = fsStandard(state, state.jahr, heute());
    w = state.ui.fs = {jahr:state.jahr, p: per.indexOf(d.p) >= 0 ? d.p : per[per.length-1], c: per.indexOf(d.c) >= 0 ? d.c : per[0]};
  }
  K.S.activePeriod = w.p; K.S.comparePeriod = w.c;
  return w;
}
function fsPicker(K, w){
  const per = K.periods(), jahre = {};
  per.forEach(p=> (jahre[p.slice(0,4)] = jahre[p.slice(0,4)] || []).push(p));
  const opt = sel => Object.keys(jahre).sort().reverse().map(j=>`<optgroup label="${j}">`+
    jahre[j].slice().reverse().map(p=>`<option value="${p}"${p===sel?" selected":""}>${esc(K.periodLabel(p))}</option>`).join("")+`</optgroup>`).join("");
  $$(".fs-p").forEach(s=> s.innerHTML = opt(w.p));
  $$(".fs-c").forEach(s=> s.innerHTML = opt(w.c));
  $$(".fs-var").forEach(c=> c.checked = (state.auswertung||{}).showVariance !== false);
  $$(".fs-tabelle").forEach(t=> t.classList.toggle("ohnevar", (state.auswertung||{}).showVariance === false));
}
/* ---------- The statement sheet ----------------------------------------
   Groups, values and drilldowns come from the engine (K.BS, K.IS,
   K.buildCF); only the presentation is the app's own: parts, blue section
   headings, indented accounts, totals with a rule, the grand total double
   underlined. Row model: teil, bereich, grp (with kids), sub, zw, res, tot, luft. */
function abBereichTitel(l){ const t = String(l).replace(/^total\s+/i, ""); return t.charAt(0).toUpperCase()+t.slice(1); }
function abSpalten(K, p, c){
  return [{l:K.periodLabel(p), d:fd(K.rep(p).asOf)}, {l:K.periodLabel(c), d:fd(K.rep(c).asOf)}];
}
// balance sheet and income statement: the engine's structure, a heading over every block of groups that has its own total
function abZeilen(K, struct, p, c, nullen){
  const z = [], G = K.GROUPS, bereichVon = {}, gezeigt = {};
  // no heading when it would only repeat a group's own name (Income over Income)
  struct.forEach(n=>{ if(n.k === "s" && n.of.length > 1 && n.of.every(id=> G[id] && G[id].k === "g") &&
    !n.of.some(id=> G[id].l.toLowerCase() === abBereichTitel(n.l).toLowerCase())) n.of.forEach(id=> bereichVon[id] = n); });
  struct.forEach(n=>{
    if(n.k === "sp"){ z.push({k:"luft"}); return; }
    if(n.k === "sec"){ z.push({k:"teil", l:n.l}); return; }
    const a = K.nodeVal(n, p), b = K.nodeVal(n, c);
    if(n.k === "g"){
      const kids = n.r ? K.accountsIn(n.id).filter(k=> nullen || !K.nil(K.accVal(p, k)) || !K.nil(K.accVal(c, k))) : [];
      if(!nullen && K.nil(a) && K.nil(b) && !kids.length) return;
      const s = bereichVon[n.id];
      if(s && !gezeigt[s.id]){ gezeigt[s.id] = true; z.push({k:"bereich", l:abBereichTitel(s.l)}); }
      z.push({k:"grp", id:n.id, l:n.l, w:[a, b], kids:kids.map(k=>({nr:k, l:K.nameOf(k), w:[K.accVal(p, k), K.accVal(c, k)]}))});
      return;
    }
    const ueber = n.k === "s" && n.of.some(id=> G[id] && G[id].k !== "g");
    z.push({k: n.k === "t" ? "tot" : n.k === "r" ? "res" : ueber ? "sub ueber" : "sub", l:n.l, w:[a, b], ergebnis: n.k === "r" || (n.k === "t" && !!n.sign)});
  });
  // a spacer straight after a total is enough on its own; drop the ones that would stack up before a part
  return z.filter((r, i)=> !(r.k === "luft" && (i === 0 || (z[i+1] && z[i+1].k === "teil"))));
}
// cash flow, direct method: what went in and out of cash, by statement group, accounts as drilldown
function gfZeilen(K, cf){
  const z = [];
  let n = 0;
  const gruppen = linien => linien.forEach(l=> z.push({k:"grp", id:"cf"+(++n), l:l.l, w:[l.v],
    kids:l.konten.map(o=>({nr:o.a, l:K.nameOf(o.a), w:[o.v]}))}));
  const teil = (titel, linien, summe, sl) => {
    z.push({k:"teil", l:titel});
    if(linien.length) gruppen(linien); else z.push({k:"grp", id:"", l:"No cash movements", w:[0], kids:[]});
    z.push({k:"res", l:sl, w:[summe], ergebnis:true});
  };
  teil("Operating activities", cf.bereiche.op, cf.operating, "Cash flow from operating activities");
  teil("Investing activities", cf.bereiche.inv, cf.investing, "Cash flow from investing activities");
  teil("Financing activities", cf.bereiche.fin, cf.financing, "Cash flow from financing activities");
  z.push({k:"luft"});
  if(!K.nil(cf.fx)){
    z.push({k:"zw", l:"Net cash flow", w:[cf.net]});
    const fx = cf.bereiche.fx.reduce((a, l)=> a.concat(l.konten), []);
    z.push({k:"grp", id:"cf"+(++n), l:"Effect of exchange rate changes on cash", w:[cf.fx], kids:fx.map(o=>({nr:o.a, l:K.nameOf(o.a), w:[o.v]}))});
  }
  z.push({k:"tot", l:"Net change in cash"+(cf.mitSchulden ? " less credit card debt" : " and cash equivalents"), w:[cf.change], ergebnis:true});
  z.push({k:"bereich", l:"Reconciliation"});
  const fonds = cf.mitSchulden ? "Cash less credit card debt" : "Cash and cash equivalents";
  z.push({k:"grp", id:"", l:fonds+" at "+fd(cf.vonDatum), w:[cf.cashOpen], kids:[]});
  z.push({k:"grp", id:"", l:fonds+" at "+fd(cf.bisDatum), w:[cf.cashClose], kids:[]});
  return z;
}
// the same rows for the financial statements report
function gfBerichtZeilen(K, cf, detail){
  const aus = [], zahl = (v, erg) => ({t: erg ? K.fmt(v, true) : K.fmt(v), neg: !!erg && v < -0.005});
  gfZeilen(K, cf).forEach(r=>{
    if(r.k === "luft") return;
    if(r.k === "teil" || r.k === "bereich"){ aus.push({typ:"bereich", text:r.l}); return; }
    if(r.k === "grp"){
      const auf = detail && r.kids.length;
      aus.push({typ: auf ? "gruppe" : "position", text:r.l, w:zahl(r.w[0])});
      if(auf) r.kids.forEach(k=> aus.push({typ:"konto", nr:k.nr, text:k.l, w:zahl(k.w[0])}));
      return;
    }
    aus.push({typ: r.k === "tot" ? "total" : "summe", text:r.l, w:zahl(r.w[0], r.ergebnis)});
  });
  return aus;
}
// the note under the cash flow: what moved without cash
function gfNotiz(K, cf){
  if(!cf.nichtGeld.length) return "";
  return `<div class="nc-notiz"><h3>Non-cash transactions</h3><p class="hinweis">Not in the cash flow above: no cash changed hands. Listed from ${K.CUR()} 500.</p>`+
    `<table class="abschluss"><tbody>`+cf.nichtGeld.map(o=>`<tr class="grp flach${o.klein ? " klein" : ""}"><td class="lbl">${esc(o.l)}`+
      (o.konten.length ? `<span class="nc-konten">${o.konten.map(esc).join(" · ")}</span>` : "")+`</td><td class="num">${K.fmt(o.betrag)}</td></tr>`).join("")+
    `</tbody></table></div>`;
}
function abHTML(K, spalten, zeilen, mitVar){
  const breite = 1 + spalten.length + (mitVar ? 2 : 0), out = [];
  const zahl = (v, erg) => `<td class="num${erg && v < -0.005 ? " neg" : ""}${!erg && K.nil(v) ? " leer" : ""}">${erg ? K.fmt(v, true) : K.fmt(v)}</td>`;
  const zahlen = (w, erg) => w.map(v=> zahl(v, erg)).join("") + (mitVar ? abDiff(K, w[0], w[1]) : "");
  zeilen.forEach(r=>{
    if(r.k === "luft"){ out.push(`<tr class="luft"><td colspan="${breite}"></td></tr>`); return; }
    if(r.k === "teil" || r.k === "bereich"){ out.push(`<tr class="${r.k}"><td colspan="${breite}">${esc(r.l)}</td></tr>`); return; }
    if(r.k === "grp"){
      const kids = r.kids.length > 0;
      out.push(`<tr class="grp${kids ? "" : " flach"}"${kids ? ` data-g="${r.id}"` : ""}><td class="lbl"><span class="chev" aria-hidden="true"></span>${esc(r.l)}`+
        (kids ? `<span class="anz">${r.kids.length}</span>` : "")+`</td>${zahlen(r.w)}</tr>`);
      r.kids.forEach((k, i)=> out.push(`<tr class="leaf hide g-${r.id}${i === r.kids.length-1 ? " letzte" : ""}" data-konto="${esc(k.nr)}" style="animation-delay:${Math.min(i*16, 240)}ms">`+
        `<td class="lbl"><span class="kto">${esc(k.nr)}</span><span class="kn">${esc(k.l)}</span></td>${zahlen(k.w)}</tr>`));
      return;
    }
    out.push(`<tr class="${r.k}"><td class="lbl">${esc(r.l)}</td>${zahlen(r.w, r.ergebnis)}</tr>`);
  });
  const kopf = `<thead><tr><th class="lbl">Position</th>`+spalten.map(s=>`<th class="num per"><span class="pl">${esc(s.l)}</span><span class="pd">${esc(s.d)}</span></th>`).join("")+
    (mitVar ? `<th class="num chg">Change</th><th class="num chg pct">%</th>` : "")+`</tr></thead>`;
  return kopf + `<tbody>${out.join("")}</tbody>`;
}
function abDiff(K, a, b){
  const d = K.r2(a - b);
  if(K.nil(d)) return `<td class="num chg leer">–</td><td class="num chg pct"></td>`;
  return `<td class="num chg">${d > 0 ? "+" : "\u2212"}${K.fmt(Math.abs(d))}</td><td class="num chg pct">${K.fmtPct(a, b)}</td>`;
}
function fsFuss(ok, gut, schlecht){ return `<div class="fuss ${ok?"ok":"schlecht"}">${ok?"✓":"!"} ${esc(ok?gut:schlecht)}</div>`; }
// a click on an account opens its bookings for the year of the report
function fsKontoKlick(tbl, K){
  $$("tr.leaf[data-konto]", tbl).forEach(tr=>{
    const a = tr.dataset.konto;
    if(!a || !ix.km[a]) return;
    tr.classList.add("klickbar"); tr.title = "Open the bookings of "+a;
    tr.addEventListener("click", ev=>{
      ev.stopPropagation();
      const j = parseInt(K.S.activePeriod.slice(0,4),10);
      if(!E.jahreMitBuchungen(state)[j]){ meldung("No bookings in this file for "+j+"."); return; }
      if(state.jahr !== j){ state.jahr = j; bauGeruest(); }
      state.ui.periode = "J"; state.ui.ytd = false;
      zeigeKonto(a);
    });
  });
}
function fsKlappen(){
  $$("[data-expand],[data-collapse]").forEach(b=> b.onclick = ()=>{
    const tbl = document.getElementById(b.dataset.expand || b.dataset.collapse), auf = !!b.dataset.expand;
    $$("tr.grp[data-g]", tbl).forEach(tr=>{ tr.classList.toggle("open", auf);
      $$("tr.g-"+tr.getAttribute("data-g"), tbl).forEach(r=>{ r.classList.toggle("hide", !auf); r.classList.toggle("show", auf); }); });
  });
}
function renderBilanz(){
  const K = fsKern(), w = fsWahl(K), p = w.p, c = w.c, G = K.GROUPS;
  fsPicker(K, w);
  setzeUntertitel("As at "+fd(K.rep(p).asOf)+", compared with "+K.periodLabel(c)+", "+K.CUR());
  const t = $("#bi-tab");
  t.innerHTML = abHTML(K, abSpalten(K, p, c), abZeilen(K, K.BS, p, c, $("#bi-null").checked), true);
  K.wireDrill(t); fsKontoKlick(t, K);
  const diff = K.r2(K.nodeVal(G.TA, p) - K.nodeVal(G.TLE, p));
  $("#bi-check").innerHTML = fsFuss(K.nil(diff), "Assets equal liabilities and equity.", "Assets and liabilities differ by "+K.fmt(diff)+".");
}
function renderErfolg(){
  const K = fsKern(), w = fsWahl(K), p = w.p, c = w.c, G = K.GROUPS;
  fsPicker(K, w);
  const R = K.rep(p), m = K.monthsOf(p), mc = K.monthsOf(c);
  setzeUntertitel((R.basis === "YTD" ? "Year to date, "+m+" month"+(m===1?"":"s")+" to " : "Full year to ")+fd(R.asOf)+", compared with "+K.periodLabel(c)+", "+K.CUR());
  const t = $("#er-tab");
  t.innerHTML = abHTML(K, abSpalten(K, p, c), abZeilen(K, K.IS, p, c, $("#er-null").checked), true);
  K.wireDrill(t); fsKontoKlick(t, K);
  const diff = K.r2(K.nodeVal(G.NP, p) - K.profitOf(p));
  $("#er-check").innerHTML = fsFuss(K.nil(diff), "The result ties to the balance sheet.", "The result differs from the balance sheet by "+K.fmt(diff)+".")+
    (m === mc ? "" : `<div class="fuss info">${m} months compared with ${mc}: not like for like.</div>`);
}
function renderGeldfluss(){
  const K = fsKern(), w = fsWahl(K), p = w.p, c = w.c;
  fsPicker(K, w);
  if(p === c){
    $("#gf-tab").innerHTML = `<tbody><tr><td class="mut" style="padding:18px">Pick two different reports to see the movement.</td></tr></tbody>`;
    $("#gf-check").innerHTML = ""; $("#gf-note").innerHTML = ""; setzeUntertitel(""); return;
  }
  const cf = cfDirektZwischen(K, state, p, c);
  const [fruehP, spaetP] = cf.rueckwaerts ? [p, c] : [c, p];
  cf.vonDatum = K.rep(fruehP).asOf; cf.bisDatum = K.rep(spaetP).asOf;
  setzeUntertitel("Cash in and out from "+fd(cf.von)+" to "+fd(cf.bis)+", from "+cf.buchungen+" bookings, "+K.CUR());
  const t = $("#gf-tab");
  t.innerHTML = abHTML(K, [{l:K.periodLabel(fruehP)+" → "+K.periodLabel(spaetP), d:fd(cf.von)+" – "+fd(cf.bis)}], gfZeilen(K, cf), false);
  K.wireDrill(t); fsKontoKlick(t, K);
  $("#gf-check").innerHTML = fsFuss(K.nil(cf.check), "The cash flow matches the change in cash on the balance sheet.", "The cash flow differs from the change in cash by "+K.fmt(cf.check)+".");
  const notes = [];
  if(cf.rueckwaerts) notes.push("The comparison lies after the report, so the cash flow runs from "+K.periodLabel(fruehP)+" to "+K.periodLabel(spaetP)+".");
  if(cf.ohneBuchungen.length) notes.push("No bookings in "+cf.ohneBuchungen.join(", ")+": the cash flow only covers what was booked.");
  if(cf.offen.length) notes.push(cf.offen.length+" booking"+(cf.offen.length===1?"":"s")+" on cash without a counter-account: "+cf.offen.slice(0, 3).map(o=> fd(o.datum)+" "+o.text).join("; ")+".");
  $("#gf-note").innerHTML = notes.map(n=>`<div class="fuss info">${esc(n)}</div>`).join("") + gfNotiz(K, cf) + gfIndirekt(K, cf, spaetP, fruehP);
}
// the bridge from the result to the operating cash flow, as the indirect method (FER 4, IAS 7) shows it;
// computed from the balance sheet movements and tied to the direct figure above
function gfIndirekt(K, cf, p, c){
  let i;
  const gross = K.S.cfGross;
  try{ K.S.cfGross = false; i = K.buildCF(p, c); } catch(e){ return ""; } finally { K.S.cfGross = gross; }
  if(!i) return "";
  const r2 = K.r2, diff = r2(cf.operating - i.operating);
  const zeile = (l, v, kl) => `<tr class="${kl||"grp flach"}"><td class="lbl">${esc(l)}</td><td class="num${v < -0.005 && kl ? " neg" : ""}">${kl ? K.fmt(v, true) : K.fmt(v)}</td></tr>`;
  const rows = [
    zeile("Result for the period", i.earnings),
    zeile("Depreciation and amortisation", i.depreciation),
    zeile("Unrealised value changes on investments", i.unrealised),
    zeile("Income from restricted assets, not received in cash", i.restricted),
    zeile("Result adjusted for non-cash items", r2(i.earnings + i.NC), "sub"),
    zeile("Change in receivables, prepayments and other current assets", r2(-i.dOpAsset)),
    zeile("Change in short-term liabilities and accruals", i.dOpLiab),
    zeile("Cash flow from operating activities, indirect method", i.operating, "res"),
    zeile("Cash flow from operating activities, direct method (above)", cf.operating, "res")
  ];
  if(!K.nil(diff)) rows.push(zeile("Difference: non-cash movements between the sections (see the note)", diff, "sub"));
  const fuss = K.nil(diff)
    ? `<div class="fuss ok">✓ The indirect method gives the same operating cash flow.</div>`
    : `<div class="fuss info">The two methods differ by ${K.fmt(diff)}: the indirect method follows balance sheet movements, so a non-cash reclassification between operating and investing or financing (an inheritance share moved to a liability, a trade-in set against a lease) shifts the figure between the sections. Both reconcile to the same change in cash.</div>`;
  return `<details class="nc-notiz" style="margin-top:14px"><summary style="cursor:pointer"><h3 style="display:inline">Reconciliation to the indirect method</h3> <span class="klein mut">as Swiss GAAP FER 4 presents operating activities</span></summary>
    <table class="abschluss" style="margin-top:10px"><tbody>${rows.join("")}</tbody></table>${fuss}</details>`;
}
// shared controls of the three statements
function fsVerdrahten(){
  $$(".fs-p").forEach(s=> s.onchange = ()=>{ state.ui.fs.p = s.value; render(); });
  $$(".fs-c").forEach(s=> s.onchange = ()=>{ state.ui.fs.c = s.value; render(); });
  $$(".fs-var").forEach(c=> c.onchange = ()=> aendere("Variance columns "+(c.checked?"shown":"hidden"), ()=>{ state.auswertung = state.auswertung || {}; state.auswertung.showVariance = c.checked; }));
  ["#bi-null","#er-null"].forEach(s=> $(s).onchange = render);
  fsKlappen();
}
fsVerdrahten();

