# NFL Play-by-Play Analyzer: Project Plan

_Started 2026-10-28_

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Audience | Personal use only (no accounts, no app store) |
| Platform | Mobile web app (PWA), added to the phone's home screen |
| Data source | nflverse play-by-play (free, updated nightly in season) |
| Freshness | Next-day (nightly refresh) |
| History | 2023 through the current 2026 season |
| Hosting | Free static hosting (GitHub Pages) with no server |
| Query engine | DuckDB-WASM, which runs SQL inside the phone browser on gzipped Arrow files |
| Display | Headline numbers plus simple bar charts |
| Usage | Weekly prep on Wi-Fi (offline caching not required) |
| First feature (MVP) | Team tendencies |

## 2. Architecture

```
nflverse (GitHub releases, nightly)
        |
        v
GitHub Action (nightly Sept-Feb, on push, or on demand)
  - Python script downloads play_by_play_YYYY + pbp_participation_YYYY
  - keeps run/pass plays and ~60 of ~370 columns, joins personnel
  - writes data/pbp_YYYY.arrow.gz  (~2.5 MB per season)
  - builds the app and deploys both to Pages (data is not committed to git)
        |
        v
GitHub Pages (static site)
  - index.html + JS app (Vite + React)
  - data/*.arrow.gz + manifest.json
        |
        v
Phone browser (PWA)
  - unzips each season and loads it into DuckDB-WASM (one-time ~8 MB engine download, then cached)
  - runs SQL for each filter change
  - Chart.js renders charts (Phase 2)
```

Running cost: $0.

## 3. MVP: Team Tendencies screen

**Pick:** team, season(s), side (offense or defense), optional opponent and week range.

**Filters (all combinable):**
- **Down & distance:** down 1-4; distance buckets 1-2, 3-6, 7-10, 11+
- **Field position:** own 1-20, own 21-50, opp 49-21, red zone (opp 20-1), goal-to-go
- **Game script:** quarter, score differential (trailing 9+, trailing 1-8, tied, leading 1-8, leading 9+), two-minute drill, win-probability range
- **Personnel / formation:** shotgun vs. under center, no-huddle, offensive personnel (11/12/21...), formation

**Outputs:**
- Headline tiles: plays, pass rate, EPA/play, success rate, yards/play
- Pass rate vs. league average for the same filters (the "over expected" view)
- Bar charts: run direction/gap, pass depth (short/intermediate/deep), pass location (L/M/R)
- Splits table: EPA and success rate by down, run vs. pass

**Data caveat (checked 2026-10-28):** shotgun and no-huddle are in the core play-by-play file. Personnel groupings and formation come from the separate nflverse *participation* dataset. It is complete for 2023-2025 (100% of plays matched), but **nflverse has not yet published 2026 participation data**. The pipeline already joins it and derives a `personnel` column (`11`, `12`, `21`...). 2026 plays will show personnel automatically once nflverse publishes the data. Participation data also includes defensive coverage (man/zone, Cover 1/2/3...), which could support a future defensive screen.

**Why Arrow instead of Parquet:** DuckDB-WASM's Parquet reader is an extension downloaded at runtime from extensions.duckdb.org. Gzipped Arrow loads with no extra dependency and is about the same size.

## 4. Build phases

| Phase | Deliverable | You'll be able to... |
|---|---|---|
| **0. Setup** ✅ code done, awaiting GitHub | Repo, Pages, skeleton screen with team/season pickers, headline tiles vs. NFL, by-down table | Open a working page on your phone |
| **1. Data pipeline** ✅ code done, awaiting GitHub | Python prep script + nightly GitHub Action | See fresh data land automatically |
| **2. MVP screen** | Team picker + down/distance + field position + game script filters, headline tiles, 2-3 charts | Do real weekly tendency prep |
| **3. Personnel** | Join participation data; personnel/formation filters | Filter by 11 vs. 12 personnel, etc. |
| **4. Advanced metrics** | League rankings: team/QB EPA, success rate, CPOE | See where teams rank |
| **5. Game previews** | Matchup screen: Team A offense vs. Team B defense, side by side | Prep for a specific game / betting angle |
| **6. Player / fantasy** | Player usage: targets, carries, air yards, red zone share, weekly trend | Do fantasy research |

## 5. GitHub setup (guided, during Phase 0)

You have an account but want help. Steps we'll do together:
1. Create a new repository (e.g. `nfl-pbp-app`), public (required for free Pages).
2. Link GitHub to Claude (claude.ai/connect-github) and install the Claude GitHub App on the repo so code can be pushed.
3. Turn on GitHub Pages (Settings > Pages > Source: **GitHub Actions**).
4. Push, watch the first workflow run, then open `https://emorris1025.github.io/nfl-pbp-app/` on your phone.

## 6. Open questions for later

- Should defensive tendencies be in the MVP or come right after? (Planned: offense first, defense with a toggle in Phase 2.)
- Which "league average" baseline should comparisons use: same season, or all loaded seasons?
- Do you want to save favorite filter presets (e.g. "3rd & medium, red zone")?
- Should the betting screen include spreads and totals? (nflverse has closing lines in its schedules data.)
