/* =====================================================================
   EXPORTS
   ===================================================================== */
const XLSX_TYP = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function oeffneDialog(id){ $(id).classList.add("on"); }
function schliesseDialog(id){ $(id).classList.remove("on"); }
function oeffneExport(){
  const K = fsKern(); const w = fsWahl(K);
  $("#ex-fs-info").textContent = "Key figures, balance sheet, income statement, cash flow and investments: "+K.periodLabel(w.p)+" compared with "+K.periodLabel(w.c)+
    ". Change the report on the statement pages.";
  oeffneDialog("#dlg-export");
}
const dateiName = s => String(s||"").replace(/[^\wÄÖÜäöüéèàç &.-]+/g,"").trim().toUpperCase();

/* ---------- Twelve months -------------------------------------------- */
function monateExcel(){
  const mb = E.monatsbericht(state, ix);
  const kopf = t => [[{v:state.mandant, s:5}], [{v:t+" "+state.jahr, s:1}], [{v:"Amounts in "+state.waehrung, s:6}], []];
  const tabelle = (titel, zeilen, mitTotal) => {
    const z = kopf(titel);
    z.push([{v:"Account", s:10}, {v:"Description", s:10}].concat(mb.monate.map(m=>({v:m.kurz, s:10}))).concat(mitTotal?[{v:"Year", s:10}]:[]));
    zeilen.forEach(x=>{
      if(x.typ === "seite" || x.typ === "bereich"){ z.push(["", {v:x.text, s:1}]); return; }
      const fett = x.typ !== "konto", linie = x.typ === "summe" || x.typ === "total";
      const st = linie ? 7 : (fett ? 3 : 2);
      z.push([x.nr ? {v:parseFloat(x.nr), s:0} : "", {v:(x.einzug?"   ":"")+x.text, s: linie ? 8 : (fett ? 1 : 0)}]
        .concat(x.werte.map(v=>({v:v, s:st}))).concat(mitTotal?[{v:x.total, s:st}]:[]));
    });
    return {name:titel, zeilen:z, breiten:[9,46].concat(mb.monate.map(()=>12)).concat(mitTotal?[14]:[]), frieren:5};
  };
  const bl = [tabelle("Income statement by month", mb.erfolg, true), tabelle("Balance sheet by month", mb.bilanz, false)];
  ablegen(new Blob([xlsxDatei(bl)], {type:XLSX_TYP}), heute()+"_TWELVE MONTHS "+state.jahr+" "+dateiName(state.mandant)+".xlsx");
  schliesseDialog("#dlg-export");
  meldung("Twelve-month report created as Excel.");
}
function druckStil(quer){
  return `<style>
    @page{size:A4 ${quer?"landscape":"portrait"};margin:${quer?"12mm 10mm 14mm 10mm":"18mm 17mm 20mm 17mm"};
      @bottom-left{content:"${esc(state.mandant).replace(/"/g,"")}";font:8pt -apple-system,"Segoe UI",sans-serif;color:#6b7684}
      @bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt -apple-system,"Segoe UI",sans-serif;color:#6b7684}}
    #bericht{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#101C2B;font-size:${quer?"7.4pt":"9.5pt"};line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    #bericht section{page-break-before:always} #bericht section:first-child{page-break-before:auto}
    #bericht h2{font-size:${quer?"12pt":"15pt"};font-weight:600;margin:0 0 1mm}
    #bericht .rb-sub{color:#48566A;font-size:8.5pt;margin-bottom:4mm}
    #bericht table{width:100%;border-collapse:collapse}
    #bericht th{font-weight:600;color:#8592A6;text-align:right;border-bottom:.6pt solid #101C2B;padding:1.2mm 1.4mm}
    #bericht th:first-child,#bericht th.l{text-align:left}
    #bericht td{padding:${quer?".7mm 1.2mm":"1.1mm 1.8mm"};vertical-align:top}
    #bericht td.z{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    #bericht td.v{color:#48566A} #bericht td.d{color:#8592A6} #bericht td.nr{color:#48566A;width:12mm}
    #bericht .neg{color:#A6262D}
    #bericht tr.teil td{font-size:${quer?"9pt":"11pt"};font-weight:600;padding-top:3mm}
    #bericht tr.bereich td{font-weight:600;color:#2F5E91;padding-top:2.4mm}
    #bericht tr.konto td,#bericht tr.position td{border-bottom:.3pt solid #E3E8EF}
    #bericht tr.konto td.t.e{padding-left:4mm}
    #bericht tr.gruppe td{font-weight:600;border-top:.4pt solid #B8C4D4}
    #bericht tr.summe td{font-weight:600;border-top:.6pt solid #101C2B;background:#F3F6FB}
    #bericht tr.total td{font-weight:700;border-top:.6pt solid #101C2B;border-bottom:1.8pt double #101C2B}
    #bericht tr{page-break-inside:avoid}
    #bericht .rb-hinweis{margin-top:4mm;font-size:8.5pt;color:#6E4C06;background:#FBF3E1;padding:2mm 3mm;border-radius:2mm}
    #bericht .rb-wz{position:fixed;left:0;right:0;top:42%;text-align:center;font-size:96pt;font-weight:700;color:rgba(166,38,45,.07);transform:rotate(-24deg);letter-spacing:.06em}
  </style>`;
}
function drucke(html, titel){
  $("#bericht").innerHTML = html;
  const alt = document.title; document.title = titel;
  schliesseDialog("#dlg-export");
  window.addEventListener("afterprint", ()=>{ document.title = alt; }, {once:true});
  setTimeout(()=>{ try{ window.print(); }catch(e){ meldung("Printing is not possible in this browser.", {fehler:true}); } }, 60);
}
function monatePdf(){
  const mb = E.monatsbericht(state, ix);
  const z = n => `<td class="z ${n<0?"neg":""}">${Math.abs(n)<.005?"–":fz(n)}</td>`;
  const tab = (zeilen, mitTotal) => `<table><thead><tr><th class="l" colspan="2"></th>${mb.monate.map(m=>`<th>${m.kurz}</th>`).join("")}${mitTotal?"<th>Year</th>":""}</tr></thead><tbody>`+
    zeilen.map(x=> (x.typ === "seite" || x.typ === "bereich")
      ? `<tr class="${x.typ==="seite"?"teil":"bereich"}"><td colspan="${mb.monate.length+(mitTotal?3:2)}">${esc(x.text)}</td></tr>`
      : `<tr class="${x.typ}"><td class="nr">${esc(x.nr||"")}</td><td class="t${x.einzug?" e":""}">${esc(x.text)}</td>${x.werte.map(z).join("")}${mitTotal?z(x.total):""}</tr>`).join("")+`</tbody></table>`;
  const status = $("#ex-status").value;
  const html = druckStil(true) + (status === "entwurf" ? `<div class="rb-wz">Draft</div>` : "") +
    `<section><h2>Income statement by month ${state.jahr}</h2><div class="rb-sub">${esc(state.mandant)}, amounts in ${esc(state.waehrung)}</div>${tab(mb.erfolg, true)}</section>`+
    `<section><h2>Balance sheet at each month end ${state.jahr}</h2><div class="rb-sub">${esc(state.mandant)}, amounts in ${esc(state.waehrung)}</div>${tab(mb.bilanz, false)}</section>`;
  drucke(html, heute()+"_TWELVE MONTHS "+state.jahr+" "+dateiName(state.mandant));
}

