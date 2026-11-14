import assert from 'node:assert/strict'
import {randomBytes,createHmac} from 'node:crypto'
import {createConnection} from 'mysql2/promise'
import {createRequire,registerHooks} from 'node:module'
registerHooks({resolve(specifier,context,next){try{return next(specifier,context)}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.js'))return next(specifier+'.js',context);throw error}}})
const {assertStock}=await import('../lib/camp.js')
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.TEST_BASE_URL||'http://localhost:3004'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname))
assert.equal(new URL(process.env.DATABASE_URL).hostname,'127.0.0.1')
const db=await createConnection(process.env.DATABASE_URL)
const zone='T'+randomBytes(4).toString('hex').toUpperCase(),code=zone+'-ON',off=zone+'-OFF'
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
try {
  await db.execute("INSERT INTO zone_details(zone,description,rules) VALUES (?,'preserve description','preserve rules')",[zone])
  for(const [id,active] of [[code,1],[off,0]])await db.execute("INSERT INTO inventory(code,kind,zone,name,detail,price,stock,active) VALUES (?,'plot',?,?,'',100,1,?)",[id,zone,id,active])
  const context=await browser.newContext({viewport:{width:1200,height:850}})
  const expiry=String(Date.now()+600000),token=expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
  await context.addCookies([{name:'trunkhill_admin',value:token,url:base}])
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(base+'/admin?section=plots',{waitUntil:'networkidle'})
  await page.locator('.zone-create summary').click()
  const state=async()=>{const [[row]]=await db.execute('SELECT active,description,rules FROM zone_details WHERE zone=?',[zone]);return row}
  await page.getByRole('button',{name:`ปิดการใช้งานโซน ${zone}`,exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('button',{name:'กลับ',exact:true}).click()
  assert.equal((await state()).active,1)
  await page.getByRole('button',{name:`ปิดการใช้งานโซน ${zone}`,exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().width<=innerWidth))
  await dialog.getByRole('button',{name:'ยืนยันปิดการใช้งาน',exact:true}).click()
  await page.getByRole('button',{name:`เปิดการใช้งานโซน ${zone}`,exact:true}).waitFor()
  assert.equal((await state()).active,0)
  const catalog=await (await page.request.get(base+'/api/camp')).json()
  assert.ok(!catalog.inventory.some(i=>i.zone===zone))
  assert.ok(!catalog.settings.zones.includes(zone))
  const options=await (await page.request.get(base+'/api/camp-options')).json()
  assert.ok(!options.zones.includes(zone))
  assert.equal((await page.request.get(base+'/api/zone-details?zone='+zone)).status(),404)
  await assert.rejects(()=>assertStock(db,[{code,name:code,stock:1,quantity:1}],'2027-01-01','2027-01-02'),/ปิดรับจอง/)
  await page.getByRole('button',{name:`เปิดการใช้งานโซน ${zone}`,exact:true}).click()
  await dialog.getByRole('button',{name:'ยืนยันเปิดการใช้งาน',exact:true}).click()
  await page.getByRole('button',{name:`ปิดการใช้งานโซน ${zone}`,exact:true}).waitFor()
  assert.deepEqual(await state(),{active:1,description:'preserve description',rules:'preserve rules'})
  const restored=await (await page.request.get(base+'/api/camp')).json()
  assert.ok(restored.inventory.some(i=>i.code===code))
  assert.ok(!restored.inventory.some(i=>i.code===off))
  await assertStock(db,[{code,name:code,stock:1,quantity:1}],'2027-01-01','2027-01-02')
  assert.equal(errors.length,0,errors.join('\n'))
  console.log('PASS: confirmation, cancellation, mobile dialog, disable/enable populated zone, public catalog/options, server booking guard, preserved details and individual plot status.')
} finally {
  await browser.close()
  await db.execute('DELETE FROM inventory WHERE code IN (?,?)',[code,off])
  await db.execute('DELETE FROM zone_details WHERE zone=?',[zone])
  await db.end()
}
