import { useEffect, useState } from 'react'
import { query } from '../db.js'
import { baselineSql } from '../filters.js'
import { Bars, PlayList, Section, Tile, num } from '../components.jsx'

// nflverse records one penalty per play (the first one called), and only
// accepted penalties have penalty = 1. Offsetting/declined flags are excluded.
const UNIT = `CASE WHEN st_play THEN 'Special teams'
  WHEN penalty_team = posteam THEN 'Offense' ELSE 'Defense' END`

export default function Penalties({ season, team, baseline, baselineLabel }) {
  const [data, setData] = useState(null)
  const s = Number(season)
  const reg = "season_type = 'REG'"
  const inGame = `(home_team = '${team}' OR away_team = '${team}')`
  const teamWhere = `${reg} AND season = ${s}`
  const lgWhere = `${reg} AND ${baselineSql(baseline, season)}`
  const committed = `penalty = 1 AND penalty_team = '${team}'`

  useEffect(() => {
    Promise.all([
      query(`SELECT
               count(DISTINCT game_id) FILTER (WHERE ${inGame}) AS games,
               count(*) FILTER (WHERE ${committed}) AS n,
               sum(penalty_yards) FILTER (WHERE ${committed}) AS yds,
               count(*) FILTER (WHERE penalty = 1 AND ${inGame} AND penalty_team <> '${team}') AS drawn,
               sum(penalty_yards) FILTER (WHERE penalty = 1 AND ${inGame} AND penalty_team <> '${team}') AS drawn_yds,
               count(*) FILTER (WHERE ${committed} AND first_down_penalty = 1 AND defteam = '${team}') AS auto_first
             FROM pbp WHERE ${teamWhere}`),
      // League per team-game: every game has two teams.
      query(`SELECT
               count(*) FILTER (WHERE penalty = 1) / (2 * count(DISTINCT game_id)) AS n_pg,
               sum(penalty_yards) FILTER (WHERE penalty = 1) / (2 * count(DISTINCT game_id)) AS yds_pg
             FROM pbp WHERE ${lgWhere}`),
      query(`SELECT ${UNIT} AS unit, count(*) AS n, sum(penalty_yards) AS yds
             FROM pbp WHERE ${teamWhere} AND ${committed}
             GROUP BY unit ORDER BY n DESC`),
      query(`WITH lg AS (
               SELECT penalty_type,
                 count(*) / (SELECT 2 * count(DISTINCT game_id) FROM pbp WHERE ${lgWhere}) AS per_game
               FROM pbp WHERE ${lgWhere} AND penalty = 1 GROUP BY penalty_type),
             t AS (
               SELECT penalty_type, count(*) AS n, sum(penalty_yards) AS yds
               FROM pbp WHERE ${teamWhere} AND ${committed} GROUP BY penalty_type)
             SELECT t.*, lg.per_game AS lg_per_game
             FROM t LEFT JOIN lg USING (penalty_type)
             ORDER BY n DESC LIMIT 10`),
      query(`SELECT penalty_player_name AS name, count(*) AS n, sum(penalty_yards) AS yds
             FROM pbp WHERE ${teamWhere} AND ${committed} AND penalty_player_name IS NOT NULL
             GROUP BY name ORDER BY n DESC, yds DESC LIMIT 6`),
    ]).then(([[t], [lg], units, types, players]) => setData({ t, lg, units, types, players }))
  }, [team, s, baseline])

  if (!data) return <p className="muted">Loading…</p>
  const { t, lg } = data
  const L = baselineLabel
  const pg = (v, d = 1) => (t.games ? num(v / t.games, d) : "–")

  return (
    <>
      <section className="tiles">
        <Tile label={`Penalties (${t.n})`} value={`${pg(t.n)}/gm`} league={`${num(lg.n_pg)}/gm`} leagueLabel={L} />
        <Tile label={`Yards (${t.yds ?? 0})`} value={`${pg(t.yds)}/gm`} league={`${num(lg.yds_pg)}/gm`} leagueLabel={L} />
        <Tile label={`Drawn from opponents (${t.drawn})`} value={`${pg(t.drawn)}/gm`} league={`${num(lg.n_pg)}/gm`} leagueLabel={L} />
        <Tile label="Automatic 1st downs given" value={t.auto_first} />
      </section>
      <p className="muted small">
        Accepted penalties, regular season, {t.games} games. nflverse records only the first
        flag on a play, so declined and offsetting penalties aren't counted.
      </p>

      <Section title="By unit">
        <Bars
          rows={data.units.map((r) => ({
            label: r.unit,
            value: r.n,
            right: `${r.n} · ${r.yds} yds`,
          }))}
        />
      </Section>

      <Section title="By type" note="Total · yards · per game, with the per-team-game average.">
        <Bars
          rows={data.types.map((r) => ({
            label: r.penalty_type ?? 'Unknown',
            value: r.n,
            right: `${r.n} · ${r.yds} yds`,
            sub: `${pg(r.n, 2)}/gm · ${L} ${num(r.lg_per_game, 2)}`,
          }))}
        />
      </Section>

      <Section title="Most penalized players">
        <Bars rows={data.players.map((r) => ({ label: r.name, value: r.n, right: `${r.n} · ${r.yds} yds` }))} />
      </Section>

      <PlayList where={`${teamWhere} AND ${committed}`} title={`Every ${team} penalty (${t.n})`} />
    </>
  )
}
