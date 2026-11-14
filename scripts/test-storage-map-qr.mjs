import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {createConnection} from 'mysql2/promise'
const base=process.env.TEST_BASE_URL||'http://localhost:3004'
assert.equal(new URL(process.env.DATABASE_URL).hostname,'127.0.0.1')
const db=await createConnection(process.env.DATABASE_URL)
const [[original]]=await db.query('SELECT * FROM plot_map_state WHERE id=1'),[[payment]]=await db.query('SELECT * FROM payment_config WHERE id=1')
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
const revisions=[],assets=[];let qrMarker
try{
 const ctx=await browser.newContext(),expiry=String(Date.now()+600000)
 await ctx.addCookies([{name:'trunkhill_admin',value:expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex'),domain:new URL(base).hostname,path:'/admin'}])
 const page=await ctx.newPage();page.setDefaultTimeout(120000)
 page.on('response',async r=>{if((r.url().includes('/api/uploads')||r.url().includes('/admin/uploads'))&&r.request().method()==='POST'){try{const data=await r.json();if(data.id)assets.push(data.id)}catch{}}})
 const mapOriginal=original.draft_revision?await (await ctx.request.get(base+'/admin/plot-map-preview?v='+original.draft_revision)).body():readFileSync('public/camp-map.webp')
 const map=Buffer.concat([mapOriginal,Buffer.alloc(1024*1024)])
 await page.goto(base+'/admin?section=plotMap',{waitUntil:'networkidle'})
 await page.getByLabel('รูปผังลาน',{exact:true}).setInputFiles({name:'large.webp',mimeType:'image/webp',buffer:map})
 await page.getByRole('button',{name:'บันทึก Draft',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึก Draft แล้ว'}).waitFor()
 let [[draft]]=await db.query('SELECT * FROM plot_map_state WHERE id=1');revisions.push(draft.draft_revision)
 assert.equal(draft.published_revision,original.published_revision)
 assert.deepEqual(await (await ctx.request.get(base+'/admin/plot-map-preview?v='+draft.draft_revision)).body(),map)
 assert.equal((await fetch(base+'/api/plot-map-image?v='+draft.draft_revision)).status,404)
 const [[first]]=await db.execute('SELECT content FROM plot_map_versions WHERE revision=?',[draft.draft_revision])
 await page.getByRole('button',{name:'บันทึก Draft',exact:true}).click()
 await page.waitForFunction(async old=>{const response=await fetch('/api/camp');return response.ok},draft.draft_revision)
 await page.getByRole('button',{name:'บันทึก Draft',exact:true}).waitFor()
 for(let i=0;i<30;i++){[[draft]]=await db.query('SELECT * FROM plot_map_state WHERE id=1');if(draft.draft_revision!==revisions[0])break;await new Promise(r=>setTimeout(r,100))}
 revisions.push(draft.draft_revision)
 const [[second]]=await db.execute('SELECT content FROM plot_map_versions WHERE revision=?',[draft.draft_revision]);assert.deepEqual(first.content,second.content,'draft geometry save reuses uploaded asset')
 assert.ok(payment,'test needs existing payment settings')
 const qrOriginal=await (await ctx.request.get(base+'/api/payment/qr')).body(),qr=Buffer.concat([qrOriginal,Buffer.alloc(1024*1024)])
 await page.goto(base+'/admin?section=settings&group=payment',{waitUntil:'networkidle'})
 await page.locator('input[name=qr]').setInputFiles({name:'qr.png',mimeType:payment.mime,buffer:qr})
 await page.locator('form').filter({has:page.locator('input[name=qr]')}).locator('button[type=submit],button:not([type])').last().click()
 await page.waitForURL(/saved=payment/)
 const [[saved]]=await db.query('SELECT qr FROM payment_config WHERE id=1');qrMarker=saved.qr
 assert.deepEqual(await (await ctx.request.get(base+'/api/payment/qr')).body(),qr)
 console.log('PASS: large map and QR uploads, private draft preview, unchanged public map, asset reuse between drafts.')
}finally{
 await browser.close()
 for(const id of assets){const [rows]=await db.execute('SELECT revision FROM plot_map_versions WHERE content=?',[Buffer.from('@storage:'+id)]);revisions.push(...rows.map(row=>row.revision))}
 if(!qrMarker){const [[currentQR]]=await db.query('SELECT qr FROM payment_config WHERE id=1');if(assets.includes(currentQR?.qr?.toString().slice(9)))qrMarker=currentQR.qr}
 if(qrMarker)await db.execute('UPDATE payment_config SET qr=?,mime=? WHERE id=1 AND qr=?',[payment.qr,payment.mime,qrMarker])
 const [[current]]=await db.query('SELECT draft_revision FROM plot_map_state WHERE id=1')
 if(revisions.includes(current.draft_revision)){await db.execute('UPDATE plot_map_state SET draft_revision=? WHERE id=1',[original.draft_revision]);for(const revision of new Set(revisions))await db.execute('DELETE FROM plot_map_versions WHERE revision=?',[revision]);for(const id of assets)await db.execute('DELETE FROM storage_assets WHERE id=?',[id])}
 await db.end()
}
