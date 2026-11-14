import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
import {assignReference,referenceBase} from '../lib/booking-reference.js'
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
const ids=Array.from({length:3},()=>randomBytes(10).toString('hex').toUpperCase())
const code='QA-'+ids[0].slice(0,6),arrival='2030-12-30',phone='0700000096',base='http://127.0.0.1:3001'
assert.equal(referenceBase('2026-12-30','A01'),'301226A01')
const [[original]]=await db.query('SELECT welcome_title,welcome_subtitle,welcome_title_enabled,welcome_subtitle_enabled FROM settings WHERE id=1')
try{
 for(const id of ids)await db.execute("INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status) VALUES (?,?,?,'UI reference test',?,?,'2030-12-31',1,0,0,10,'pending')",[id,randomUUID(),'0'.repeat(64),phone,arrival])
 const refs=await Promise.all(ids.map(async id=>{const c=await createConnection(process.env.DATABASE_URL);try{await c.beginTransaction();const reference=await assignReference(c,id,arrival,code);await c.commit();return reference}finally{await c.end()}}))
 assert.equal(new Set(refs).size,3)
 assert.deepEqual([...refs].sort(),[referenceBase(arrival,code),referenceBase(arrival,code)+'-02',referenceBase(arrival,code)+'-03'].sort())
 await db.execute("UPDATE bookings SET arrival='2031-01-01',departure='2031-01-02' WHERE id=?",[ids[0]])
 assert.equal(await assignReference(db,ids[0],'2031-01-01','OTHER'),refs[0])
 async function lookup(id,number=phone){const r=await fetch(base+'/api/camp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'lookup',id,phone:number})});return {status:r.status,data:await r.json()}}
 assert.equal((await lookup(refs[0])).data.id,ids[0]);assert.equal((await lookup(ids[0])).data.reference,refs[0]);assert.notEqual((await lookup(refs[0],'0700000000')).status,200)
 const expiry=String(Date.now()+60000),cookie='trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
 const list=await(await fetch(base+'/admin?section=bookings&q='+refs[0],{headers:{Cookie:cookie}})).text();assert.ok(list.includes(refs[0]))
 const html=await(await fetch(base+'/admin?section=settings&group=welcome',{headers:{Cookie:cookie}})).text()
 const form=html.match(/<form\b[\s\S]*?<\/form>/g)?.find(s=>s.includes('name="titleEnabled"'));assert.ok(form)
 const action=form.match(/name="(\$ACTION_ID_[^"]+)"/)[1]
 async function save(auth){const body=new FormData();body.set(action,'');body.set('title','ทดสอบคำโปรย');body.set('subtitle','ข้อความรอง');body.set('subtitleEnabled','on');return fetch(base+'/admin',{method:'POST',headers:{Origin:base,...(auth?{Cookie:cookie}:{})},body,redirect:'manual'})}
 await save(false);assert.deepEqual((await db.query('SELECT welcome_title,welcome_subtitle,welcome_title_enabled,welcome_subtitle_enabled FROM settings WHERE id=1'))[0][0],original)
 assert.equal((await save(true)).status,303)
 const catalog=await(await fetch(base+'/api/camp')).json();assert.equal(catalog.settings.welcome_title_enabled,0);assert.equal(catalog.settings.welcome_subtitle_enabled,1);assert.equal(catalog.settings.welcome_title,'ทดสอบคำโปรย')
 console.log('PASS concurrent references, immutable code, old/new lookup, phone protection, admin search, authenticated welcome settings and independent visibility')
}finally{
 await db.execute('UPDATE settings SET welcome_title=?,welcome_subtitle=?,welcome_title_enabled=?,welcome_subtitle_enabled=? WHERE id=1',Object.values(original))
 for(const id of ids)await db.execute('DELETE FROM bookings WHERE id=?',[id])
 await db.execute('DELETE FROM booking_reference_counters WHERE base=?',[referenceBase(arrival,code)])
 await db.end()
}
