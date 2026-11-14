import {randomBytes,randomUUID} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL})
try {
 if(process.argv[2]==='cleanup') {
  const id=process.argv[3]
  const [[row]]=await db.execute("SELECT id FROM bookings WHERE id=? AND phone='0700000099' AND guest LIKE 'UI edit test%'",[id])
  if(!row)throw new Error('Fixture not found')
  await db.execute('DELETE FROM allocations WHERE booking=?',[id])
  await db.execute('DELETE FROM booking_rentals WHERE booking=?',[id])
  await db.execute('DELETE FROM booking_lines WHERE booking=?',[id])
  await db.execute('DELETE FROM bookings WHERE id=?',[id])
  console.log('Fixture removed')
 } else {
  const [[plot]]=await db.query("SELECT code,name FROM inventory WHERE kind='plot' AND active=TRUE AND zone='A' ORDER BY code LIMIT 1")
  const [[gear]]=await db.query("SELECT code,name FROM inventory WHERE kind='gear' AND active=TRUE AND stock>1 ORDER BY code LIMIT 1")
  const id=randomBytes(10).toString('hex').toUpperCase(),day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10)
  await db.execute("INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status) VALUES (?,?,?,'UI edit test','0700000099',?,?,2,0,0,100,'confirmed')",[id,randomUUID(),'0'.repeat(64),day(400),day(401)])
  await db.execute('INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,?,1,50),(?,?,?,1,50)',[id,plot.code,plot.name,id,gear.code,gear.name])
  await db.execute('INSERT INTO booking_rentals (booking,host,code,quantity) VALUES (?,?,?,1)',[id,plot.code,gear.code])
  console.log(JSON.stringify({id,phone:'0700000099',plot:plot.code,gear:gear.code}))
 }
}finally{await db.end()}
