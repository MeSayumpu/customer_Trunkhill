// What does the app feel like after years of bookings? Works on the LOCAL database and dev server only.
//   node --env-file=.env.local scripts/simulate-history.mjs --measure            time the customer and admin pages
//   node --env-file=.env.local scripts/simulate-history.mjs --fill [years] [n]   add n bookings a day for the past years (default 10, 16)
//   node --env-file=.env.local scripts/simulate-history.mjs --cleanup            delete everything --fill added
// Every row it adds belongs to a booking whose guest starts with SIM-HISTORY and whose phone starts with 0888.
// The admin pages are opened with a session signed from ADMIN_SESSION_SECRET, the way the other test scripts do.
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createConnection } from 'mysql2/promise'

const base = process.env.TEST_BASE || 'http://127.0.0.1:3001'
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(base)) throw new Error('this tool is for a local server only')
const db = await createConnection({ uri:process.env.DATABASE_URL, dateStrings:true, multipleStatements:false })
const day = (from, add) => new Date(Date.parse(from) + add * 864e5).toISOString().slice(0,10)
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())
const hex = bytes => randomBytes(bytes).toString('hex')
const pick = list => list[Math.floor(Math.random() * list.length)]
const count = async table => Number((await db.query(`SELECT COUNT(*) AS n FROM ${table}`))[0][0].n)

async function sizes() {
  const rows = {}
  for (const table of ['bookings','booking_lines','allocations','booking_payments','booking_references','booking_checkins','booking_checkouts']) rows[table] = await count(table)
  const [[{mb}]] = await db.query("SELECT ROUND(SUM(data_length+index_length)/1048576,1) AS mb FROM information_schema.tables WHERE table_schema=DATABASE()")
  return { ...rows, databaseMB:Number(mb) }
}

async function cleanup() {
  const mine = "b.guest LIKE 'SIM-HISTORY%' AND b.phone LIKE '0888%'"
  for (const table of ['allocations','booking_checkins','booking_checkouts','booking_lines']) {
    await db.query(`DELETE t FROM ${table} t JOIN bookings b ON b.id=t.booking WHERE ${mine}`)
  }
  const [result] = await db.query(`DELETE b FROM bookings b WHERE ${mine}`)   // payments and references go with it
  return result.affectedRows
}

async function fill(years, perDay) {
  const [inventory] = await db.query("SELECT code,kind,price,stock FROM inventory WHERE active=1")
  const plots = inventory.filter(row => row.kind === 'plot' && row.code !== 'WHOLE-CAMP').map(row => row.code)
  const rooms = inventory.filter(row => row.kind === 'room').map(row => row.code)
  const gear = inventory.filter(row => row.kind === 'gear' && row.stock >= 3)
  const first = day(today,-Math.round(years * 365.25)), last = day(today,-2)
  const taken = new Map()            // night → Set of codes held
  const gearHeld = new Map()         // night|code → quantity
  const references = new Map()
  const batch = { bookings:[], references:[], lines:[], allocations:[], payments:[], checkins:[], checkouts:[] }
  let made = 0
  const flush = async () => {
    if (!batch.bookings.length) return
    await db.beginTransaction()
    await db.query('INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,tent_discount,status,created_at) VALUES ?',[batch.bookings])
    await db.query('INSERT INTO booking_references (booking,reference) VALUES ?',[batch.references])
    await db.query('INSERT INTO booking_lines (booking,code,name,quantity,amount,room_adults,room_seniors,room_children) VALUES ?',[batch.lines])
    if (batch.allocations.length) await db.query('INSERT INTO allocations (code,night,booking,quantity) VALUES ?',[batch.allocations])
    await db.query('INSERT INTO booking_payments (booking,token_hash,expires_at,submitted_at,mime) VALUES ?',[batch.payments])
    if (batch.checkins.length) await db.query('INSERT INTO booking_checkins (booking,booked_adults,booked_children,booked_seniors,note,added_amount,checked_in_at) VALUES ?',[batch.checkins])
    if (batch.checkouts.length) await db.query('INSERT INTO booking_checkouts (booking,units_milli,electricity_rate,free_units_per_guest,electricity_amount,damage_amount,other_amount,lodging_charges,note,version,completed_at,free_guests) VALUES ?',[batch.checkouts])
    await db.commit()
    for (const list of Object.values(batch)) list.length = 0
  }
  for (let arrival = first; arrival <= last; arrival = day(arrival,1)) {
    // Weekends are busier, like a real camp.
    const weekday = new Date(arrival).getUTCDay(), wanted = Math.round(perDay * (weekday === 5 || weekday === 6 ? 1.6 : 0.75))
    for (let n = 0; n < wanted; n++) {
      const nights = Math.random() < 0.2 ? 2 : 1, stay = Array.from({length:nights},(_, i) => day(arrival,i))
      const free = code => stay.every(night => !taken.get(night)?.has(code))
      const open = plots.filter(free), room = Math.random() < 0.08 ? rooms.find(free) : null
      const cancelled = Math.random() < 0.1
      const sites = [...(open.length ? [pick(open)] : []), ...(open.length > 1 && Math.random() < 0.3 ? [pick(open)] : [])].filter((code, i, list) => list.indexOf(code) === i)
      if (!sites.length && !room) continue
      const id = hex(10).toUpperCase(), adults = 1 + Math.floor(Math.random() * 4), children = Math.random() < 0.3 ? 1 : 0
      const lines = sites.map(code => [id,code,code,1,200 * nights,null,null,null])
      if (room) lines.push([id,room,room,1,1500 * nights,2,0,0])
      const extra = Math.random() < 0.15 ? pick(gear) : null
      if (extra && stay.every(night => (gearHeld.get(night + '|' + extra.code) || 0) < extra.stock)) lines.push([id,extra.code,extra.code,1,extra.price * nights,null,null,null])
      const total = lines.reduce((sum, line) => sum + line[4],0)
      const created = new Date(Date.parse(arrival) - (1 + Math.floor(Math.random() * 30)) * 864e5 + Math.floor(Math.random() * 8e7))
      const stamp = date => date.toISOString().slice(0,19).replace('T',' ')
      const stem = arrival.slice(8,10) + arrival.slice(5,7) + arrival.slice(2,4) + (sites[0] || 'TB1'), seq = (references.get(stem) || 0) + 1
      references.set(stem,seq)
      batch.bookings.push([id,randomUUID(),hex(32),`SIM-HISTORY Guest ${++made}`,'0888' + String(made % 1e6).padStart(6,'0'),arrival,day(arrival,nights),adults + (room ? 2 : 0),children,0,total,0,cancelled ? 'cancelled' : 'confirmed',stamp(created)])
      batch.references.push([id,'S' + stem + (seq > 1 ? '-' + String(seq).padStart(2,'0') : '')])
      batch.lines.push(...lines)
      batch.payments.push([id,hex(32),stamp(new Date(+created + 3e5)),stamp(new Date(+created + 12e4)),'image/png'])
      if (!cancelled) {
        for (const line of lines) for (const night of stay) {
          batch.allocations.push([line[1],night,id,1])
          if (line[1] === extra?.code) gearHeld.set(night + '|' + extra.code,(gearHeld.get(night + '|' + extra.code) || 0) + 1)
          else { if (!taken.has(night)) taken.set(night,new Set()); taken.get(night).add(line[1]) }
        }
        batch.checkins.push([id,adults + (room ? 2 : 0),children,0,'',0,arrival + ' 07:00:00'])
        const units = 2000 + Math.floor(Math.random() * 8) * 1000, charge = Math.max(0,units - adults * 1000)
        batch.checkouts.push([id,units,1000,1000,charge,0,0,null,'',1,day(arrival,nights) + ' 04:00:00',adults])
      }
      if (batch.bookings.length >= 2000) await flush()
    }
  }
  await flush()
  return made
}

const admin = () => { const expiry = String(Date.now() + 3600000)
  return { Cookie:'trunkhill_admin=' + expiry + '.' + createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex') } }
async function timed(name, request, expect) {
  const times = []
  let status, size, found
  for (let i = 0; i < 4; i++) {
    const start = performance.now(), response = await request(), text = await response.text()
    times.push(performance.now() - start); status = response.status; size = text.length; found = !expect || expect.test(text)
  }
  times.shift()                       // the first run may include compiling the page in dev mode
  times.sort((a,b) => a - b)
  console.log(`  ${name.padEnd(46)} ${String(status).padEnd(4)} ${String(Math.round(times[1])).padStart(6)} ms  ${String(Math.round(size / 1024)).padStart(5)} KB${found ? '' : '   <-- expected content missing'}`)
}
async function measure() {
  const get = (path, headers = {}) => () => fetch(base + path,{ headers })
  const [[old]] = await db.query("SELECT id,phone FROM bookings WHERE status='confirmed' ORDER BY arrival LIMIT 1")
  const [[sample]] = await db.query("SELECT guest,phone FROM bookings ORDER BY created_at DESC LIMIT 1")
  const far = day(today,14)
  console.log('customer')
  await timed('booking page /',get('/'))
  await timed('catalog for a night (api/camp)',get(`/api/camp?arrival=${far}&departure=${day(far,1)}`),/"inventory"/)
  await timed('catalog for a 7-night stay',get(`/api/camp?arrival=${far}&departure=${day(far,7)}`),/"inventory"/)
  await timed('camp options',get('/api/camp-options'))
  await timed('booking lookup by code + phone',() => fetch(base + '/api/camp',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'lookup',id:old.id,phone:old.phone}) }))
  await timed('booking lookup page /booking',get('/booking'))
  console.log('admin')
  const page = (path, expect) => timed(path,get(path,admin()),expect ?? /admin-content|admin-dashboard/)
  await page('/admin?section=dashboard',/dashboard-metrics/)
  await page('/admin?section=dashboard&from=2015-01-01&to=2027-12-31',/dashboard-metrics/)
  await page(`/admin?section=dashboard&day=${today}&mode=month`,/dashboard-metrics/)
  await page('/admin?section=bookings')
  await page('/admin?section=bookings&from=2015-01-01&to=2027-12-31&size=100')
  await page('/admin?section=bookings&from=2015-01-01&to=2027-12-31&size=100&page=200')
  await page('/admin?section=bookings&from=2015-01-01&to=2027-12-31&q=' + encodeURIComponent(sample.guest))
  await page('/admin?section=bookings&from=2015-01-01&to=2027-12-31&q=' + sample.phone)
  await page('/admin?section=bookings&from=2015-01-01&to=2027-12-31&status=cancelled')
  await page('/admin?section=checkin')
  await page('/admin?section=checkin&status=all')
  await page('/admin?section=checkout')
  await page('/admin?section=checkout&status=done')
  await page('/admin?section=checkout&status=all&q=' + encodeURIComponent(sample.guest))
  await page('/admin?section=plots')
  await page('/admin?section=gear')
  await timed('/admin/checkout-export?status=done (Excel, everything)',get('/admin/checkout-export?status=done',admin()))
}

try {
  if (process.argv.includes('--cleanup')) console.log('deleted', await cleanup(), 'simulated bookings')
  else if (process.argv.includes('--fill')) {
    const at = process.argv.indexOf('--fill'), years = Number(process.argv[at + 1]) || 10, perDay = Number(process.argv[at + 2]) || 16
    const start = Date.now()
    console.log(`added ${await fill(years,perDay)} bookings over ${years} years in ${Math.round((Date.now() - start) / 1000)} s`)
  } else if (process.argv.includes('--measure')) await measure()
  console.log(await sizes())
} finally {
  await db.end()
}
