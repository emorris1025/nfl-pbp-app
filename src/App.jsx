import { useEffect, useState } from 'react'
import { getDb, query } from './db.js'

const pct = (v) => (v == null ? '–' : `${(v * 100).toFixed(1)}%`)
const signed = (v, d = 3) => (v == null ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}`)

const STAT_SQL = `
  count(*) AS plays,
  avg(pass) AS pass_rate,
  avg(epa) AS epa,
  avg(success) AS success,
  avg(yards_gained) AS ypp`

export default function App() {
  const [manifest, setManifest] = useState(null)
  const [teams, setTeams] = useState([])
  const [season, setSeason] = useState(null)
  const [team, setTeam] = useState('')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDb()
      .then(async ({ manifest }) => {
        setManifest(manifest)
        const latest = Math.max(...manifest.seasons.map((s) => s.season))
        setSeason(latest)
        const rows = await query(`SELECT DISTINCT posteam FROM pbp WHERE season = ${latest} ORDER BY 1`)
        setTeams(rows.map((r) => r.posteam))
        setTeam(rows[0]?.posteam ?? '')
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!season || !/^[A-Z]{2,3}$/.test(team)) return
    const where = `season = ${Number(season)} AND season_type = 'REG'`
    Promise.all([
      query(`SELECT ${STAT_SQL} FROM pbp WHERE ${where} AND posteam = '${team}'`),
      query(`SELECT ${STAT_SQL} FROM pbp WHERE ${where}`),
      query(`SELECT down, ${STAT_SQL} FROM pbp
             WHERE ${where} AND posteam = '${team}' AND down IS NOT NULL
             GROUP BY down ORDER BY down`),
    ])
      .then(([[t], [lg], byDown]) => setStats({ t, lg, byDown }))
      .catch((e) => setError(String(e)))
  }, [season, team])

  if (error) return <main><p className="error">Something went wrong: {error}</p></main>
  if (!manifest) return <main><p className="muted">Loading data engine…</p></main>

  const info = manifest.seasons.find((s) => s.season === season)

  return (
    <main>
      <header>
        <h1>Team Tendencies</h1>
        <p className="muted">
          Offense · regular season · data through week {info?.max_week} ·
          updated {new Date(manifest.built_at).toLocaleDateString()}
        </p>
      </header>

      <div className="pickers">
        <label>
          Season
          <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
            {manifest.seasons.map((s) => <option key={s.season}>{s.season}</option>)}
          </select>
        </label>
        <label>
          Team
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {teams.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {stats && (
        <>
          <section className="tiles">
            <Tile label="Pass rate" value={pct(stats.t.pass_rate)} league={pct(stats.lg.pass_rate)} />
            <Tile label="EPA / play" value={signed(stats.t.epa)} league={signed(stats.lg.epa)} />
            <Tile label="Success rate" value={pct(stats.t.success)} league={pct(stats.lg.success)} />
            <Tile label="Yards / play" value={stats.t.ypp?.toFixed(2)} league={stats.lg.ypp?.toFixed(2)} />
          </section>

          <h2>By down</h2>
          <table>
            <thead>
              <tr><th>Down</th><th>Plays</th><th>Pass</th><th>EPA</th><th>Success</th></tr>
            </thead>
            <tbody>
              {stats.byDown.map((r) => (
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
          <p className="muted small">{stats.t.plays} run/pass plays. League figures are per-play averages.</p>
        </>
      )}
    </main>
  )
}

function Tile({ label, value, league }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-league">NFL {league}</div>
    </div>
  )
}
