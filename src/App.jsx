import { useEffect, useState } from 'react'
import { getDb, query } from './db.js'
import { FILTER_GROUPS, activeCount, emptyFilters } from './filters.js'
import { Chips, Segmented } from './components.jsx'
import Scrimmage from './views/Scrimmage.jsx'
import SpecialTeams from './views/SpecialTeams.jsx'
import Penalties from './views/Penalties.jsx'

const VIEWS = [
  { id: 'off', label: 'Offense' },
  { id: 'def', label: 'Defense' },
  { id: 'st', label: 'Special teams' },
  { id: 'pen', label: 'Penalties' },
]

// Remembered between visits; storage can be unavailable (private mode).
function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial
    } catch {
      return initial
    }
  })
  const set = (v) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      // ignore
    }
  }
  return [value, set]
}

export default function App() {
  const [manifest, setManifest] = useState(null)
  const [teams, setTeams] = useState([])
  const [season, setSeason] = useState(null)
  const [team, setTeam] = usePref('team', null)
  const [view, setView] = usePref('view', 'off')
  const [baseline, setBaseline] = usePref('baseline', 'season')
  const [filters, setFilters] = useState(emptyFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDb()
      .then(async ({ manifest }) => {
        const latest = Math.max(...manifest.seasons.map((s) => s.season))
        const rows = await query(`SELECT DISTINCT posteam FROM pbp WHERE season = ${latest} AND posteam IS NOT NULL ORDER BY 1`)
        const list = rows.map((r) => r.posteam)
        setTeams(list)
        if (!list.includes(team)) setTeam(list[0])
        setSeason(latest)
        setManifest(manifest)
      })
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <main><p className="error">Something went wrong: {error}</p></main>
  if (!manifest) return <main><p className="muted">Loading data engine and play-by-play…</p></main>

  const info = manifest.seasons.find((s) => s.season === season)
  const years = manifest.seasons.map((s) => s.season)
  const short = (y) => `'${String(y).slice(2)}`
  const baselineLabel = baseline === 'all'
    ? `NFL ${short(Math.min(...years))}–${short(Math.max(...years))}`
    : `NFL ${short(season)}`
  const scrimmage = view === 'off' || view === 'def'
  const nFilters = activeCount(filters)

  return (
    <main>
      <header>
        <h1>{team} {VIEWS.find((v) => v.id === view).label}</h1>
        <p className="muted">
          {season} regular season · through week {Math.min(info?.max_week ?? 18, 18)} ·
          data updated {new Date(manifest.built_at).toLocaleDateString()}
        </p>
      </header>

      <div className="pickers">
        <label>
          Season
          <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label>
          Team
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {teams.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <Segmented options={VIEWS} value={view} onChange={setView} />

      <div className="row">
        <span className="muted small-label">Compare to</span>
        <Segmented
          small
          options={[
            { id: 'season', label: `${season} only` },
            { id: 'all', label: `All seasons` },
          ]}
          value={baseline}
          onChange={setBaseline}
        />
      </div>

      {scrimmage && (
        <div className="filters">
          <div className="filters-head">
            <button className="disclosure" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? '▾' : '▸'} Filters{nFilters ? ` (${nFilters})` : ''}
            </button>
            {nFilters > 0 && <button className="link" onClick={() => setFilters(emptyFilters())}>Reset</button>}
          </div>
          {showFilters && FILTER_GROUPS.map((g) => {
            const disabled = g.needsPersonnel && !info?.has_personnel
            return (
              <div className="filter-group" key={g.key}>
                <div className="filter-label">
                  {g.label}
                  {disabled && <span className="muted"> · not yet available for {season}</span>}
                </div>
                <Chips
                  options={g.options}
                  value={filters[g.key]}
                  disabled={disabled}
                  onChange={(v) => setFilters({ ...filters, [g.key]: v })}
                />
              </div>
            )
          })}
        </div>
      )}

      {scrimmage && (
        <Scrimmage
          season={season}
          team={team}
          side={view}
          baseline={baseline}
          baselineLabel={baselineLabel}
          filters={info?.has_personnel ? filters : { ...filters, personnel: null }}
          hasPersonnel={info?.has_personnel}
        />
      )}
      {view === 'st' && <SpecialTeams season={season} team={team} baseline={baseline} baselineLabel={baselineLabel} />}
      {view === 'pen' && <Penalties season={season} team={team} baseline={baseline} baselineLabel={baselineLabel} />}
    </main>
  )
}
