import { useEffect, useState } from 'react'
import { query } from '../db.js'
import { baselineSql } from '../filters.js'
import { Bars, PlayList, Section, Tile, num, pct, signed } from '../components.jsx'

// Which team "owns" each kind of kick in nflverse data:
//   punts, field goals, extra points: posteam is the kicking team
//   kickoffs: posteam is the RECEIVING team, defteam is the kicking team
const KR_RETURNED = "kickoff_returner_player_name IS NOT NULL AND touchback = 0 AND coalesce(kickoff_fair_catch, 0) = 0"
const PR_RETURNED = "punt_returner_player_name IS NOT NULL AND coalesce(punt_fair_catch, 0) = 0"

// `t(col)` returns the condition that `col` is the selected team (or TRUE for
// the league), so the same SQL computes both the team and the NFL numbers.
const statsSql = (t) => `
  count(*) FILTER (WHERE play_type = 'field_goal' AND ${t('posteam')}) AS fga,
  avg((field_goal_result = 'made')::INT) FILTER (WHERE play_type = 'field_goal' AND ${t('posteam')}) AS fg_pct,
  count(*) FILTER (WHERE play_type = 'extra_point' AND ${t('posteam')}) AS xpa,
  avg((extra_point_result = 'good')::INT) FILTER (WHERE play_type = 'extra_point' AND ${t('posteam')}) AS xp_pct,
  count(*) FILTER (WHERE two_point_attempt = 1 AND ${t('posteam')}) AS two_att,
  avg((two_point_conv_result = 'success')::INT) FILTER (WHERE two_point_attempt = 1 AND ${t('posteam')}) AS two_pct,

  count(*) FILTER (WHERE play_type = 'punt' AND ${t('posteam')}) AS punts,
  avg(kick_distance) FILTER (WHERE play_type = 'punt' AND ${t('posteam')}) AS punt_gross,
  avg(kick_distance - coalesce(return_yards, 0) - 20 * touchback)
    FILTER (WHERE play_type = 'punt' AND ${t('posteam')} AND kick_distance IS NOT NULL) AS punt_net,
  avg(punt_inside_twenty) FILTER (WHERE play_type = 'punt' AND ${t('posteam')}) AS punt_in20,
  avg(touchback) FILTER (WHERE play_type = 'punt' AND ${t('posteam')}) AS punt_tb,
  sum(punt_blocked) FILTER (WHERE play_type = 'punt' AND ${t('posteam')}) AS punts_blocked,
  avg(return_yards) FILTER (WHERE play_type = 'punt' AND ${t('posteam')} AND ${PR_RETURNED}) AS pr_allowed,

  count(*) FILTER (WHERE play_type = 'kickoff' AND ${t('defteam')}) AS kickoffs,
  avg(touchback) FILTER (WHERE play_type = 'kickoff' AND ${t('defteam')}) AS ko_tb,
  avg(return_yards) FILTER (WHERE play_type = 'kickoff' AND ${t('defteam')} AND ${KR_RETURNED}) AS kr_allowed,

  count(*) FILTER (WHERE play_type = 'kickoff' AND ${t('posteam')} AND ${KR_RETURNED}) AS kr,
  avg(return_yards) FILTER (WHERE play_type = 'kickoff' AND ${t('posteam')} AND ${KR_RETURNED}) AS kr_avg,
  count(*) FILTER (WHERE play_type = 'punt' AND ${t('defteam')} AND ${PR_RETURNED}) AS pr,
  avg(return_yards) FILTER (WHERE play_type = 'punt' AND ${t('defteam')} AND ${PR_RETURNED}) AS pr_avg,
  count(*) FILTER (WHERE return_touchdown = 1 AND ${t('return_team')}) AS ret_td`

const FG_BUCKET = `CASE
  WHEN kick_distance < 30 THEN '1 Under 30'
  WHEN kick_distance < 40 THEN '2 30-39'
  WHEN kick_distance < 50 THEN '3 40-49'
  ELSE '4 50+' END`

export default function SpecialTeams({ season, team, baseline, baselineLabel }) {
  const [data, setData] = useState(null)
  const s = Number(season)
  const reg = "season_type = 'REG'"
  const teamWhere = `${reg} AND season = ${s}`
  const lgWhere = `${reg} AND ${baselineSql(baseline, season)}`
  const isTeam = (col) => `${col} = '${team}'`

  useEffect(() => {
    Promise.all([
      query(`SELECT ${statsSql(isTeam)},
               mode(kicker_player_name) FILTER (WHERE play_type = 'field_goal' AND posteam = '${team}') AS kicker,
               mode(punter_player_name) FILTER (WHERE play_type = 'punt' AND posteam = '${team}') AS punter,
               count(DISTINCT game_id) FILTER (WHERE home_team = '${team}' OR away_team = '${team}') AS games,
               sum(epa) FILTER (WHERE st_play AND posteam = '${team}')
                 - sum(epa) FILTER (WHERE st_play AND defteam = '${team}') AS st_epa
             FROM pbp WHERE ${teamWhere}`),
      query(`SELECT ${statsSql(() => 'TRUE')} FROM pbp WHERE ${lgWhere}`),
      query(`SELECT ${FG_BUCKET} AS bucket,
               count(*) FILTER (WHERE season = ${s} AND posteam = '${team}') AS att,
               count(*) FILTER (WHERE season = ${s} AND posteam = '${team}' AND field_goal_result = 'made') AS made,
               avg((field_goal_result = 'made')::INT) AS lg_pct
             FROM pbp WHERE ${lgWhere} AND play_type = 'field_goal'
             GROUP BY bucket ORDER BY bucket`),
    ]).then(([[t], [lg], fg]) => setData({ t, lg, fg }))
  }, [team, s, baseline])

  if (!data) return <p className="muted">Loading…</p>
  const { t, lg } = data
  const L = baselineLabel

  return (
    <>
      <section className="tiles">
        <Tile label="Special teams EPA / game" value={t.games ? signed(t.st_epa / t.games, 2) : '–'} />
        <Tile label="Return TDs" value={t.ret_td} />
      </section>
      <p className="muted small">
        Regular season · {t.games} games · K {t.kicker ?? '–'} · P {t.punter ?? '–'}.
        Situational filters don't apply to special teams.
      </p>

      <Section title="Kicking">
        <section className="tiles">
          <Tile label={`Field goals (${t.fga})`} value={pct(t.fg_pct)} league={pct(lg.fg_pct)} leagueLabel={L} />
          <Tile label={`Extra points (${t.xpa})`} value={pct(t.xp_pct)} league={pct(lg.xp_pct)} leagueLabel={L} />
          <Tile label={`2-pt tries (${t.two_att})`} value={pct(t.two_pct)} league={pct(lg.two_pct)} leagueLabel={L} />
          <Tile label={`Kickoff touchback % (${t.kickoffs})`} value={pct(t.ko_tb)} league={pct(lg.ko_tb)} leagueLabel={L} />
        </section>
        <h3>Field goals by distance</h3>
        <Bars
          rows={data.fg.map((r) => ({
            label: r.bucket.replace(/^\d /, ''),
            value: r.att ? r.made / r.att : 0,
            right: r.att ? `${r.made}/${r.att} · ${pct(r.made / r.att, 0)}` : '0/0',
            sub: `${L} ${pct(r.lg_pct, 0)}`,
          }))}
        />
      </Section>

      <Section title="Punting" note="Net is approximate: gross minus return yards, minus 20 for touchbacks.">
        <section className="tiles">
          <Tile label={`Gross avg (${t.punts} punts)`} value={num(t.punt_gross)} league={num(lg.punt_gross)} leagueLabel={L} />
          <Tile label="Net avg" value={num(t.punt_net)} league={num(lg.punt_net)} leagueLabel={L} />
          <Tile label="Inside 20" value={pct(t.punt_in20)} league={pct(lg.punt_in20)} leagueLabel={L} />
          <Tile label={`Touchbacks · ${t.punts_blocked ?? 0} blocked`} value={pct(t.punt_tb)} league={pct(lg.punt_tb)} leagueLabel={L} />
        </section>
      </Section>

      <Section title="Returns">
        <section className="tiles">
          <Tile label={`Kick return avg (${t.kr})`} value={num(t.kr_avg)} league={num(lg.kr_avg)} leagueLabel={L} />
          <Tile label={`Punt return avg (${t.pr})`} value={num(t.pr_avg)} league={num(lg.pr_avg)} leagueLabel={L} />
          <Tile label="Kick return allowed" value={num(t.kr_allowed)} league={num(lg.kr_allowed)} leagueLabel={L} />
          <Tile label="Punt return allowed" value={num(t.pr_allowed)} league={num(lg.pr_allowed)} leagueLabel={L} />
        </section>
      </Section>

      <PlayList
        where={`${teamWhere} AND st_play AND (posteam = '${team}' OR defteam = '${team}')`}
        title="Every special teams play"
      />
    </>
  )
}
