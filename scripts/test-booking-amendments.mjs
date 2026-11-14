import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
const base='http://127.0.0.1:3001',id=randomBytes(10).toString('hex').toUpperCase(),phone='07'+String(Math.floor(Math.random()*1e8)).padStart(8,'0')
const a='TEST-EA-'+id.slice(0,6),b='TEST-EB-'+id.slice(0,6)
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10)
async function call(body) {const response=await fetch(base+'/api/camp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()}}
let proposal={id,phone,guest:'Amendment test',arrival:day(30),departure:day(31),adults:1,children:0,seniors:0,items:[{code:a,quantity:1}],rentalLines:[],revision:0}
const quote=extra=>call({...proposal,...extra,action:'quoteAmendment'})
const save=(q,extra)=>call({...proposal,...extra,action:'amendBooking',expectedTotal:q.total,expectedFreeUnits:q.freeUnits})
try {
 await db.query("INSERT INTO inventory (code,kind,zone,name,detail,price,stock) VALUES ?",[[[a,'gear','GEAR','Test old','',10,5],[b,'gear','GEAR','Test new','',30,5]]])
 await db.execute(`INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status) VALUES (?,?,?,'Amendment test',?,?,?,1,0,0,10,'confirmed')`,[id,randomUUID(),'0'.repeat(64),phone,proposal.arrival,proposal.departure])
 await db.execute("INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,'Test old',1,10)",[id,a])
 await db.execute('INSERT INTO allocations (code,night,booking,quantity) VALUES (?,?,?,1)',[a,proposal.arrival,id])
 assert.equal((await quote({phone:'0000000000'})).status,404)
 assert.equal((await quote()).status,400)
 const found=await call({action:'lookup',id,phone});assert.equal(found.data.phone,phone);assert.ok(found.data.created_at)
 const ownCatalog=await call({action:'editCatalog',id,phone,arrival:proposal.arrival,departure:proposal.departure})
 assert.equal(Number(ownCatalog.data.inventory.find(i=>i.code===a).available),5)
 assert.equal((await quote({items:[{code:b,quantity:6}]})).status,409)
 proposal={...proposal,guest:'New name',adults:2,items:[{code:b,quantity:2}]}
 let q=await quote();assert.equal(q.status,200,JSON.stringify(q));assert.equal(q.data.total,60);assert.equal(q.data.difference,50)
 assert.equal((await call({...proposal,action:'amendBooking',expectedTotal:1,expectedFreeUnits:null})).status,409)
 let updated=await save(q.data);assert.equal(updated.status,200,JSON.stringify(updated));assert.equal(updated.data.reschedule_count,1);assert.equal(updated.data.adjustmentDue,50)
 assert.equal((await save(q.data)).data.reschedule_count,1)
 const [[oldStock]]=await db.execute('SELECT COUNT(*) AS n FROM allocations WHERE booking=? AND code=?',[id,a]);assert.equal(Number(oldStock.n),0)
 proposal={...proposal,revision:1,arrival:day(32),departure:day(33),items:[{code:a,quantity:1}]}
 q=await quote();assert.equal(q.data.difference,-50)
 updated=await save(q.data);assert.equal(updated.data.reschedule_count,2);assert.equal(updated.data.adjustmentDue,0)
 const [[moved]]=await db.execute('SELECT code,night FROM allocations WHERE booking=?',[id]);assert.equal(moved.code,a);assert.equal(moved.night,proposal.arrival)
 // Name-only change does not silently adopt a newly changed catalog price.
 await db.execute('UPDATE inventory SET price=99 WHERE code=?',[a])
 proposal={...proposal,revision:2,guest:'Final name'}
 q=await quote();assert.equal(q.data.total,10);assert.equal(q.data.lines[0].amount,10)
 updated=await save(q.data);assert.equal(updated.data.reschedule_count,3)
 assert.equal((await quote({revision:3,guest:'Fourth'})).status,409)
 assert.equal((await call({...proposal,action:'reschedule'})).status,409)
 const [[row]]=await db.execute('SELECT status,total FROM bookings WHERE id=?',[id]);assert.equal(row.status,'confirmed');assert.equal(row.total,10)
 // Admin can settle the aggregate difference; anonymous users cannot.
 const expiry=String(Date.now()+60000),cookie='trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
 const html=await(await fetch(base+'/admin?section=adjustments&q='+id,{headers:{Cookie:cookie}})).text()
 const form=html.match(/<form\b[\s\S]*?<\/form>/g)?.find(s=>s.includes('name="due"'));assert.ok(form)
 const action=form.match(/name="(\$ACTION_ID_[^"]+)"/)[1],body=new FormData()
 body.set(action,'');body.set('id',id);body.set('revision','3');body.set('due','0')
 await fetch(base+'/admin',{method:'POST',headers:{Origin:base},body,redirect:'manual'})
 let [[pending]]=await db.execute('SELECT COUNT(*) AS n FROM booking_amendments WHERE booking=? AND settled_at IS NULL',[id]);assert.equal(Number(pending.n),2)
 const settled=await fetch(base+'/admin',{method:'POST',headers:{Origin:base,Cookie:cookie},body,redirect:'manual'});assert.equal(settled.status,303)
 ;[[pending]]=await db.execute('SELECT COUNT(*) AS n FROM booking_amendments WHERE booking=? AND settled_at IS NULL',[id]);assert.equal(Number(pending.n),0)
 console.log('Full edits: quote/price checks, stock transfer, charge/refund ledger, name-only price, shared limit, replay, old API rejection and admin settlement authorization passed.')
} finally {
 await db.execute('DELETE FROM allocations WHERE booking=?',[id]);await db.execute('DELETE FROM booking_rentals WHERE booking=?',[id]);await db.execute('DELETE FROM booking_lines WHERE booking=?',[id]);await db.execute('DELETE FROM bookings WHERE id=?',[id]);await db.execute('DELETE FROM inventory WHERE code IN (?,?)',[a,b]);await db.execute('DELETE FROM booking_phone_guards WHERE phone=?',[phone]);await db.end()
}
