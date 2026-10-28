// Situational filters for the Offense/Defense views. Every option maps to a
// fixed SQL snippet, so user input never reaches the query text directly.
//
// `side` is 'off' or 'def'. Score and win probability in nflverse are from
// the offense's point of view, so they are flipped for the defense view so
// "Leading" always means the team you picked is ahead.

const diff = (side) => (side === 'def' ? '(-score_differential)' : 'score_differential')
const wp = (side) => (side === 'def' ? '(1 - wp)' : 'wp')

export const FILTER_GROUPS = [
  {
    key: 'down',
    label: 'Down',
    options: [
      { id: '1', label: '1st', sql: () => 'down = 1' },
      { id: '2', label: '2nd', sql: () => 'down = 2' },
      { id: '3', label: '3rd', sql: () => 'down = 3' },
      { id: '4', label: '4th', sql: () => 'down = 4' },
    ],
  },
  {
    key: 'dist',
    label: 'Distance',
    options: [
      { id: 'short', label: '1-2', sql: () => 'ydstogo <= 2' },
      { id: 'med', label: '3-6', sql: () => 'ydstogo BETWEEN 3 AND 6' },
      { id: 'long', label: '7-10', sql: () => 'ydstogo BETWEEN 7 AND 10' },
      { id: 'xlong', label: '11+', sql: () => 'ydstogo >= 11' },
    ],
  },
  {
    key: 'field',
    label: 'Field position',
    options: [
      { id: 'own20', label: 'Own 1-20', sql: () => 'yardline_100 >= 80' },
      { id: 'own50', label: 'Own 21-50', sql: () => 'yardline_100 BETWEEN 50 AND 79' },
      { id: 'opp', label: 'Opp 49-21', sql: () => 'yardline_100 BETWEEN 21 AND 49' },
      { id: 'rz', label: 'Red zone', sql: () => 'yardline_100 <= 20' },
      { id: 'gtg', label: 'Goal to go', sql: () => 'goal_to_go = 1' },
    ],
  },
  {
    key: 'qtr',
    label: 'Quarter',
    options: [
      { id: '1', label: 'Q1', sql: () => 'qtr = 1' },
      { id: '2', label: 'Q2', sql: () => 'qtr = 2' },
      { id: '3', label: 'Q3', sql: () => 'qtr = 3' },
      { id: '4', label: 'Q4', sql: () => 'qtr = 4' },
      { id: 'ot', label: 'OT', sql: () => 'qtr >= 5' },
      { id: '2min', label: 'Last 2:00 of half', sql: () => 'half_seconds_remaining <= 120' },
    ],
  },
  {
    key: 'score',
    label: 'Score',
    options: [
      { id: 'trail9', label: 'Down 9+', sql: (s) => `${diff(s)} <= -9` },
      { id: 'trail1', label: 'Down 1-8', sql: (s) => `${diff(s)} BETWEEN -8 AND -1` },
      { id: 'tied', label: 'Tied', sql: (s) => `${diff(s)} = 0` },
      { id: 'lead1', label: 'Up 1-8', sql: (s) => `${diff(s)} BETWEEN 1 AND 8` },
      { id: 'lead9', label: 'Up 9+', sql: (s) => `${diff(s)} >= 9` },
    ],
  },
  {
    key: 'wp',
    label: 'Win probability',
    options: [
      { id: 'neutral', label: 'Neutral (20-80%)', sql: (s) => `${wp(s)} BETWEEN 0.2 AND 0.8` },
      { id: 'ahead', label: 'Comfortably ahead (>80%)', sql: (s) => `${wp(s)} > 0.8` },
      { id: 'behind', label: 'Well behind (<20%)', sql: (s) => `${wp(s)} < 0.2` },
    ],
  },
  {
    key: 'formation',
    label: 'Formation',
    options: [
      { id: 'gun', label: 'Shotgun', sql: () => 'shotgun = 1' },
      { id: 'uc', label: 'Under center', sql: () => 'shotgun = 0' },
      { id: 'nohuddle', label: 'No huddle', sql: () => 'no_huddle = 1' },
    ],
  },
  {
    key: 'personnel',
    label: 'Personnel',
    needsPersonnel: true,
    options: ['11', '12', '13', '21', '22', '10'].map((p) => ({
      id: p,
      label: p,
      sql: () => `personnel = '${p}'`,
    })).concat([
      { id: 'other', label: 'Other', sql: () => "personnel NOT IN ('11','12','13','21','22','10')" },
    ]),
  },
]

export const emptyFilters = () => Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, null]))

export function activeCount(filters) {
  return Object.values(filters).filter(Boolean).length
}

export function filterSql(filters, side) {
  const parts = []
  for (const g of FILTER_GROUPS) {
    const opt = g.options.find((o) => o.id === filters[g.key])
    if (opt) parts.push(`(${opt.sql(side)})`)
  }
  return parts
}

// Comparison baseline: same season, or every loaded season.
export function baselineSql(baseline, season) {
  return baseline === 'all' ? 'TRUE' : `season = ${Number(season)}`
}
