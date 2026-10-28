// DuckDB running inside the browser. Each season is a gzipped Arrow file that
// the browser unzips and loads into one in-memory table, `pbp`.
import * as duckdb from '@duckdb/duckdb-wasm'
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

const BUNDLES = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
}

const dataUrl = (file) => `${import.meta.env.BASE_URL}data/${file}`

async function fetchSeason(file) {
  const res = await fetch(dataUrl(file))
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  // Some hosts send .gz files with Content-Encoding: gzip, so the browser has
  // already unzipped them. Only unzip if the gzip magic bytes are still there.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
  const unzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(unzipped).arrayBuffer())
}

let connPromise

async function init() {
  const manifestRes = fetch(dataUrl('manifest.json'), { cache: 'no-cache' })
  const bundle = await duckdb.selectBundle(BUNDLES)
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(bundle.mainWorker))
  await db.instantiate(bundle.mainModule)
  const conn = await db.connect()

  const manifest = await (await manifestRes).json()
  const buffers = await Promise.all(manifest.seasons.map((s) => fetchSeason(s.file)))
  for (const [i, buf] of buffers.entries()) {
    await conn.insertArrowFromIPCStream(buf, { name: 'pbp', create: i === 0 })
  }
  return { conn, manifest }
}

export function getDb() {
  connPromise ??= init()
  return connPromise
}

// Run SQL and return plain JS objects (BigInt counts converted to numbers).
export async function query(sql) {
  const { conn } = await getDb()
  const result = await conn.query(sql)
  return result.toArray().map((row) => {
    const obj = row.toJSON()
    for (const k in obj) if (typeof obj[k] === 'bigint') obj[k] = Number(obj[k])
    return obj
  })
}
