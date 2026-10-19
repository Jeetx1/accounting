/* =====================================================================
   EXCEL (no library)
   ===================================================================== */
const CRC = (function(){ const t = new Int32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c; } return t; })();
function crc32(u8){ let c = -1; for(let i=0;i<u8.length;i++) c = CRC[(c^u8[i])&0xFF]^(c>>>8); return (c^-1)>>>0; }
function zipStore(dateien){
  const enc = new TextEncoder(), teile = [], zentral = []; let off = 0;
  dateien.forEach(d=>{
    const name = enc.encode(d.name), inh = typeof d.inhalt === "string" ? enc.encode(d.inhalt) : d.inhalt, summe = crc32(inh);
    const l = new Uint8Array(30+name.length), v = new DataView(l.buffer);
    v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x0800,true);
    v.setUint32(14,summe,true); v.setUint32(18,inh.length,true); v.setUint32(22,inh.length,true); v.setUint16(26,name.length,true);
    l.set(name,30); teile.push(l, inh);
    const z = new Uint8Array(46+name.length), w = new DataView(z.buffer);
    w.setUint32(0,0x02014b50,true); w.setUint16(4,20,true); w.setUint16(6,20,true); w.setUint16(8,0x0800,true);
    w.setUint32(16,summe,true); w.setUint32(20,inh.length,true); w.setUint32(24,inh.length,true); w.setUint16(28,name.length,true); w.setUint32(42,off,true);
    z.set(name,46); zentral.push(z); off += l.length + inh.length;
  });
  const zl = zentral.reduce((a,z)=>a+z.length,0), e = new Uint8Array(22), ev = new DataView(e.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,dateien.length,true); ev.setUint16(10,dateien.length,true); ev.setUint32(12,zl,true); ev.setUint32(16,off,true);
  const alles = teile.concat(zentral,[e]), out = new Uint8Array(alles.reduce((a,x)=>a+x.length,0)); let i = 0;
  alles.forEach(x=>{ out.set(x,i); i += x.length; }); return out;
}
const xe = s => String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");
const sp = i => { let s="", n=i+1; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-1-r)/26; } return s; };
// Stile: 0 Text, 1 fett, 2 Zahl, 3 Zahl fett, 4 Prozent, 5 Titel, 6 grau, 7 Zahl fett mit Linie, 8 Text fett mit Linie, 9 Prozent fett, 10 Kopfzeile
function blattXml(b){
  const rows = b.zeilen.map((zeile,r)=>`<row r="${r+1}">`+zeile.map((z,c)=>{
    if(z === null || z === undefined || z === "") return "";
    const v = (typeof z === "object") ? z.v : z, s = (typeof z === "object" && z.s !== undefined) ? z.s : (typeof v === "number" ? 2 : 0);
    if(v === null || v === undefined || v === "") return s ? `<c r="${sp(c)}${r+1}" s="${s}"/>` : "";
    return typeof v === "number" && isFinite(v) ? `<c r="${sp(c)}${r+1}" s="${s}"><v>${v}</v></c>`
      : `<c r="${sp(c)}${r+1}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
  }).join("")+`</row>`).join("");
  const cols = (b.breiten||[]).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
  const pane = b.frieren ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${b.frieren}" topLeftCell="A${b.frieren+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "";
  const filter = b.filter ? `<autoFilter ref="A1:${sp(Math.max(0,b.zeilen[0].length-1))}${b.zeilen.length}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols?`<cols>${cols}</cols>`:""}<sheetData>${rows}</sheetData>${filter}<pageMargins left="0.6" right="0.6" top="0.7" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/></worksheet>`;
}
function xlsxDatei(blaetter){
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`+
    blaetter.map((b,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")+`</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const namen = []; const blattName = n => { let x = String(n).replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31) || "Sheet"; let y = x, i = 2; while(namen.indexOf(y)>=0) y = x.slice(0,28)+" "+(i++); namen.push(y); return y; };
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`+
    blaetter.map((b,i)=>`<sheet name="${xe(blattName(b.name))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")+`</sheets>`+
    (blaetter.some(b=>b.filter) ? `<definedNames>`+blaetter.map((b,i)=> b.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xe(namen[i].replace(/'/g,"''"))}'!$A$1:$${sp(Math.max(0,b.zeilen[0].length-1))}$${b.zeilen.length}</definedName>` : "").join("")+`</definedNames>` : "")+
    `</workbook>`;
  const wbr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
    blaetter.map((b,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")+
    `<Relationship Id="rId${blaetter.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const st = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00;\\-#,##0.00"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF6B7772"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border/><border><top style="thin"/></border><border><bottom style="thin"/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore([{name:"[Content_Types].xml",inhalt:ct},{name:"_rels/.rels",inhalt:rels},{name:"xl/workbook.xml",inhalt:wb},
    {name:"xl/_rels/workbook.xml.rels",inhalt:wbr},{name:"xl/styles.xml",inhalt:st}]
    .concat(blaetter.map((b,i)=>({name:"xl/worksheets/sheet"+(i+1)+".xml", inhalt:blattXml(b)}))));
}


