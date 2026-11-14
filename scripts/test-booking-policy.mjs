import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
import {rescheduleReason} from '../lib/booking-dates.js'
const sample={status:'confirmed',arrival:'2026-11-14',reschedule_count:0}
assert.equal(rescheduleReason(sample,'2026-11-11',3),'')
assert.ok(rescheduleReason(sample,'2026-11-11',4))
assert.equal(rescheduleReason({...sample,arrival:'2026-11-11'},'2026-11-11',0),'')
assert.ok(rescheduleReason({...sample,arrival:'2026-11-10'},'2026-11-11',0))
assert.ok(rescheduleReason({...sample,reschedule_count:3},'2026-11-11',0))
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
const base='http://127.0.0.1:3001',id=randomBytes(10).toString('hex').toUpperCase(),phone='07'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),code='TEST-P-'+id.slice(0,6)
const [[original]]=await db.query('SELECT reschedule_notice_days,reschedule_limit FROM settings WHERE id=1')
const expiry=String(Date.now()+120000),cookie='trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const tomorrow=new Date(Date.parse(today)+86400000).toISOString().slice(0,10)
async function call(body){const r=await fetch(base+'/api/camp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
try {
 const html=await(await fetch(base+'/admin?section=settings&group=policy',{headers:{Cookie:cookie}})).text()
 const form=html.match(/<form\b[\s\S]*?<\/form>/g)?.find(s=>s.includes('name="noticeDays"'));assert.ok(form)
 const action=form.match(/name="(\$ACTION_ID_[^"]+)"/)[1]
 async function set(value,auth=true){const body=new FormData();body.set(action,'');body.set('noticeDays',value);body.set('rescheduleLimit','3');return fetch(base+'/admin',{method:'POST',headers:{Origin:base,...(auth?{Cookie:cookie}:{})},body,redirect:'manual'})}
 await set('0',false)
 let [[row]]=await db.query('SELECT reschedule_notice_days FROM settings WHERE id=1');assert.equal(row.reschedule_notice_days,original.reschedule_notice_days)
 for(const bad of ['','-1','1.5','366','abc']){const r=await set(bad);assert.match(r.headers.get('location'),/error=invalid/)}
 assert.equal((await set('3')).status,303)
 await db.execute("INSERT INTO inventory (code,kind,zone,name,detail,price,stock) VALUES (?,'gear','GEAR','Policy test','',10,1)",[code])
 await db.execute("INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status) VALUES (?,?,?,'Policy test',?,?,?,1,0,0,10,'confirmed')",[id,randomUUID(),'0'.repeat(64),phone,today,tomorrow])
 await db.execute("INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,'Policy test',1,10)",[id,code])
 const request={id,phone,arrival:tomorrow,departure:new Date(Date.parse(today)+2*86400000).toISOString().slice(0,10),plotChanges:[],revision:0}
 let found=await call({action:'lookup',id,phone});assert.equal(found.data.reschedule_notice_days,3);assert.ok(found.data.reschedule_block)
 assert.equal((await call({...request,action:'quoteAmendment'})).status,409)
 await set('0')
 found=await call({action:'lookup',id,phone});assert.equal(found.data.reschedule_notice_days,0);assert.equal(found.data.reschedule_block,'')
 const quote=await call({...request,action:'quoteAmendment'});assert.equal(quote.status,200,JSON.stringify(quote))
 // A stale quote cannot bypass a newly tightened policy.
 await set('3')
 assert.equal((await call({...request,action:'amendBooking'})).status,409)
 await db.execute('UPDATE bookings SET arrival=?,departure=? WHERE id=?',[new Date(Date.parse(today)+10*86400000).toISOString().slice(0,10),new Date(Date.parse(today)+11*86400000).toISOString().slice(0,10),id])
 assert.equal((await call({...request,action:'quoteAmendment'})).status,409)
 console.log('Policy admin authorization, validation, persistence, lookup, same-day rules and stale-quote enforcement passed.')
} finally {
 await db.execute('UPDATE settings SET reschedule_notice_days=?,reschedule_limit=? WHERE id=1',[original.reschedule_notice_days,original.reschedule_limit])
 await db.execute('DELETE FROM booking_lines WHERE booking=?',[id])
 await db.execute('DELETE FROM bookings WHERE id=?',[id])
 await db.execute('DELETE FROM inventory WHERE code=?',[code])
 await db.execute('DELETE FROM booking_phone_guards WHERE phone=?',[phone])
 await db.end()
}
