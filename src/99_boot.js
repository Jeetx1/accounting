/* =====================================================================
   WIRING AND START
   ===================================================================== */
const AKTIONEN = {
  oeffnen:oeffnen, neu:neu, speichern:()=>speichern(false,false), speichernAls:()=>speichern(true,false), kopie:()=>speichern(true,true),
  export:oeffneExport, import:()=>oeffneImport(), csv:journalCsv, undo:rueckgaengig, redo:wiederholen, schliessen:schliessen, backup:backupWaehlen
};
$$("#dmenu [data-aktion]").forEach(b=> b.onclick = ()=>{ $("#dmenu").open = false; AKTIONEN[b.dataset.aktion](); });
document.addEventListener("click", e=>{
  const m = $("#dmenu"); if(m && m.open && !m.contains(e.target)) m.open = false;
  const s = $("#navleiste"); if(s && s.classList.contains("offen") && !s.contains(e.target) && !$("#menuknopf").contains(e.target)) s.classList.remove("offen");
});
$("#s-oeffnen").onclick = oeffnen; $("#s-neu").onclick = neu;
$("#speichern").onclick = ()=> speichern(false,false);
$("#menuknopf").onclick = ()=> $("#navleiste").classList.toggle("offen");
$("#mandant").addEventListener("change", e=>{ const v = e.target.value.trim() || "Untitled"; aendere("Name changed", ()=>{ state.mandant = v; }); });
$("#periode").onchange = e=>{ state.ui.periode = e.target.value; render(); };
$("#jahrwahl").onchange = e=>{
  const j = parseInt(e.target.value, 10); if(!(j >= 1900 && j <= 2200)) return;
  state.jahr = j; neuerEntwurf(true); bauGeruest(); render();
  const fort = istGeschlossen(j) ? null : E.spreadsFortfuehren(state, ix, j);
  meldung((E.jahreMitBuchungen(state)[j] ? "Year "+j+(istGeschlossen(j)?" (closed, read-only)":"") : "Year "+j+" is new. Its opening comes from the closing "+(j-1)+".")
    + (fort && fort.plaene.length ? " "+fort.plaene.length+" spread"+(fort.plaene.length>1?"s":"")+" from earlier years can be continued on the Book page." : ""));
};
$("#vergleich").onchange = async e=>{
  const v = e.target.value;
  if(v === "datei" && !vgl){ const ok = await vergleichsdateiLaden(); state.ui.vergleich = ok ? "datei" : ""; bauVergleichsliste(); render(); return; }
  state.ui.vergleich = v; render();
};
$("#bPer").onclick = ()=>{ state.ui.ytd = false; $("#bPer").classList.add("on"); $("#bYtd").classList.remove("on"); render(); };
$("#bYtd").onclick = ()=>{ state.ui.ytd = true; $("#bYtd").classList.add("on"); $("#bPer").classList.remove("on"); render(); };
let sucheTimer = null;
$("#jo-suche").addEventListener("input", e=>{ clearTimeout(sucheTimer); sucheTimer = setTimeout(()=>{ suche = e.target.value.trim(); renderJournal(); }, 140); });
$("#jo-auf").onclick = ()=> $$("#jo-liste details").forEach(d=>d.open=true);
$("#jo-zu").onclick = ()=> $$("#jo-liste details").forEach(d=>d.open=false);
$("#jo-xlsx").onclick = ()=> journalExcel(null);
$("#jo-pdf").onclick = ()=> journalPdf(null);
$("#kt-nr").addEventListener("input", e=>{ const g = gruppeFuerNummer(e.target.value.trim()); if(g) $("#kt-grp").value = g; });
$("#kt-add").onclick = ()=>{
  const nr = $("#kt-nr").value.trim(), name = $("#kt-name").value.trim(), grp = $("#kt-grp").value;
  if(!/^\d{3,6}(\.\d{1,3})?$/.test(nr)){ meldung("An account number has 3 to 6 digits, optionally with a sub-number like 1020.3.", {fehler:true}); return; }
  if(!name){ meldung("Enter a name.", {fehler:true}); return; }
  if(ix.km[nr]){ meldung("Account "+nr+" already exists.", {fehler:true}); return; }
  if(aendere("Account "+nr+" added", ()=>{ state.konten.push([nr, name, grp, null, null]); }, {geruest:true})){
    $("#kt-nr").value = ""; $("#kt-name").value = ""; meldung("Account "+nr+" added"); }
};
$("#gr-add").onclick = ()=>{
  const name = $("#gr-name").value.trim(); if(!name){ meldung("Enter a name.", {fehler:true}); return; }
  const t = $("#gr-sek").value.split("|"), code = "G"+Date.now().toString(36).toUpperCase();
  if(aendere("Group added", ()=>{ state.gruppen.push(t[0]==="E" ? {c:code, t:name, s:"E", vz:parseInt(t[1],10), zw:""}
      : {c:code, t:name, s:t[0], sek:t[1], st:"auto"}); }, {geruest:true})) $("#gr-name").value = "";
};
$("#vg-import").onclick = ()=> oeffneImport();
$("#mo-export").onclick = oeffneExport;
$("#ja-delta").onchange = renderJahre;
$("#ex-mo-xlsx").onclick = monateExcel; $("#ex-mo-pdf").onclick = monatePdf;
$("#ex-fs-pdf").onclick = ()=> fsBericht(false); $("#ex-fs-sum").onclick = ()=> fsBericht(true); $("#ex-fs-xlsx").onclick = fsExcelExport;
$$("[data-schliessen]").forEach(b=> b.onclick = ()=> b.closest(".hg").classList.remove("on"));
$$(".hg").forEach(h=> h.addEventListener("click", e=>{ if(e.target === h){ if(h.id === "dlg-frage" && frageOffen) frageOffen(); else h.classList.remove("on"); } }));
document.addEventListener("keydown", e=>{
  const mod = e.ctrlKey || e.metaKey, ziel = e.target, inFeld = ziel && /INPUT|TEXTAREA|SELECT/.test(ziel.tagName);
  if(e.key === "Escape"){
    if($("#dlg-frage").classList.contains("on") && frageOffen){ frageOffen(); return; }
    const offen = $$(".hg.on").pop(); if(offen){ offen.classList.remove("on"); return; }
    if($("#dmenu").open) $("#dmenu").open = false;
  }
  if(!geladen) return;
  if(mod && e.key.toLowerCase() === "s"){ e.preventDefault(); speichern(e.shiftKey, false); }
  else if(mod && !inFeld && e.key.toLowerCase() === "z" && !e.shiftKey){ e.preventDefault(); rueckgaengig(); }
  else if(mod && !inFeld && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))){ e.preventDefault(); wiederholen(); }
  else if(mod && e.key === "Enter" && state.ui.tab === "buchen"){ e.preventDefault(); versucheBuchen(); }
});

setzeIcons();
baueMarkeUndSiegel();
zeichneHintergrund();
$("#start-hinweis").textContent = FSA
  ? "Saving writes straight back into the opened file. Ctrl+S saves, Ctrl+Z undoes."
  : "This browser cannot write back into the opened file. Saving creates a new file each time (on iPhone in Files). To save into the same file, use Chrome or Edge on a computer.";
window.__buha = {get state(){ return state; }, E:E, anlageDialog:anlageDialog};
})();
</script>
</body>
</html>
