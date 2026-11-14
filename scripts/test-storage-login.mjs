import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.TEST_BASE_URL||'http://localhost:3004'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname))
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage()
 page.on('pageerror',error=>console.error('Browser error:',error.message))
 page.on('response',response=>{if(response.status()>=500)console.error('HTTP',response.status(),response.url())})
 page.setDefaultTimeout(60000)
 assert.equal((await context.request.get(base+'/admin/storage')).status(),403)
 await page.goto(base+'/admin',{waitUntil:'networkidle'})
 await page.locator('input[name=password]').fill(process.env.ADMIN_PASSWORD)
 await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
 try{await page.getByRole('navigation',{name:'เมนูผู้ดูแล'}).waitFor({state:'attached'})}catch(error){console.error('Login page:',page.url(),await page.locator('body').innerText());throw error}
 const cookie=(await context.cookies()).find(c=>c.name==='trunkhill_admin')
 assert.equal(cookie?.path,'/admin','use the real login cookie scope')
 assert.equal((await context.request.get(base+'/api/admin-storage')).status(),403,'admin cookie must not be sent outside /admin')
 const result=await context.request.get(base+'/admin/storage');assert.equal(result.status(),200)
 assert.equal((await result.json()).limit,10000000000)
 await page.goto(base+'/admin?section=storage',{waitUntil:'networkidle'})
 await page.locator('.storage-total').waitFor()
 assert.equal(await page.getByText('โหลดข้อมูลพื้นที่ไม่สำเร็จ กรุณารีเฟรชหน้า',{exact:true}).count(),0)
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 // Browser fetch, not a manually supplied Cookie header, exercises the upload alias.
 const outcome=await page.evaluate(async()=>{
  const first=await fetch('/admin/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bytes:12})})
  const data=await first.json()
  if(first.ok){const release=await fetch('/admin/uploads?id='+data.id,{method:'DELETE'});return [first.status,release.status]}
  return [first.status,data.error]
 })
 assert.deepEqual(outcome,[200,200])
 console.log('PASS: real login, /admin-scoped cookie, mobile storage rendering, authenticated upload reservation/release, public API remains protected.')
}finally{await browser.close()}
