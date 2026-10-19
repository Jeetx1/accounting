<img src="docs/logo.svg" width="96" alt="">

# Accounting

Personal double-entry bookkeeping in one offline HTML app: booking with a live balance check, journal, ledger,
balance sheet, income statement, cash flow (direct and indirect), investments, fixed assets with depreciation,
twelve-month view, year comparison and closing, Excel and PDF exports. No libraries, no server, no tracking.

The app holds no data: your books are a separate `.json` file you open in it, and Save writes straight back into
that file (Chrome/Edge on a computer) or downloads it (other browsers, iPhone).

- App: `docs/index.html` (built from `src/` by `./build.sh`; served by GitHub Pages from `/docs`)
- Tests: `./run_tests.sh` (jsdom, synthetic data from `tests/make_fixture.js`; CI runs them on every push)
- New file: start the app and choose *New*; it starts from the neutral chart of accounts in `src/10_template.html`.

## Your data stays out of this repository

A GitHub Pages repository is public. Everything personal is git-ignored: `private/`, every `.json` except
`package.json`, all Excel/CSV/PDF exports, backups and any dated copy of the app (`*ACCOUNTING*.html`).
Keep your real file in `private/` if you want the tests to run an extra open + save round trip on it locally.
Before committing, `git status` should list only `src/`, `docs/`, `tests/` and the files in this folder.

## Structure

| Path | What |
|---|---|
| `src/01_head.html` | Head and all CSS |
| `src/02_body.html` | Markup: start screen, navigation, every page, dialogs |
| `src/10_template.html` | Template for new files: groups, statement structure, neutral chart of accounts |
| `src/20_engine.html`, `src/22_engine_plus.html` | Engine: file check and repair, balances, statements, spreads, fixed assets, imports |
| `src/30_ui.html` … `src/99_boot.js` | Interface (one closure): views, booking, statements engine, reports, fixed assets, Excel writer, exports, import, start |
| `tests/` | `make_fixture.js` (synthetic books of a fictional "Test Person"), `checks.js` (the steps), `test_app.js` (jsdom runner) |
