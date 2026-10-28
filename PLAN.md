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
| Query engine | DuckDB-WASM, which runs SQL on Parquet files inside the phone browser |
| Display | Headline numbers plus simple bar charts |
| Usage | Weekly prep on Wi-Fi (offline caching not required) |
| First feature (MVP) | Team tendencies |

## 2. Architecture

```
nflverse (GitHub releases, nightly)
        |
        v
GitHub Action (runs nightly in season)
  - Python script downloads play_by_play_YYYY.parquet
  - keeps ~40 of ~370 columns, regular + post season only
  - writes data/pbp_YYYY.parquet  (~10-20 MB per season)
        |
        v
GitHub Pages (static site)
  - index.html + JS app (Vite + React)
  - data/*.parquet
        |
        v
Phone browser (PWA)
  - DuckDB-WASM loads Parquet, runs SQL for each filter change
  - Chart.js renders charts
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

**Data caveat:** shotgun and no-huddle are in the core play-by-play file. Personnel groupings and formation come from the separate nflverse *participation* dataset, which can lag or have gaps for the current season. Phase 1 uses shotgun/no-huddle; Phase 3 adds personnel after the data has been checked.

## 4. Build phases

| Phase | Deliverable | You'll be able to... |
|---|---|---|
| **0. Setup** | GitHub repo, Pages enabled, project skeleton | Open a "hello" page on your phone |
| **1. Data pipeline** | Python prep script + nightly GitHub Action | See fresh data files land automatically |
| **2. MVP screen** | Team picker + down/distance + field position + game script filters, headline tiles, 2-3 charts | Do real weekly tendency prep |
| **3. Personnel** | Join participation data; personnel/formation filters | Filter by 11 vs. 12 personnel, etc. |
| **4. Advanced metrics** | League rankings: team/QB EPA, success rate, CPOE | See where teams rank |
| **5. Game previews** | Matchup screen: Team A offense vs. Team B defense, side by side | Prep for a specific game / betting angle |
| **6. Player / fantasy** | Player usage: targets, carries, air yards, red zone share, weekly trend | Do fantasy research |

## 5. GitHub setup (guided, during Phase 0)

You have an account but want help. Steps we'll do together:
1. Create a new repository (e.g. `nfl-pbp-app`), public (required for free Pages).
2. Connect the repository to this Claude Code environment so I can push code.
3. Turn on GitHub Pages (Settings > Pages > Source: GitHub Actions).
4. Confirm the nightly Action has permission to commit data files.

## 6. Open questions for later

- Should defensive tendencies be in the MVP or come right after? (Planned: offense first, defense with a toggle in Phase 2.)
- Which "league average" baseline should comparisons use: same season, or all loaded seasons?
- Do you want to save favorite filter presets (e.g. "3rd & medium, red zone")?
- Should the betting screen include spreads and totals? (nflverse has closing lines in its schedules data.)
