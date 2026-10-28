"""Download nflverse play-by-play and trim it to a small Parquet file per season.

Usage: python scripts/build_data.py --out public/data [--seasons 2023 2024 2025 2026]

Output, per season: pbp_<season>.arrow.gz (run/pass plays only, ~60 columns),
plus manifest.json listing what was built and when.

Gzipped Arrow is used instead of Parquet because DuckDB-WASM reads Arrow
natively, while Parquet needs an extension downloaded from extensions.duckdb.org
at runtime. Browsers unzip the file with the built-in DecompressionStream.
"""

import argparse
import datetime as dt
import json
import pathlib
import urllib.error
import urllib.request

import duckdb
import gzip
import pyarrow.ipc as ipc

BASE = "https://github.com/nflverse/nflverse-data/releases/download"
PBP_URL = BASE + "/pbp/play_by_play_{season}.parquet"
PART_URL = BASE + "/pbp_participation/pbp_participation_{season}.parquet"

PBP_COLS = [
    # game / situation
    "game_id", "play_id", "season", "week", "season_type", "game_date",
    "posteam", "defteam", "home_team", "away_team",
    "qtr", "down", "ydstogo", "yardline_100", "goal_to_go",
    "game_seconds_remaining", "half_seconds_remaining",
    "score_differential", "wp",
    # play type / formation basics
    "play_type", "pass", "rush", "qb_dropback", "qb_scramble", "sack",
    "shotgun", "no_huddle", "xpass", "pass_oe",
    # direction / depth
    "pass_length", "pass_location", "air_yards", "run_location", "run_gap",
    # results
    "yards_gained", "epa", "success", "cpoe", "first_down", "touchdown",
    "interception", "fumble_lost", "complete_pass",
    # players
    "passer_player_id", "passer_player_name",
    "rusher_player_id", "rusher_player_name",
    "receiver_player_id", "receiver_player_name",
]
# name -> type (types are needed to fill NULLs when a season has no data yet)
PART_COLS = {
    "offense_personnel": "VARCHAR", "offense_formation": "VARCHAR",
    "defense_personnel": "VARCHAR", "defenders_in_box": "INTEGER",
    "number_of_pass_rushers": "INTEGER", "defense_man_zone_type": "VARCHAR",
    "defense_coverage_type": "VARCHAR",
}


def download(url: str, dest: pathlib.Path) -> bool:
    try:
        urllib.request.urlretrieve(url, dest)
        return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise


def build_season(con, season: int, raw: pathlib.Path, out: pathlib.Path) -> dict:
    pbp = raw / f"pbp_{season}.parquet"
    if not download(PBP_URL.format(season=season), pbp):
        raise SystemExit(f"No play-by-play published for {season}")

    part = raw / f"part_{season}.parquet"
    has_part = download(PART_URL.format(season=season), part)

    pbp_select = ", ".join(f"p.{c}" for c in PBP_COLS)
    if has_part:
        part_select = ", ".join(f"x.{c}" for c in PART_COLS)
        # "1 C, 2 G, 1 QB, 1 RB, 2 T, 1 TE, 3 WR" -> "11" (RB+FB count, TE count)
        n = "coalesce(try_cast(regexp_extract(x.offense_personnel, '(\\d+) {}', 1) AS INT), 0)"
        part_select += (", CASE WHEN x.offense_personnel IS NOT NULL THEN "
                        f"({n.format('RB')} + {n.format('FB')})::VARCHAR || {n.format('TE')}::VARCHAR "
                        "END AS personnel")
        join = (f"LEFT JOIN '{part}' x "
                "ON x.nflverse_game_id = p.game_id AND x.play_id = p.play_id")
    else:
        # Participation for the current season can lag; keep the schema stable.
        part_select = ", ".join(f"NULL::{t} AS {c}" for c, t in PART_COLS.items())
        part_select += ", NULL::VARCHAR AS personnel"
        join = ""

    table = con.sql(f"""
        SELECT {pbp_select}, {part_select}
        FROM '{pbp}' p {join}
        WHERE p.play_type IN ('pass', 'run')
        ORDER BY p.posteam, p.game_id, p.play_id
    """).to_arrow_table()

    dest = out / f"pbp_{season}.arrow.gz"
    with gzip.open(dest, "wb", compresslevel=9) as f:
        with ipc.new_stream(f, table.schema) as writer:
            writer.write_table(table)

    weeks = table.column("week").to_pylist()
    return {"season": season, "file": dest.name, "plays": table.num_rows,
            "max_week": max(weeks), "has_personnel": has_part,
            "bytes": dest.stat().st_size}


def main():
    this_year = dt.date.today().year
    # NFL season N runs Sept N to Feb N+1.
    current = this_year if dt.date.today().month >= 9 else this_year - 1
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/data")
    ap.add_argument("--raw", default=".cache/raw")
    ap.add_argument("--seasons", nargs="*", type=int,
                    default=list(range(current - 3, current + 1)))
    args = ap.parse_args()

    out, raw = pathlib.Path(args.out), pathlib.Path(args.raw)
    out.mkdir(parents=True, exist_ok=True)
    raw.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect()
    seasons = [build_season(con, s, raw, out) for s in args.seasons]
    for s in seasons:
        print(s)

    manifest = {"built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "seasons": seasons}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
