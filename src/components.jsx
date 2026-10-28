import { useEffect, useState } from 'react'
import { query } from './db.js'

export const pct = (v, d = 1) => (v == null ? '–' : `${(v * 100).toFixed(d)}%`)
export const signed = (v, d = 3) => (v == null ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}`)
export const num = (v, d = 1) => (v == null ? '–' : v.toFixed(d))

export function Tile({ label, value, league, leagueLabel }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {league != null && <div className="tile-league">{leagueLabel} {league}</div>}
    </div>
  )
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`segmented${small ? ' small' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Single-select chip row; tapping the selected chip clears it.
export function Chips({ options, value, onChange, disabled }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          disabled={disabled}
          className={value === o.id ? 'chip on' : 'chip'}
          onClick={() => onChange(value === o.id ? null : o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Horizontal bar list. rows: [{ label, value (0-1 share), right, sub }]
export function Bars({ rows }) {
  const max = Math.max(...rows.map((r) => r.value ?? 0), 0.0001)
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div className="bar-label">{r.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${((r.value ?? 0) / max) * 100}%` }} />
          </div>
          <div className="bar-right">
            {r.right}
            {r.sub && <span className="bar-sub">{r.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Section({ title, note, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
      {note && <p className="muted small">{note}</p>}
    </section>
  )
}

// Most recent plays matching `where`, newest first, with "show more".
export function PlayList({ where, title = 'Plays' }) {
  const [limit, setLimit] = useState(25)
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => setLimit(25), [where])

  useEffect(() => {
    if (!open) return
    query(`
      SELECT week, posteam, defteam, qtr, time, down, ydstogo, "desc", epa
      FROM pbp WHERE ${where}
      ORDER BY game_id DESC, play_id DESC
      LIMIT ${limit}`).then(setRows)
  }, [where, limit, open])

  return (
    <section className="section">
      <button className="disclosure" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && rows && (
        <ul className="plays">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="play-meta">
                Wk {r.week} · {r.posteam} vs {r.defteam} · Q{r.qtr} {r.time}
                {r.down ? ` · ${r.down}&${r.ydstogo}` : ''}
                {r.epa != null && <span className={r.epa >= 0 ? 'pos' : 'neg'}> EPA {signed(r.epa, 2)}</span>}
              </div>
              <div className="play-desc">{r.desc}</div>
            </li>
          ))}
          {rows.length === limit && (
            <li><button className="more" onClick={() => setLimit(limit + 50)}>Show more</button></li>
          )}
          {rows.length === 0 && <li className="muted">No plays match.</li>}
        </ul>
      )}
    </section>
  )
}
