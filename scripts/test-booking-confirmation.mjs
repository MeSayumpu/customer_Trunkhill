import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
import {createRequire} from 'node:module'
import {mkdirSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.TEST_BASE_URL||'http://localhost:3000'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname))
assert.equal(new URL(process.env.DATABASE_URL).hostname,'127.0.0.1')
const db=await createConnection(process.env.DATABASE_URL)
const id=randomBytes(10).toString('hex').toUpperCase(),guest='CONFIRM-TEST-'+id
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
const status=async()=>{const [[r]]=await db.execute('SELECT status FROM bookings WHERE id=?',[id]);return r.status}
try {
  await db.execute(`INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,status) VALUES (?,?,?,?,?,'2027-01-10','2027-01-11',1,0,0,450,'pending')`,[id,randomUUID(),'0'.repeat(64),guest,'0800000000'])
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const expiry=String(Date.now()+600000),token=expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
  await context.addCookies([{name:'trunkhill_admin',value:token,url:base}])
  const page=await context.newPage(),errors=[];page.setDefaultNavigationTimeout(25000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)})
  await page.goto(base+'/admin?section=bookings&q='+guest,{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'อนุมัติ',exact:true}).click()
  const popup=page.getByRole('dialog',{name:'อนุมัติการจองนี้?'})
  await popup.waitFor();assert.ok((await popup.innerText()).includes(guest));assert.equal(await status(),'pending')
  await popup.getByRole('button',{name:'กลับไปตรวจสอบ'}).click()
  assert.equal(await status(),'pending')
  await page.getByRole('button',{name:'อนุมัติ',exact:true}).click()
  mkdirSync('tmp/confirm',{recursive:true})
  await page.screenshot({path:'tmp/confirm/approve.png'})
  await popup.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).click()
  await page.waitForURL(/saved=booking/);await page.waitForLoadState('networkidle')
  assert.equal(await status(),'confirmed')
  await page.getByRole('link',{name:'ดูรายละเอียด',exact:true}).click()
  const detail=page.getByRole('dialog',{name:'รายละเอียดการจอง',exact:true});await detail.waitFor()
  await detail.getByRole('button',{name:'ยกเลิก',exact:true}).click()
  const cancel=page.getByRole('dialog',{name:'ยกเลิกการจองนี้?',exact:true});await cancel.waitFor()
  assert.equal(await status(),'confirmed')
  await page.keyboard.press('Escape');await cancel.waitFor({state:'hidden'})
  assert.ok(await detail.isVisible());assert.equal(await status(),'confirmed')
  await detail.getByRole('button',{name:'ยกเลิก',exact:true}).click()
  await cancel.waitFor()
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:'tmp/confirm/cancel-mobile.png'})
  assert.ok(await cancel.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth))
  await cancel.getByRole('button',{name:'ยืนยันยกเลิกการจอง',exact:true}).click()
  await page.waitForURL(url=>!url.searchParams.has('view'));await page.waitForLoadState('networkidle')
  assert.equal(await status(),'cancelled')
  assert.equal(errors.length,0,errors.join('\n'))
  console.log('PASS: approval/cancellation require confirmation, dismiss leaves status unchanged, nested detail modal, mobile layout, real status updates and no browser errors.')
} finally {
  await browser.close()
  await db.execute('DELETE FROM bookings WHERE id=?',[id])
  await db.end()
}
