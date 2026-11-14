import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {createConnection} from 'mysql2/promise'

const db = await createConnection(process.env.DATABASE_URL)
const id = randomBytes(10).toString('hex').toUpperCase()
const code = 'TEST-CANCEL-' + id.slice(0,8)
const token = randomBytes(32).toString('hex')
const url = 'http://127.0.0.1:3001/api/payment?id=' + id
const cancel = (auth=token) => fetch(url,{method:'DELETE',headers:{Authorization:'Bearer ' + auth}})
try {
  await db.execute("INSERT INTO inventory (code,kind,zone,name,detail,price,stock) VALUES (?,'gear','GEAR','Cancel test','',500,1)",[code])
  await db.execute(`INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total)
    VALUES (?,?,?,'Cancellation test','0000000000','2099-01-01','2099-01-02',1,0,0,500)`,[id,randomUUID(),'0'.repeat(64)])
  await db.execute('INSERT INTO booking_payments (booking,token_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))',[id,createHash('sha256').update(token).digest('hex')])
  await db.execute("INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,'Cancel test',1,500)",[id,code])
  await db.execute("INSERT INTO allocations (code,night,booking,quantity) VALUES (?,'2099-01-01',?,1)",[code,id])
  assert.equal((await cancel('f'.repeat(64))).status,404)
  await db.execute('UPDATE booking_payments SET submitted_at=UTC_TIMESTAMP() WHERE booking=?',[id])
  assert.equal((await cancel()).status,409)
  await db.execute('UPDATE booking_payments SET submitted_at=NULL WHERE booking=?',[id])
  await db.execute("UPDATE bookings SET status='confirmed' WHERE id=?",[id])
  assert.equal((await cancel()).status,409)
  await db.execute("UPDATE bookings SET status='pending' WHERE id=?",[id])
  const response = await cancel()
  assert.equal(response.status,200)
  assert.equal((await response.json()).status,'cancelled')
  const [[remaining]] = await db.execute('SELECT COUNT(*) AS n FROM allocations WHERE booking=?',[id])
  assert.equal(Number(remaining.n),0)
  assert.equal((await cancel()).status,200)
  console.log('Cancellation: authorization, paid/confirmed protection, stock release and retry passed.')
} finally {
  await db.execute('DELETE FROM allocations WHERE booking=?',[id])
  await db.execute('DELETE FROM booking_lines WHERE booking=?',[id])
  await db.execute('DELETE FROM bookings WHERE id=?',[id])
  await db.execute('DELETE FROM inventory WHERE code=?',[code])
  await db.end()
}
