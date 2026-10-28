import { useEffect, useState } from 'react'
import { query } from '../db.js'
import { baselineSql, filterSql } from '../filters.js'
import { Bars, PlayList, Section, Tile, num, pct, signed } from '../components.jsx'

const RUN_DIR = `CASE
  WHEN run_location = 'middle' THEN '4 Middle'
  WHEN run_location = 'left' AND run_gap = 'end' THEN '1 Left end'
  WHEN run_location = 'left' AND run_gap = 'tackle' THEN '2 Left tackle'
  WHEN run_location = 'left' AND run_gap = 'guard' THEN '3 Left guard'
  WHEN run_location = 'right' AND run_gap = 'guard' THEN '5 Right guard'
  WHEN run_location = 'right' AND run_gap = 'tackle' THEN '6 Right tackle'
  WHEN run_location = 'right' AND run_gap = 'end' THEN '7 Right end'
END`

const PASS_TARGET = `CASE WHEN pass_length IS NOT NULL AND pass_location IS NOT NULL THEN
  (CASE pass_length WHEN 'short' THEN '1 Short ' ELSE '2 Deep ' END) || pass_location END`

// Category breakdown for the team, with the NFL share of the same category.
// `cat` is a SQL expression; rows where it is NULL are ignored.
async function breakdown(cat, where, isTeam, extra = '') {
  return query(`
    WITH x AS (SELECT ${cat} AS cat, ${isTeam} AS t, * FROM pbp WHERE ${where})
    SELECT cat,
      count(*) FILTER (WHERE t) AS n,
      count(*) FILTER (WHERE t) / sum(count(*) FILTER (WHERE t)) OVER () AS share,
      count(*) / sum(count(*)) OVER () AS lg_share,
      avg(epa) FILTER (WHERE t) AS epa
      ${extra}
    FROM x WHERE cat IS NOT NULL
    GROUP BY cat ORDER BY cat`)
}

const strip = (label) => label.replace(/^\d /, '')

export default function Scrimmage({ season, team, side, baseline, filters, hasPersonnel, baselineLabel }) {
  const [data, setData] = useState(null)
  const sideCol = side === 'def' ? 'defteam' : 'posteam'

  const base = ["season_type = 'REG'", "play_type IN ('pass', 'run')", ...filterSql(filters, side)]
  const isTeam = `(season = ${Number(season)} AND ${sideCol} = '${team}')`
  const teamWhere = [...base, isTeam].join(' AND ')
  const lgWhere = [...base, baselineSql(baseline, season)].join(' AND ')

  useEffect(() => {
    const stats = `
      count(*) AS plays,
      avg(pass) AS pass_rate,
      avg(pass - xpass) AS proe,
      avg(epa) AS epa,
      avg(success) AS success,
      avg(yards_gained) AS ypp,
      avg(epa) FILTER (WHERE pass = 1) AS epa_pass,
      avg(epa) FILTER (WHERE pass = 0) AS epa_run`
    const runWhere = `${lgWhere} AND play_type = 'run' AND qb_scramble = 0`
    const passWhere = `${lgWhere} AND play_type = 'pass' AND sack = 0`

    Promise.all([
      query(`SELECT ${stats} FROM pbp WHERE ${teamWhere}`),
      query(`SELECT ${stats} FROM pbp WHERE ${lgWhere}`),
      query(`SELECT down, count(*) AS plays, avg(pass) AS pass_rate, avg(epa) AS epa, avg(success) AS success
             FROM pbp WHERE ${teamWhere} AND down IS NOT NULL GROUP BY down ORDER BY down`),
      breakdown(RUN_DIR, runWhere, isTeam, ', avg(yards_gained) FILTER (WHERE t) AS ypc'),
      breakdown(PASS_TARGET, passWhere, isTeam, ', avg(complete_pass) FILTER (WHERE t) AS comp'),
      hasPersonnel
        ? breakdown('personnel', lgWhere, isTeam, ', avg(pass) FILTER (WHERE t) AS pass_rate')
        : Promise.resolve(null),
    ]).then(([[t], [lg], byDown, runs, passes, personnel]) =>
      setData({ t, lg, byDown, runs, passes, personnel }),
    )
  }, [teamWhere, lgWhere, hasPersonnel])

  if (!data) return <p className="muted">Loading…</p>
  const { t, lg } = data
  const isDef = side === 'def'

  if (!t.plays) {
    return <p className="muted empty">No plays match these filters.</p>
  }

  return (
    <>
      <section className="tiles">
        <Tile label="Plays" value={t.plays} />
        <Tile label="Pass rate" value={pct(t.pass_rate)} league={pct(lg.pass_rate)} leagueLabel={baselineLabel} />
        <Tile label="Pass rate over expected" value={pct(t.proe)} league={pct(lg.proe)} leagueLabel={baselineLabel} />
        <Tile label={isDef ? 'EPA / play allowed' : 'EPA / play'} value={signed(t.epa)} league={signed(lg.epa)} leagueLabel={baselineLabel} />
        <Tile label="Success rate" value={pct(t.success)} league={pct(lg.success)} leagueLabel={baselineLabel} />
        <Tile label="Yards / play" value={num(t.ypp, 2)} league={num(lg.ypp, 2)} leagueLabel={baselineLabel} />
        <Tile label="EPA / dropback" value={signed(t.epa_pass)} league={signed(lg.epa_pass)} leagueLabel={baselineLabel} />
        <Tile label="EPA / designed run" value={signed(t.epa_run)} league={signed(lg.epa_run)} leagueLabel={baselineLabel} />
      </section>
      {isDef && <p className="muted small">Defense: lower EPA and success rate allowed is better.</p>}

      <Section title="By down">
        <table>
          <thead>
            <tr><th>Down</th><th>Plays</th><th>Pass</th><th>EPA</th><th>Success</th></tr>
          </thead>
          <tbody>
            {data.byDown.map((r) => (
              <tr key={r.down}>
                <td>{r.down}</td>
                <td>{r.plays}</td>
                <td>{pct(r.pass_rate)}</td>
                <td>{signed(r.epa, 2)}</td>
                <td>{pct(r.success)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Run direction" note={`Designed runs (no scrambles). Share of runs · EPA/run · ${baselineLabel} share.`}>
        <Bars
          rows={data.runs.map((r) => ({
            label: strip(r.cat),
            value: r.share,
            right: r.n ? `${pct(r.share, 0)} · ${signed(r.epa, 2)}` : '–',
            sub: `${num(r.ypc)} ypc · ${baselineLabel} ${pct(r.lg_share, 0)}`,
          }))}
        />
      </Section>

      <Section title="Pass targets" note={`Short = under 15 air yards. Share of targets · EPA/target · ${baselineLabel} share.`}>
        <Bars
          rows={data.passes.map((r) => ({
            label: strip(r.cat).replace(/ (\w)/, (m) => m.toUpperCase()),
            value: r.share,
            right: r.n ? `${pct(r.share, 0)} · ${signed(r.epa, 2)}` : '–',
            sub: `${pct(r.comp, 0)} comp · ${baselineLabel} ${pct(r.lg_share, 0)}`,
          }))}
        />
      </Section>

      {data.personnel ? (
        <Section title="Personnel" note={`Share of plays · pass rate · EPA/play · ${baselineLabel} share.`}>
          <Bars
            rows={data.personnel
              .filter((r) => r.n > 0)
              .sort((a, b) => b.n - a.n)
              .slice(0, 8)
              .map((r) => ({
                label: r.cat,
                value: r.share,
                right: `${pct(r.share, 0)} · ${signed(r.epa, 2)}`,
                sub: `${pct(r.pass_rate, 0)} pass · ${baselineLabel} ${pct(r.lg_share, 0)}`,
              }))}
          />
        </Section>
      ) : (
        <Section title="Personnel" note={`nflverse hasn't published ${season} personnel data yet. It will appear here automatically once they do.`} />
      )}

      <PlayList where={teamWhere} title={`Every matching play (${t.plays})`} />
    </>
  )
}
