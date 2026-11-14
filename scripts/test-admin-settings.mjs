import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
const base='http://127.0.0.1:3001'
const expiry=String(Date.now()+120000)
const cookie='trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')
for (const [legacy,group,fields] of [
  ['pricing','rates',['soloPrice','holidayPrice']],
  ['calendar','rates',['soloPrice','holidayPrice']],
  ['payment','payment',['recipient','bankAccount','promptpay','rate']],
  ['checkoutSettings','payment',['recipient','promptpay']],
  ['bookingPolicy','policy',['noticeDays','rescheduleLimit']],
]) {
  const legacyResponse=await fetch(base+'/admin?section='+legacy,{headers:{Cookie:cookie}})
  const legacyHtml=await legacyResponse.text()
  assert.ok(legacyResponse.url.includes('section=settings') || legacyHtml.includes('section=settings'), 'legacy link redirects')
  const response=await fetch(base+'/admin?section=settings&group='+group,{headers:{Cookie:cookie}})
  assert.equal(response.status,200)
  assert.equal(new URL(response.url).searchParams.get('section'),'settings')
  assert.equal(new URL(response.url).searchParams.get('group'),group)
  const html=await response.text()
  for(const field of fields) assert.equal((html.match(new RegExp('name="'+field+'"','g'))||[]).length,1,field+' must appear once')
  assert.ok(html.includes('aria-label="หมวดการตั้งค่า"'))
  if(group==='rates') assert.ok(html.includes('id="admin-calendar-title"'))
}
const day=await fetch(base+'/admin?section=settings&group=rates&day=2026-12-15&kind=season',{headers:{Cookie:cookie}})
assert.equal(new URL(day.url).searchParams.get('day'),'2026-12-15')
assert.ok((await day.text()).includes('name="calendarDay" value="2026-12-15"'))
console.log('PASS: all settings groups, legacy URLs, calendar context and unique fields.')
