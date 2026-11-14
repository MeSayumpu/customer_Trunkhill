import assert from 'node:assert/strict'
import {randomBytes,createHmac,createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {createConnection} from 'mysql2/promise'
const base=process.env.TEST_BASE_URL||'http://localhost:3004'
assert.equal(new URL(process.env.DATABASE_URL).hostname,'127.0.0.1')
const db=await createConnection(process.env.DATABASE_URL),tag='S'+randomBytes(4).toString('hex').toUpperCase(),code=tag+'-GEAR'
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
const assets=[],bookings=[],phones=[],hashes=[]
try{
 await db.execute("INSERT INTO zone_details(zone,description,rules) VALUES (?,'','')",[tag])
 await db.execute("INSERT INTO inventory(code,kind,zone,name,detail,price,stock) VALUES (?,'gear','GEAR',?,'',100,10)",[code,code])
 const context=await browser.newContext(),expiry=String(Date.now()+600000)
 await context.addCookies([{name:'trunkhill_admin',value:expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex'),domain:new URL(base).hostname,path:'/admin'}])
 const page=await context.newPage();page.setDefaultTimeout(300000)
 page.on('pageerror',e=>console.error('Browser:',e.message))
 page.on('response',async r=>{if((r.url().includes('/api/uploads')||r.url().includes('/admin/uploads'))&&r.request().method()==='POST'){try{const data=await r.json();if(data.id)assets.push(data.id);if(data.error)console.error(data.error)}catch{}}})
 const png=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZQAAAABJRU5ErkJggg==','base64'),Buffer.alloc(2*1024*1024)])
 await page.goto(base+'/admin?section=gear&q='+code+'&edit='+code,{waitUntil:'networkidle'})
 await page.locator('input[name=photo]').setInputFiles({name:'large.png',mimeType:'image/png',buffer:png})
 await page.getByRole('dialog').getByRole('button',{name:'บันทึก',exact:true}).click()
 await page.waitForURL(/saved=inventory/)
 const [[photo]]=await db.execute('SELECT photo FROM inventory_photos WHERE code=?',[code]);assert.ok(photo);assets.push(photo.photo.toString().slice(9))
 const downloaded=await context.request.get(base+'/admin/inventory-photo/'+code);assert.deepEqual(await downloaded.body(),png)
 await page.goto(base+'/admin?section=zoneMedia&zone='+tag,{waitUntil:'networkidle'})
 const video=Buffer.alloc(13*1024*1024,0);video.write('ftyp',4)
 await page.locator('input[accept="video/mp4,video/webm"]').setInputFiles({name:'large.mp4',mimeType:'video/mp4',buffer:video})
 await page.getByRole('button',{name:'เพิ่มวิดีโอ',exact:true}).click();await page.waitForURL(/saved=zoneMedia/)
 const [[media]]=await db.execute('SELECT id,content FROM zone_media WHERE zone=?',[tag]);assert.ok(media);assets.push(media.content.toString().slice(9))
 const range=await context.request.get(base+'/api/zone-media/'+media.id,{headers:{Range:'bytes=1048570-1048590'}});assert.equal(range.status(),206);assert.deepEqual(await range.body(),video.subarray(1048570,1048591))
 assert.equal(await page.locator('video[src="/api/zone-media/'+media.id+'"]').getAttribute('preload'),'none')
 // Payment uploads use the booking token, never an admin-only endpoint.
 async function paymentUpload(id,token,bytes){
  const url=base+'/api/uploads?booking='+id,headers={Origin:base,Authorization:'Bearer '+token}
  const start=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({bytes:bytes.length})});assert.equal(start.status,200,await start.clone().text());const session=await start.json();assets.push(session.id)
  for(let offset=0,part=0;offset<bytes.length;offset+=session.chunkBytes,part++){const response=await fetch(url+'&id='+session.id+'&part='+part,{method:'PUT',headers,body:bytes.subarray(offset,offset+session.chunkBytes)});assert.equal(response.status,200)}
  const end=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:session.id})});assert.equal(end.status,200);return (await end.json()).value
 }
 const pdf=Buffer.concat([Buffer.from('%PDF-1.4\n'+randomUUID()),Buffer.alloc(6*1024*1024)])
 hashes.push(createHash('sha256').update(pdf).digest('hex'))
 for(let n=0;n<2;n++){
  const id=randomBytes(10).toString('hex').toUpperCase(),token=randomBytes(32).toString('hex'),phone='08'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');bookings.push(id);phones.push(phone)
  await db.execute("INSERT INTO bookings(id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total) VALUES (?,?,?,'Storage test',?,'2099-01-01','2099-01-02',1,0,0,100)",[id,randomUUID(),'0'.repeat(64),phone])
  await db.execute('INSERT INTO booking_payments(booking,token_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))',[id,createHash('sha256').update(token).digest('hex')])
  await db.execute("INSERT INTO booking_lines(booking,code,name,quantity,amount) VALUES (?,?,'Test',1,100)",[id,code])
  const marker=await paymentUpload(id,token,pdf),body=new FormData();body.set('slip',marker)
  const response=await fetch(base+'/api/payment?id='+id,{method:'POST',headers:{Authorization:'Bearer '+token},body});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.status,n?'cancelled':'pending');if(n)assert.ok(result.duplicateRejected)
  const slip=await context.request.get(base+'/admin/slip/'+id);assert.deepEqual(await slip.body(),pdf)
  assert.equal((await fetch(base+'/admin/slip/'+id)).status,404)
 }
 console.log('PASS: real admin form uploads >750 KB and >12 MB, video ranges/lazy preload, customer PDF >5 MB, duplicate slip protection, private slip access.')
}finally{
 await browser.close()
 for(const id of bookings){await db.execute('DELETE FROM duplicate_slip_events WHERE booking=?',[id]);await db.execute('DELETE FROM payment_file_claims WHERE booking=?',[id]);await db.execute('DELETE FROM booking_lines WHERE booking=?',[id]);await db.execute('DELETE FROM bookings WHERE id=?',[id])}
 for(const phone of phones)await db.execute('DELETE FROM booking_phone_guards WHERE phone=?',[phone])
 await db.execute('DELETE FROM inventory WHERE code=?',[code]);await db.execute('DELETE FROM zone_details WHERE zone=?',[tag])
 for(const id of assets)await db.execute('DELETE FROM storage_assets WHERE id=?',[id])
 await db.end()
}
