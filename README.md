# NFL Play-by-Play Analyzer

A personal mobile web app for analyzing NFL play-by-play data. Built from
[nflverse](https://github.com/nflverse/nflverse-data) data, hosted free on
GitHub Pages, with all queries running in the phone's browser via DuckDB-WASM.

See [PLAN.md](PLAN.md) for the roadmap.

## How it works

1. `scripts/build_data.py` downloads nflverse play-by-play and participation
   (personnel) data, keeps run/pass plays and the needed columns, and writes
   one gzipped Arrow file per season to `public/data/` (~2.5 MB per season).
2. `npm run build` bundles the React app (in `src/`) into `dist/`.
3. The GitHub Actions workflow does both nightly during the season and
   publishes the result to GitHub Pages.

## Run locally

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/build_data.py      # default: last 3 seasons + current
npm install
npm run dev                                  # http://localhost:5173/nfl-pbp-app/
```

## Add to your phone

Open the site in Safari (iPhone) or Chrome (Android), then
Share > **Add to Home Screen**.
