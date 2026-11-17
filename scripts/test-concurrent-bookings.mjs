// Load and race test for the customer booking flow, against a running server and its database.
//   node --env-file=.env.local scripts/test-concurrent-bookings.mjs            run every phase, then delete what it made
//   node --env-file=.env.local scripts/test-concurrent-bookings.mjs --keep     also leave three paid bookings for tonight
//                                                                              (to walk through approve / check-in / check-out)
//   node --env-file=.env.local scripts/test-concurrent-bookings.mjs --cleanup  delete everything earlier runs left behind
//   node scripts/test-concurrent-bookings.mjs --remote [--keep]                 a hosted server whose database cannot be reached:
//                                                                              the same races, checked through the site's own
//                                                                              answers; nothing is deleted (clean up with SQL)
// TEST_BASE (default http://127.0.0.1:3001) is the server; TEST_NIGHT (default: 8 days from today) is the first of the three
// empty nights it books. Every booking it makes has a guest name starting with LOADTEST and a phone starting with 0999.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import zlib from 'node:zlib'
import { createConnection } from 'mysql2/promise'
import { stayPricing } from '../lib/pricing.js'

const base = process.env.TEST_BASE || 'http://127.0.0.1:3001'
const remote = process.argv.includes('--remote')
const db = remote ? null : await createConnection({ uri:process.env.DATABASE_URL, dateStrings:true })
const day = (from, add) => new Date(Date.parse(from) + add * 864e5).toISOString().slice(0,10)
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())
const firstNight = process.env.TEST_NIGHT || day(today,8)
const run = randomBytes(3).toString('hex')
let serial = 0
const results = []
const check = (name, ok, detail = '') => { results.push({name,ok,detail}); console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : '')) }

async function cleanup() {
  if (remote) return 0
  const [rows] = await db.query("SELECT id FROM bookings WHERE guest LIKE 'LOADTEST%' AND phone LIKE '0999%'")
  const ids = rows.map(row => row.id)
  if (ids.length) {
    for (const table of ['allocations','booking_checkin_items','booking_checkins','booking_checkouts','booking_rentals','booking_lines','payment_file_claims']) {
      await db.query(`DELETE FROM ${table} WHERE booking IN (?)`,[ids])
    }
    await db.query('DELETE FROM bookings WHERE id IN (?)',[ids])
  }
  await db.query("DELETE FROM booking_phone_guards WHERE phone LIKE '0999%'")
  return ids.length
}

if (process.argv.includes('--cleanup')) {
  console.log(remote ? 'a remote run is cleaned up with SQL, not from here' : 'deleted ' + await cleanup() + ' test bookings')
  await db?.end()
  process.exit(0)
}

const catalogOf = async night => (await fetch(`${base}/api/camp?arrival=${night}&departure=${day(night,1)}`)).json()

// One customer: a unique phone and payment token, the total worked out the way the booking page does it.
function customer(catalog, night, { items, adults = 1, seniors = 0, children = 0, rentalLines, wholeCamp } = {}) {
  const token = randomBytes(32).toString('hex')
  const rows = items.map(item => ({ ...catalog.inventory.find(row => row.code === item.code), quantity:item.quantity, ...(item.guests ? { guests:item.guests } : {}) }))
  const tier = wholeCamp ? catalog.wholeCampTiers.find(row => adults <= row.maxGuests) : null
  const total = stayPricing(rows,catalog.settings,adults,catalog.rates,tier ? catalog.wholeCampPrices[tier.maxGuests] : null,seniors).total
  const payload = {
    adults, children, seniors, arrival:night, departure:day(night,1), guest:`LOADTEST ${run} #${++serial}`,
    phone:'0999' + String(Math.floor(Math.random() * 1e6)).padStart(6,'0'), items, expectedTotal:total,
    ...(tier ? { expectedWholeCampFreeUnits:tier.freeUnits } : {}), ...(rentalLines ? { rentalLines } : {}),
    requestKey:randomUUID(), paymentToken:token,
  }
  return { payload, token, total }
}
async function reserve(person, body = person.payload) {
  const response = await fetch(base + '/api/camp',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  return { ...person, status:response.status, data, id:data.id }
}
const statuses = list => Object.entries(list.reduce((map, row) => (map[row.status] = (map[row.status] || 0) + 1, map),{})).map(([k,v]) => `${k}×${v}`).join(' ')

// A real PNG whose text chunk makes every file different (the server fingerprints slips to catch reused ones).
function slipFile(label = randomUUID()) {
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type),data]), size = Buffer.alloc(4), crc = Buffer.alloc(4)
    size.writeUInt32BE(data.length); crc.writeUInt32BE(zlib.crc32(body)); return Buffer.concat([size,body,crc]) }
  const header = Buffer.from([0,0,0,1, 0,0,0,1, 8,2,0,0,0])
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('Comment\0' + label)),
    chunk('IDAT',zlib.deflateSync(Buffer.from([0,255,255,255]))),chunk('IEND',Buffer.alloc(0))])
}
// The upload API only answers requests that come from its own pages, so the test sends the same Origin a browser would.
const auth = person => ({ Authorization:'Bearer ' + person.token, Origin:base })
async function uploadSlip(person, bytes) {
  const url = `${base}/api/uploads?booking=${person.id}`
  const session = await (await fetch(url,{ method:'POST', headers:{ ...auth(person),'Content-Type':'application/json' }, body:JSON.stringify({bytes:bytes.length}) })).json()
  await fetch(`${url}&id=${session.id}&part=0`,{ method:'PUT', headers:auth(person), body:bytes })
  return (await (await fetch(url,{ method:'POST', headers:{ ...auth(person),'Content-Type':'application/json' }, body:JSON.stringify({id:session.id}) })).json()).value
}
async function pay(person, bytes = slipFile()) {
  const form = new FormData()
  form.append('slip',await uploadSlip(person,bytes))
  const response = await fetch(`${base}/api/payment?id=${person.id}`,{ method:'POST', headers:auth(person), body:form })
  return { status:response.status, data:await response.json().catch(() => ({})) }
}
const cancel = async person => { const response = await fetch(`${base}/api/payment?id=${person.id}`,{ method:'DELETE', headers:auth(person) })
  return { status:response.status, data:await response.json().catch(() => ({})) } }
// How many of each item are held on a night: from the database, or on a remote run from what the site still offers.
const held = async (night, codes) => {
  if (remote) { const inventory = (await catalogOf(night)).inventory
    return new Map(codes.map(code => { const row = inventory.find(item => item.code === code); return [code,Number(row.stock) - Number(row.available)] })) }
  const [rows] = await db.query('SELECT code,SUM(quantity) AS n FROM allocations WHERE night=? AND code IN (?) GROUP BY code',[night,codes])
  return new Map(rows.map(row => [row.code,Number(row.n)])) }
const paymentOf = async person => { const response = await fetch(`${base}/api/payment?id=${person.id}`,{ headers:auth(person) })
  return { status:response.status, data:await response.json().catch(() => ({})) } }
const mine = async () => { const [[row]] = await db.query('SELECT COUNT(*) AS n FROM bookings WHERE guest LIKE ?',[`LOADTEST ${run} %`]); return Number(row.n) }

// Whole-database rules that must hold no matter what the phases above did.
async function invariants(label) {
  if (remote) return console.log('  (database rules are checked with SQL on a remote run)')
  const count = async sql => Number((await db.query(sql))[0][0].n)
  check(`${label}: nothing is held beyond its stock`,await count(`SELECT COUNT(*) AS n FROM (SELECT a.code FROM allocations a JOIN inventory i ON i.code=a.code
    JOIN bookings b ON b.id=a.booking WHERE b.guest LIKE 'LOADTEST%' OR a.night>='${firstNight}' GROUP BY a.code,a.night,i.stock HAVING SUM(a.quantity)>i.stock) x`) === 0)
  check(`${label}: every held night belongs to a booking line`,await count(`SELECT COUNT(*) AS n FROM allocations a LEFT JOIN booking_lines l ON l.booking=a.booking AND l.code=a.code WHERE l.code IS NULL`) === 0)
  check(`${label}: cancelled test bookings hold nothing`,await count(`SELECT COUNT(*) AS n FROM allocations a JOIN bookings b ON b.id=a.booking WHERE b.status='cancelled' AND b.guest LIKE 'LOADTEST%'`) === 0)
  check(`${label}: every live test booking holds each line on each night`,await count(`SELECT COUNT(*) AS n FROM booking_lines l JOIN bookings b ON b.id=l.booking
    WHERE b.guest LIKE 'LOADTEST%' AND b.status<>'cancelled' AND (SELECT COALESCE(SUM(a.quantity),0) FROM allocations a WHERE a.booking=l.booking AND a.code=l.code)<>l.quantity*DATEDIFF(b.departure,b.arrival)`) === 0)
  check(`${label}: every test booking's total equals its lines less the tent discount`,await count(`SELECT COUNT(*) AS n FROM bookings b
    WHERE b.guest LIKE 'LOADTEST%' AND b.total<>(SELECT COALESCE(SUM(l.amount),0) FROM booking_lines l WHERE l.booking=b.id)-b.tent_discount`) === 0)
  check(`${label}: a whole-camp night holds nothing else`,await count(`SELECT COUNT(*) AS n FROM allocations a WHERE a.code<>'WHOLE-CAMP'
    AND EXISTS(SELECT 1 FROM allocations w WHERE w.code='WHOLE-CAMP' AND w.night=a.night)`) === 0)
  check(`${label}: every test booking has exactly one payment row`,await count(`SELECT COUNT(*) AS n FROM bookings b WHERE b.guest LIKE 'LOADTEST%'
    AND (SELECT COUNT(*) FROM booking_payments p WHERE p.booking=b.id)<>1`) === 0)
}

try {
  const leftover = await cleanup()
  if (leftover) console.log('removed', leftover, 'bookings left by an earlier run')
  const nights = [firstNight,day(firstNight,1),day(firstNight,2)]
  if (remote) for (const night of nights) assert.ok((await catalogOf(night)).inventory.every(row => row.kind === 'gear' ? Number(row.available) === Number(row.stock) : !row.active || Number(row.available) > 0),
    `night ${night} must be empty — set TEST_NIGHT to three free nights`)
  else { const [[busy]] = await db.query('SELECT COUNT(*) AS n FROM allocations WHERE night IN (?)',[nights])
    assert.equal(Number(busy.n),0,`nights ${nights.join(', ')} must be empty — set TEST_NIGHT to three free nights`) }
  const catalog = await catalogOf(nights[0])
  const plots = catalog.inventory.filter(row => row.kind === 'plot' && row.code !== 'WHOLE-CAMP' && row.active && Number(row.available) > 0).map(row => row.code)
  const gear = catalog.inventory.filter(row => row.kind === 'gear' && !row.is_tent && row.active && Number(row.stock) > 0).sort((a,b) => a.stock - b.stock)[0]
  assert.ok(plots.length >= 10 && gear,'needs at least 10 open plots and one rental item')
  console.log(`server ${base} · nights ${nights.join(', ')} · ${plots.length} plots · scarce item ${gear.code} (stock ${gear.stock})`)

  console.log('\nA. 100 customers at once: each wants one plot, a third also want the scarce item')
  const crowd = Array.from({length:100},(_, index) => customer(catalog,nights[0],{
    items:[{code:plots[index % plots.length],quantity:1},...(index % 3 === 0 ? [{code:gear.code,quantity:1}] : [])] }))
  const startedA = Date.now()
  const doneA = await Promise.all(crowd.map(person => reserve(person)))
  console.log(`  ${statuses(doneA)} in ${Date.now() - startedA} ms`)
  const won = doneA.filter(row => row.status === 200)
  check('only "booked" (200) or "not available" (409) answers',doneA.every(row => row.status === 200 || row.status === 409),statuses(doneA))
  const winnersPerPlot = new Map()
  for (const row of won) winnersPerPlot.set(row.payload.items[0].code,(winnersPerPlot.get(row.payload.items[0].code) || 0) + 1)
  check('no plot went to two customers',[...winnersPerPlot.values()].every(n => n === 1),`${winnersPerPlot.size} plots booked`)
  const gearWon = won.filter(row => row.payload.items.length > 1).length
  check(`the scarce item was not oversold`,gearWon <= Number(gear.stock),`${gearWon} of ${gear.stock}`)
  const heldA = await held(nights[0],[...plots,gear.code])
  check('the database holds exactly what the winners booked',plots.every(code => (heldA.get(code) || 0) === (winnersPerPlot.get(code) || 0)) && (heldA.get(gear.code) || 0) === gearWon)
  if (!remote) check('refused requests left no booking behind',await mine() === won.length,`${won.length} bookings`)
  check('a refusal names what was not available',doneA.filter(row => row.status === 409).every(row => Array.isArray(row.data.unavailable) && row.data.unavailable.length > 0))

  console.log('\nB. The same request sent five times at once (double taps, retries)')
  const twoNights = await catalogOf(nights[1])
  const repeat = customer(twoNights,nights[1],{ items:[{code:plots[0],quantity:1}] })
  const doneB = await Promise.all(Array.from({length:5},() => reserve(repeat)))
  check('all five answers are the same booking',doneB.every(row => row.status === 200 && row.id === doneB[0].id),statuses(doneB))
  if (remote) check('the plot is held once',(await held(nights[1],[plots[0]])).get(plots[0]) === 1)
  else { const [[sameKey]] = await db.query('SELECT COUNT(*) AS n FROM bookings WHERE request_key=?',[repeat.payload.requestKey])
    check('only one booking was stored',Number(sameKey.n) === 1) }
  const reused = await reserve(repeat,{ ...repeat.payload, guest:repeat.payload.guest + ' changed' })
  check('reusing the request key with other details is refused',reused.status === 409,String(reused.status))

  console.log('\nC. 40 customers whose baskets overlap in every direction (two plots each, plus one room for some)')
  const ring = plots.slice(1,9)
  const baskets = Array.from({length:40},(_, index) => customer(twoNights,nights[1],{ adults:2,
    items:[{code:ring[index % ring.length],quantity:1},{code:ring[(index * 3 + 1) % ring.length === index % ring.length ? (index + 2) % ring.length : (index * 3 + 1) % ring.length],quantity:1}] }))
  const doneC = await Promise.all(baskets.map(person => reserve(person)))
  console.log('  ' + statuses(doneC))
  check('no server error or deadlock',doneC.every(row => row.status === 200 || row.status === 409),statuses(doneC))
  const heldC = await held(nights[1],ring)
  check('no plot is held twice',[...heldC.values()].every(n => n === 1))
  const wonC = doneC.filter(row => row.status === 200)
  check('all-or-nothing: each winner holds both of its plots, losers hold none',[...heldC.values()].reduce((a,b) => a + b,0) === wonC.length * 2,`${wonC.length} winners`)

  console.log('\nD. One group books the whole camp while 30 customers book single plots on the same night')
  const third = await catalogOf(nights[2])
  const group = customer(third,nights[2],{ items:[{code:'WHOLE-CAMP',quantity:1}], adults:10, wholeCamp:true })
  const singles = Array.from({length:30},(_, index) => customer(third,nights[2],{ items:[{code:plots[index % plots.length],quantity:1}] }))
  const doneD = await Promise.all([reserve(group),...singles.map(person => reserve(person))])
  const groupWon = doneD[0].status === 200, singlesWon = doneD.slice(1).filter(row => row.status === 200).length
  console.log(`  whole camp ${doneD[0].status} · single plots ${statuses(doneD.slice(1))}`)
  check('no server error',doneD.every(row => row.status === 200 || row.status === 409 || row.status === 400),statuses(doneD))
  check('the whole camp and single plots never share a night',groupWon ? singlesWon === 0 : singlesWon > 0,groupWon ? 'whole camp won' : `${singlesWon} plots won, whole camp refused`)

  console.log('\nE. Paying: slips sent at once, the same slip used twice, double submit, cancel racing a payment')
  const payers = won.slice(0,20)
  const paid = await Promise.all(payers.map(person => pay(person)))
  check('20 different slips are all accepted',paid.every(row => row.status === 200 && row.data.submitted && row.data.status === 'pending'),statuses(paid))
  const shared = slipFile('shared-' + run), [first, second] = won.slice(20,22)
  const sharedResults = await Promise.all([pay(first,shared),pay(second,shared)])
  const rejected = sharedResults.filter(row => row.data.duplicateRejected).length
  check('one slip used by two bookings: one accepted, the other refused and cancelled',rejected === 1 && sharedResults.filter(row => row.data.status === 'cancelled').length === 1,
    sharedResults.map(row => row.data.status + (row.data.duplicateRejected ? ' (duplicate)' : '')).join(' / '))
  const tapper = won[22], tapSlip = slipFile()
  const taps = await Promise.all([pay(tapper,tapSlip),pay(tapper,tapSlip),pay(tapper,tapSlip)])
  check('the same customer submitting three times is not treated as a duplicate',taps.every(row => row.status === 200 && row.data.status === 'pending' && !row.data.duplicateRejected),statuses(taps))
  const racers = won.slice(23,33)
  const races = await Promise.all(racers.flatMap(person => [pay(person),cancel(person)]))
  // A cancelled unpaid booking is deleted outright, so the losing payment may find nothing (404) or a closed upload (409).
  check('cancel racing a payment never errors',races.every(row => [200,404,409].includes(row.status)),statuses(races))
  if (remote) {
    const ends = await Promise.all(racers.map(paymentOf))
    const survivors = racers.filter((person, index) => ends[index].status === 200 && ends[index].data.status === 'pending' && ends[index].data.submitted)
    const stillHeld = await held(nights[0],racers.map(person => person.payload.items[0].code))
    check('each raced booking ended either removed with nothing held, or paid and still held',
      ends.every(row => row.status === 404 || (row.status === 200 && row.data.submitted)) &&
      racers.every(person => (stillHeld.get(person.payload.items[0].code) || 0) === (survivors.includes(person) ? 1 : 0)),
      `${racers.length - survivors.length} removed, ${survivors.length} paid`)
  } else {
  const [raceRows] = await db.query(`SELECT b.status,p.submitted_at IS NOT NULL AS submitted,(SELECT COUNT(*) FROM allocations a WHERE a.booking=b.id) AS held
    FROM bookings b JOIN booking_payments p ON p.booking=b.id WHERE b.id IN (?)`,[racers.map(person => person.id)])
  const [[raceHeld]] = await db.query('SELECT COUNT(*) AS n FROM allocations a LEFT JOIN bookings b ON b.id=a.booking WHERE a.booking IN (?) AND b.id IS NULL',[racers.map(person => person.id)])
  check('each raced booking ended either removed with nothing held, or paid and still held',Number(raceHeld.n) === 0 && raceRows.every(row =>
    row.status === 'cancelled' ? Number(row.held) === 0 : row.status === 'pending' && Number(row.submitted) === 1 && Number(row.held) > 0),
    `${racers.length - raceRows.length} removed, ${raceRows.filter(row => row.status === 'cancelled').length} cancelled, ${raceRows.filter(row => row.status === 'pending').length} paid`)
  }
  const freed = second && sharedResults[1].data.status === 'cancelled' ? second : first
  const again = await reserve(customer(catalog,nights[0],{ items:[{code:freed.payload.items[0].code,quantity:1}] }))
  check('a plot released by a refused slip can be booked again',again.status === 200,String(again.status))

  if (remote) console.log('\nF. Payment time runs out — skipped on a remote run (it needs the clock moved in the database)')
  else {
  console.log('\nF. Payment time runs out')
  const late = won.slice(33,36)
  await db.query('UPDATE booking_payments SET expires_at=UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE booking IN (?)',[late.map(person => person.id)])
  const afterTime = await pay(late[0])
  check('a slip sent after the time ran out is refused',afterTime.status === 409 || afterTime.status === 404,String(afterTime.status))
  await catalogOf(nights[0])
  const retake = await reserve(customer(catalog,nights[0],{ items:[{code:late[1].payload.items[0].code,quantity:1}] }))
  check('an unpaid booking past its time is removed and its plot can be booked',retake.status === 200,String(retake.status))
  const [[gone]] = await db.query('SELECT COUNT(*) AS n FROM bookings WHERE id IN (?)',[late.map(person => person.id)])
  check('the timed-out bookings are gone from the database',Number(gone.n) === 0,`${gone.n} left`)
  }

  await invariants('after all phases')

  if (process.argv.includes('--keep')) {
    console.log('\nG. Three paid bookings for tonight, kept for the approve / check-in / check-out walk-through')
    const tonight = await catalogOf(today)
    const open = tonight.inventory.filter(row => row.kind === 'plot' && row.code !== 'WHOLE-CAMP' && row.active && Number(row.available) > 0).map(row => row.code)
    const keepers = []
    for (const [index, items] of [[{code:open[0],quantity:1},{code:open[1],quantity:1}],[{code:open[2],quantity:1}],[{code:open[3],quantity:1}]].entries()) {
      const person = await reserve(customer(tonight,today,{ items, adults:index === 0 ? 3 : 1, seniors:index === 0 ? 1 : 0, children:index === 0 ? 1 : 0 }))
      if (person.status === 200) { await pay(person); keepers.push(person) }
    }
    console.log('  kept: ' + keepers.map(person => `${person.id} (${person.payload.items.map(item => item.code).join('+')}, ${person.payload.guest})`).join(' · '))
    const ids = keepers.map(person => person.id)
    if (!remote) {
    const [rows] = await db.query("SELECT id FROM bookings WHERE guest LIKE 'LOADTEST%' AND id NOT IN (?)",[ids.length ? ids : ['']])
    for (const table of ['allocations','booking_rentals','booking_lines','payment_file_claims']) if (rows.length) await db.query(`DELETE FROM ${table} WHERE booking IN (?)`,[rows.map(row => row.id)])
    if (rows.length) await db.query('DELETE FROM bookings WHERE id IN (?)',[rows.map(row => row.id)])
    }
  } else if (!remote) console.log('\ndeleted', await cleanup(), 'test bookings')
  if (remote) console.log('\nremote run: the LOADTEST bookings stay on the server until they are deleted with SQL')
} catch (error) {
  console.error('\nstopped:',error.message)
  results.push({name:'run completed',ok:false,detail:error.message})
  if (!process.argv.includes('--keep')) await cleanup().catch(() => {})
} finally {
  await db?.end()
}
const failed = results.filter(row => !row.ok)
console.log(`\n${results.length - failed.length} of ${results.length} checks passed` + (failed.length ? ' — FAILED: ' + failed.map(row => row.name).join('; ') : ''))
process.exitCode = failed.length ? 1 : 0
