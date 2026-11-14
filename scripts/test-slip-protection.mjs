import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHash,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
const base='http://127.0.0.1:3001'
const ids=[],phones=[],hashes=[]
const code='TEST-DUP-'+randomBytes(4).toString('hex').toUpperCase()
const token=randomBytes(32).toString('hex')
const phone='09'+String(Math.floor(Math.random()*1e8)).padStart(8,'0')
phones.push(phone)
const file=()=>{const bytes=Buffer.from('%PDF-1.4\nTEST '+randomBytes(32).toString('hex'));hashes.push(createHash('sha256').update(bytes).digest('hex'));return bytes}
async function booking(number=phone) {
 const id=randomBytes(10).toString('hex').toUpperCase();ids.push(id)
 await db.execute(`INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total) VALUES (?,?,?,'Duplicate protection test',?,'2099-01-01','2099-01-02',1,0,0,10)`,[id,randomUUID(),'0'.repeat(64),number])
 await db.execute('INSERT INTO booking_payments (booking,token_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))',[id,createHash('sha256').update(token).digest('hex')])
 await db.execute("INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,'Test',1,10)",[id,code])
 await db.execute("INSERT INTO allocations (code,night,booking,quantity) VALUES (?,'2099-01-01',?,1)",[code,id])
 return id
}
async function submit(id,bytes,auth=token) {
 const body=new FormData();body.set('slip',new Blob([bytes],{type:'application/pdf'}),'test.pdf')
 const response=await fetch(base+'/api/payment?id='+id,{method:'POST',headers:{Authorization:'Bearer '+auth},body})
 return {status:response.status,data:await response.json()}
}
async function guard() {const [[row]]=await db.execute('SELECT * FROM booking_phone_guards WHERE phone=?',[phone]);return row}
try {
 const [[existing]]=await db.execute('SELECT 1 FROM booking_phone_guards WHERE phone=?',[phone]);assert.ok(!existing)
 await db.execute("INSERT INTO inventory (code,kind,zone,name,detail,price,stock) VALUES (?,'gear','GEAR','Duplicate test','',10,100)",[code])
 const bytes=file(),original=await booking()
 assert.equal((await submit(original,bytes,'f'.repeat(64))).status,404)
 assert.equal((await submit(original,bytes)).data.status,'pending')
 assert.equal((await submit(original,bytes)).data.status,'pending')
 assert.equal(Number((await guard()).duplicate_count),0)
 for(let i=1;i<=4;i++) {
  const id=await booking(i%2?'+66'+phone.slice(1):phone)
  const responses=await Promise.all([submit(id,bytes),submit(id,bytes)])
  for(const response of responses) {assert.equal(response.status,200,JSON.stringify(response));assert.equal(response.data.status,'cancelled');assert.equal(response.data.duplicateRejected,true)}
  assert.equal(Number((await guard()).duplicate_count),i)
  assert.equal(Boolean((await guard()).blocked_at),i===4)
  const [[row]]=await db.execute('SELECT COUNT(*) AS n FROM allocations WHERE booking=?',[id]);assert.equal(Number(row.n),0)
 }
 const blocked=await booking()
 assert.equal((await submit(blocked,file())).status,403)
 const reserve=await fetch(base+'/api/camp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({arrival:'2099-01-01',departure:'2099-01-02',guest:'Test',phone:'+66'+phone.slice(1),adults:1,children:0,seniors:0,items:[{code,quantity:1}],requestKey:randomUUID(),paymentToken:token,expectedTotal:10})})
 assert.equal(reserve.status,403,await reserve.text())
 // Exercise the real protected admin form, including an unauthenticated replay.
 const expiry=String(Date.now()+60000),signature=createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
 const cookie='trunkhill_admin='+expiry+'.'+signature
 const html=await (await fetch(base+'/admin?section=blockedPhones&q='+phone,{headers:{Cookie:cookie}})).text()
 const form=html.match(/<form\b[\s\S]*?<\/form>/g).find(value=>value.includes('name="blockedAt"'))
 assert.ok(form,'Unlock form is rendered')
 const action=form.match(/name="(\$ACTION_ID_[^"]+)"/)[1]
 const formData=new FormData();formData.set(action,'');formData.set('phone',phone);formData.set('blockedAt',(await guard()).blocked_at)
 await fetch(base+'/admin',{method:'POST',body:formData,headers:{Origin:base},redirect:'manual'})
 assert.ok((await guard()).blocked_at,'Anonymous unlock rejected')
 const unlock=await fetch(base+'/admin',{method:'POST',body:formData,headers:{Origin:base,Cookie:cookie},redirect:'manual'})
 assert.equal(unlock.status,303)
 assert.equal((await guard()).blocked_at,null);assert.equal(Number((await guard()).duplicate_count),0)
 assert.equal((await submit(blocked,file())).data.status,'pending')
 const reused=await booking();assert.equal((await submit(reused,bytes)).data.duplicateRejected,true)
 assert.equal(Number((await guard()).duplicate_count),1)
 // Different phones race to claim the same new file: exactly one must pass.
 const other='08'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');phones.push(other)
 const a=await booking(),b=await booking(other),raceFile=file()
 const race=await Promise.all([submit(a,raceFile),submit(b,raceFile)])
 assert.equal(race.filter(r=>r.data.status==='pending').length,1)
 assert.equal(race.filter(r=>r.data.duplicateRejected).length,1)
 console.log('Duplicate refusal, stock release, retry idempotency, fourth-strike block, phone normalization, admin authorization/unlock and concurrent hash claims passed.')
} finally {
 for(const id of ids) {await db.execute('DELETE FROM allocations WHERE booking=?',[id]);await db.execute('DELETE FROM booking_lines WHERE booking=?',[id]);await db.execute('DELETE FROM bookings WHERE id=?',[id])}
 for(const hash of hashes) await db.execute('DELETE FROM payment_file_claims WHERE file_hash=?',[hash])
 for(const p of phones) await db.execute('DELETE FROM booking_phone_guards WHERE phone=?',[p])
 await db.execute('DELETE FROM inventory WHERE code=?',[code]);await db.end()
}
