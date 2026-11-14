import assert from 'node:assert/strict'
import {createRequire,registerHooks} from 'node:module'
import {createHmac,randomUUID} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
registerHooks({resolve(s,c,next){try{return next(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.js'))return next(s+'.js',c);throw e}}})
const storage=await import('../lib/storage.js')
const {database,transaction}=await import('../lib/db.js')
assert.equal(new URL(process.env.DATABASE_URL).hostname,'127.0.0.1')
const base=process.env.TEST_BASE_URL||'http://localhost:3004'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname))
const db=await createConnection(process.env.DATABASE_URL)
const owner='test-'+randomUUID(),ids=[]
try{
 if(!process.argv.includes('--browser-only')){
 await storage.measureSystem()
 const before=await storage.storageUsage()
 assert.ok(before.system>0)
 await assert.rejects(()=>storage.beginUpload(owner,before.limit+1),/10 GB/)
 // Each fits alone; only one may reserve the shared remaining quota.
 const bytes=Math.floor(before.free*.6)
 const attempts=await Promise.allSettled([storage.beginUpload(owner,bytes),storage.beginUpload(owner,bytes)])
 for(const item of attempts)if(item.status==='fulfilled')ids.push(item.value.id)
 assert.equal(ids.length,1,'concurrent reservations cannot exceed quota')
 for(const id of ids)await storage.discardUpload(id,owner)
 ids.length=0
 const data=Buffer.alloc(storage.CHUNK_BYTES+97,7);Buffer.from([137,80,78,71,13,10,26,10]).copy(data)
 const upload=await storage.beginUpload(owner,data.length);ids.push(upload.id)
 await storage.uploadChunk(upload.id,owner,0,data.subarray(0,storage.CHUNK_BYTES))
 await storage.uploadChunk(upload.id,owner,0,data.subarray(0,storage.CHUNK_BYTES))
 await assert.rejects(()=>storage.finishUpload(upload.id,owner),/ไม่ครบ/)
 await storage.uploadChunk(upload.id,owner,1,data.subarray(storage.CHUNK_BYTES))
 const completed=await storage.finishUpload(upload.id,owner)
 await assert.rejects(()=>transaction(async c=>{await storage.claimUpload(c,completed.value,owner);throw Error('rollback-test')}),/rollback-test/)
 const [[rolledBack]]=await db.execute('SELECT claimed FROM storage_assets WHERE id=?',[upload.id]);assert.equal(rolledBack.claimed,0)
 await transaction(c=>storage.claimUpload(c,completed.value,owner))
 const response=await storage.mediaResponse(new Request(base,{headers:{Range:'bytes=1048570-1048590'}}),storage.storageMarker(upload.id),{'Content-Type':'image/png'})
 assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),data.subarray(1048570,1048591))
 const invalid=await storage.mediaResponse(new Request(base,{headers:{Range:'bytes=9999999-'}}),storage.storageMarker(upload.id));assert.equal(invalid.status,416)
 await transaction(async c=>{await storage.lockStorage(c);await storage.storageUsage(c,true)})
 const [[gone]]=await db.execute('SELECT COUNT(*) AS n FROM storage_assets WHERE id=?',[upload.id]);assert.equal(gone.n,0)
 const abandoned=await storage.beginUpload(owner,1024);await db.execute('UPDATE storage_assets SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) WHERE id=?',[abandoned.id])
 await transaction(async c=>{await storage.lockStorage(c);await storage.storageUsage(c,true)})
 const [[expired]]=await db.execute('SELECT COUNT(*) AS n FROM storage_assets WHERE id=?',[abandoned.id]);assert.equal(expired.n,0)
 console.log('PASS: quota race, oversized reservation, idempotent chunks, incomplete upload, rollback, streaming range and orphan cleanup.')
 }
 if(process.argv.includes('--core-only')){await db.execute('DELETE FROM storage_assets WHERE owner=?',[owner]);console.log('Core storage checks complete.');process.exitCode=0}
 else {
 const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}}),expiry=String(Date.now()+600000)
  await context.addCookies([{name:'trunkhill_admin',value:expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex'),domain:new URL(base).hostname,path:'/admin'}])
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  for(const section of ['dashboard','bookings','checkout','blockedPhones','plots','rooms','gear','zoneMedia','plotMap','settings','settings&group=welcome','settings&group=rates','settings&group=payment','settings&group=policy','settings&group=facilities','storage']){
   const result=await context.request.get(base+'/admin?section='+section);assert.equal(result.status(),200,section);const html=await result.text();assert.ok(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'),section)
  }
  await page.goto(base+'/admin?section=storage',{waitUntil:'networkidle'})
  await page.getByText('โควตารวมระบบและไฟล์ทั้งหมด 10 GB',{exact:true}).waitFor()
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.route('**/admin/storage',route=>route.fulfill({json:{used:10000000000,limit:10000000000,free:0,system:1000000000,media:9000000000,images:9000000000,videos:0,other:0,reserved:0}}))
  await page.goto(base+'/admin?section=plots',{waitUntil:'networkidle'});await page.getByRole('alert').filter({hasText:'พื้นที่จัดเก็บครบ 10 GB'}).waitFor()
  await page.unroute('**/admin/storage')
  assert.equal((await fetch(base+'/admin/storage')).status,403)
  assert.equal((await fetch(base+'/api/uploads',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({bytes:1})})).status,403)
  for(const pathname of ['/','/booking','/review','/payment?id=00000000000000000000']){const customer=await context.newPage();customer.on('pageerror',e=>errors.push(e.message));const result=await customer.goto(base+pathname,{waitUntil:'networkidle'});assert.equal(result.status(),200,pathname);await customer.close()}
  assert.equal(errors.length,0,errors.join('\n'))
  console.log('PASS: all admin sections, customer pages, mobile storage layout, no browser exceptions.')
 }finally{await browser.close()}
 }
}finally{
 await db.execute('DELETE FROM storage_assets WHERE owner=?',[owner]);await db.end();await database().end()
}
