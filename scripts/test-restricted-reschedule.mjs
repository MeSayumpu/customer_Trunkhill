import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
import {rescheduleReason} from '../lib/booking-dates.js'
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
const [[originalPolicy]]=await db.query('SELECT reschedule_notice_days,reschedule_limit FROM settings WHERE id=1')
const base='http://127.0.0.1:3001',id=randomBytes(10).toString('hex').toUpperCase(),other=randomBytes(10).toString('hex').toUpperCase()
const phone='07'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),a='RS-A-'+id.slice(0,6),b='RS-B-'+id.slice(0,6),gear='RS-G-'+id.slice(0,6)
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date()),day=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10)
let period
async function call(body){const r=await fetch(base+'/api/camp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
const lookup=()=>call({action:'lookup',id,phone})
let request={id,phone,revision:0,arrival:day(100),departure:day(102),plotChanges:[{from:a,to:b}]}
const quote=extra=>call({...request,...extra,action:'quoteAmendment'}),save=extra=>call({...request,...extra,action:'amendBooking'})
try{
 await db.execute('UPDATE settings SET reschedule_notice_days=3,reschedule_limit=3 WHERE id=1')
 assert.equal(rescheduleReason({status:'pending',payment_submitted:true,reschedule_count:0,arrival:day(3)},today),'')
 assert.ok(rescheduleReason({status:'confirmed',reschedule_count:0,arrival:day(2)},today))
 await db.query('INSERT INTO inventory (code,kind,zone,name,detail,price,stock,active) VALUES ?',[[[a,'plot','A','Test old plot','',10,1,1],[b,'plot','A','Test new plot','',999,1,1],[gear,'gear','GEAR','Test tent','',500,2,1]]])
 for(const key of [id,other])await db.execute("INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status) VALUES (?,?,?,'Restricted test',?,?,?,2,1,0,321,?)",[key,randomUUID(),'0'.repeat(64),phone,day(90),day(92),key===id?'pending':'confirmed'])
 await db.execute('INSERT INTO booking_payments (booking,token_hash,expires_at,submitted_at) VALUES (?,?,UTC_TIMESTAMP()+INTERVAL 5 MINUTE,UTC_TIMESTAMP())',[id,'a'.repeat(64)])
 await db.query('INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES ?',[[[id,a,'Test old plot',1,21],[id,gear,'Test tent',2,300]]])
 await db.query('INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES ?',[[[other,b,'Occupied plot',1,10],[other,gear,'Occupied tent',1,10]]])
 await db.execute('INSERT INTO booking_rentals (booking,host,code,quantity) VALUES (?,?,?,2)',[id,a,gear])
 await db.query('INSERT INTO allocations (booking,code,night,quantity) VALUES ?',[[[id,a,day(90),1],[id,a,day(91),1],[id,gear,day(90),2],[id,gear,day(91),2]]])
 assert.equal((await lookup()).data.reschedule_block,'')
 assert.equal((await quote({phone:'0000000000'})).status,404)
 for(const extra of [{guest:'Hack'},{adults:99},{items:[]},{rentalLines:[]},{total:1}])assert.equal((await quote(extra)).status,400)
 assert.equal((await quote({departure:day(103)})).status,400)
 assert.equal((await quote({arrival:day(2),departure:day(4)})).status,409)
 assert.equal((await quote({plotChanges:[{from:gear,to:b}]})).status,400)
 // No submitted slip, cancelled and checked-out bookings cannot move.
 await db.execute('UPDATE booking_payments SET submitted_at=NULL WHERE booking=?',[id]);assert.equal((await quote()).status,409)
 await db.execute('UPDATE booking_payments SET submitted_at=UTC_TIMESTAMP() WHERE booking=?',[id])
 await db.execute("UPDATE bookings SET status='cancelled' WHERE id=?",[id]);assert.equal((await quote()).status,409)
 await db.execute("UPDATE bookings SET status='pending' WHERE id=?",[id])
 // Check each availability failure and leave the original booking untouched.
 await db.execute('INSERT INTO allocations (booking,code,night,quantity) VALUES (?,?,?,1)',[other,b,day(101)])
 assert.equal((await quote()).status,409)
 await db.execute('DELETE FROM allocations WHERE booking=?',[other])
 await db.execute('INSERT INTO allocations (booking,code,night,quantity) VALUES (?,?,?,1)',[other,gear,day(101)])
 const shortage=await quote();assert.equal(shortage.status,409);assert.match(JSON.stringify(shortage.data),/Test tent/)
 await db.execute('DELETE FROM allocations WHERE booking=?',[other])
 const [closed]=await db.execute("INSERT INTO camp_calendar (kind,label,start_date,end_date) VALUES ('closed','Restricted test',?,?)",[day(101),day(101)]);period=closed.insertId
 assert.equal((await quote()).status,409)
 await db.execute('DELETE FROM camp_calendar WHERE id=?',[period]);period=null
 assert.equal((await lookup()).data.reschedule_count,0)
 let q=await quote();assert.equal(q.status,200,JSON.stringify(q));assert.equal(q.data.total,321)
 // Inventory can change after preview: commit must check again.
 await db.execute('INSERT INTO allocations (booking,code,night,quantity) VALUES (?,?,?,1)',[other,gear,day(101)])
 assert.equal((await save()).status,409)
 await db.execute('DELETE FROM allocations WHERE booking=?',[other])
 const first=await save();assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.id,id);assert.equal(first.data.status,'pending');assert.equal(first.data.reschedule_count,1)
 assert.equal(first.data.total,321);assert.equal(first.data.guest,'Restricted test');assert.equal(first.data.adults,2);assert.equal(first.data.children,1)
 assert.equal(first.data.rentalLines[0].host_code,b);assert.equal(first.data.rentalLines[0].quantity,2);assert.equal(first.data.history.length,1)
 assert.equal((await save()).data.reschedule_count,1)
 const [[stock]]=await db.execute('SELECT COUNT(*) AS n FROM allocations WHERE booking=? AND night<?',[id,day(100)]);assert.equal(Number(stock.n),0)
 request={...request,revision:1,arrival:day(110),departure:day(112),plotChanges:[{from:b,to:a}]}
 assert.equal((await save()).data.reschedule_count,2)
 request={...request,revision:2,arrival:day(120),departure:day(122),plotChanges:[{from:a,to:b}]}
 const parallel=await Promise.all([save(),save()]);for(const result of parallel)assert.equal(result.data.reschedule_count,3,JSON.stringify(result))
 assert.equal((await save({revision:3,arrival:day(130),departure:day(132),plotChanges:[{from:b,to:a}]})).status,409)
 const final=(await lookup()).data;assert.equal(final.history.length,3)
 const expiry=String(Date.now()+60000),cookie='trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
 const html=await(await fetch(base+'/admin?section=bookings&q='+id+'&view='+id,{headers:{Cookie:cookie}})).text()
 assert.match(html,/ประวัติการเลื่อน/);assert.match(html,/จำนวนครั้งที่เลื่อน/)
 const policyHtml=await(await fetch(base+'/admin?section=settings&group=policy',{headers:{Cookie:cookie}})).text()
 const form=policyHtml.match(/<form\b[\s\S]*?<\/form>/g)?.find(s=>s.includes('name="rescheduleLimit"'));assert.ok(form)
 const action=form.match(/name="(\$ACTION_ID_[^"]+)"/)[1]
 async function setLimit(value,auth=true){const body=new FormData();body.set(action,'');body.set('noticeDays','3');body.set('rescheduleLimit',value);return fetch(base+'/admin',{method:'POST',headers:{Origin:base,...(auth?{Cookie:cookie}:{})},body,redirect:'manual'})}
 await setLimit('5',false);assert.equal((await lookup()).data.reschedule_limit,3)
 for(const bad of ['','-1','1.5','256','abc'])assert.match((await setLimit(bad)).headers.get('location'),/error=invalid/)
 await setLimit('5');assert.equal((await lookup()).data.reschedule_limit,5)
 request={...request,revision:3,arrival:day(130),departure:day(132),plotChanges:[{from:b,to:a}]}
 assert.equal((await quote()).status,200)
 await setLimit('2');assert.ok((await lookup()).data.reschedule_block);assert.equal((await save()).status,409)
 assert.equal((await lookup()).data.reschedule_count,3)
 await setLimit('5');assert.equal((await save()).data.reschedule_count,4)
 request={...request,revision:4,arrival:day(140),departure:day(142),plotChanges:[{from:a,to:b}]}
 await setLimit('0');assert.equal((await save()).status,409)
 await setLimit('5');assert.equal((await save()).data.reschedule_count,5)
 assert.equal((await lookup()).data.history.length,5)
 assert.equal((await save({revision:5,arrival:day(150),departure:day(152),plotChanges:[{from:b,to:a}]})).status,409)
 console.log('PASS: configurable quota, admin-only validation, increase beyond 3, reduction preserves counts, stale preview rejection, zero disables and fifth-move history.')
 console.log('PASS: pending slip, locked fields, fixed nights/price, closed dates, occupied plot, insufficient equipment, stale preview, original ID, rental mapping, history, admin UI, replay/concurrent quota and limit.')
}finally{
 await db.execute('UPDATE settings SET reschedule_notice_days=?,reschedule_limit=? WHERE id=1',[originalPolicy.reschedule_notice_days,originalPolicy.reschedule_limit])
 if(period)await db.execute('DELETE FROM camp_calendar WHERE id=?',[period])
 for(const key of [id,other]){
  await db.execute('DELETE FROM allocations WHERE booking=?',[key]);await db.execute('DELETE FROM booking_rentals WHERE booking=?',[key]);await db.execute('DELETE FROM booking_lines WHERE booking=?',[key]);await db.execute('DELETE FROM bookings WHERE id=?',[key])
 }
 await db.execute('DELETE FROM inventory WHERE code IN (?,?,?)',[a,b,gear]);await db.execute('DELETE FROM booking_phone_guards WHERE phone=?',[phone]);await db.end()
}
