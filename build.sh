#!/bin/bash
# Builds the single-file app from src/ (plain concatenation, no tooling) into docs/index.html.
# docs/ is what GitHub Pages serves (Settings > Pages > Deploy from branch: main, folder /docs).
set -e
cd "$(dirname "$0")"
mkdir -p docs
cat src/01_head.html src/02_body.html src/10_template.html \
    src/20_engine.html src/22_engine_plus.html \
    src/30_ui.html src/40_book.js src/50_fs_engine.js src/60_reports.js src/62_statements.js \
    src/64_fixed_assets.js src/70_excel.js src/72_exports.js src/74_import.js src/99_boot.js > docs/index.html
# every script block must compile
node - <<'JS'
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync('docs/index.html', 'utf8');
const re = /<script[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0;
while ((m = re.exec(s))){ try { new vm.Script(m[1], { filename: 'script block ' + i }); } catch (e) { console.error('Syntax error in script block ' + i + ':\n' + e.message); process.exit(1); } i++; }
console.log('Built docs/index.html (' + Math.round(Buffer.byteLength(s) / 1024) + ' KB), all ' + i + ' script blocks compile.');
JS
