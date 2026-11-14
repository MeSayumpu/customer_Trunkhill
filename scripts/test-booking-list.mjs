import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
const base='http://127.0.0.1:3001',prefix='LIST-'+randomBytes(4).toString('hex'),ids=[]
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
const expiry=String(Date.now()+120000),cookie='trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
const headers={Cookie:cookie}
async function html(params={}) {const r=await fetch(base+'/admin?'+new URLSearchParams({section:'bookings',q:prefix,...params}),{headers});assert.equal(r.status,200);return r.text()}
// React may stream table rows into additional hidden table segments.
const rowIds=s=>[...s.matchAll(/<code>([A-F0-9]{20})<\/code>/g)].map(m=>m[1])
try {
  for(const [suffix,kind,zone] of [['P','plot','A'],['G','gear','GEAR']]) await db.execute('INSERT INTO inventory (code,kind,zone,name,detail,price,stock,active) VALUES (?,?,?,?,?,100,1,0)',[prefix+suffix,kind,zone,prefix+suffix,'Test'])
  for(let i=0;i<25;i++) {
    const id=randomBytes(10).toString('hex').toUpperCase();ids.push(id)
    await db.execute(`INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status,created_at) VALUES (?,?,?,?,?,'2027-06-01','2027-06-02',1,0,0,?,?,?)`,[id,randomUUID(),'0'.repeat(64),prefix+String(i).padStart(2,'0'),'0801234567',100+i,i<10?'confirmed':i<15?'pending':'cancelled','2026-01-01 12:00:'+String(i).padStart(2,'0')])
    await db.execute('INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,?,1,?)',[id,prefix+(i%2?'G':'P'),prefix+' item',100+i])
    if(i>=10&&i<15) await db.execute('INSERT INTO booking_payments (booking,token_hash,expires_at,submitted_at) VALUES (?,?,?,?)',[id,'0'.repeat(64),i===12?'2020-01-01':'2099-01-01',i<12?'2026-01-01 12:00:00':null])
  }
  let page=await html();assert.equal(rowIds(page).length,20);assert.equal(rowIds(page)[0],ids[24])
  assert.equal(rowIds(await html({page:'2'})).length,5)
  assert.equal(rowIds(await html({size:'50'})).length,25)
  assert.equal(rowIds(await html({size:'999999'})).length,20)
  assert.equal(rowIds(await html({sort:'oldest'}))[0],ids[0])
  assert.equal(rowIds(await html({sort:'total'}))[0],ids[24])
  assert.equal(rowIds(await html({status:'review'})).length,2)
  assert.equal(rowIds(await html({status:'pending'})).length,4)
  assert.equal(rowIds(await html({status:'cancelled'})).length,11)
  assert.equal(rowIds(await html({kind:'lodging'})).length,13)
  assert.equal(rowIds(await html({kind:'rental'})).length,12)
  assert.equal(rowIds(await html({from:'2027-06-02'})).length,0)
  assert.equal(rowIds(await html({q:ids[0].slice(0,12)}))[0],ids[0])
  assert.ok((await html({expand:'all'})).includes('booking-expanded-grid'))
  assert.ok((await html({view:ids[24]})).includes('รายละเอียดการจอง'))
  assert.equal((await fetch(base+'/admin/bookings-export')).status,403)
  let response=await fetch(base+'/admin/bookings-export?'+new URLSearchParams({q:prefix,status:'confirmed'}),{headers})
  assert.equal(response.status,200);assert.equal((await response.text()).trim().split('\r\n').length,11)
  response=await fetch(base+'/admin/bookings-export?'+new URLSearchParams({q:prefix}),{headers})
  assert.equal((await response.text()).trim().split('\r\n').length,26)
  console.log('PASS: pagination, size limits, sort, ID-prefix search, dates, kinds, expired/pending/review status, expansion, details and authorized filtered CSV.')
} finally {
  for(const id of ids) {await db.execute('DELETE FROM booking_lines WHERE booking=?',[id]);await db.execute('DELETE FROM bookings WHERE id=?',[id])}
  await db.execute('DELETE FROM inventory WHERE code IN (?,?)',[prefix+'P',prefix+'G'])
  await db.end()
}
