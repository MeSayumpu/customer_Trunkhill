import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {readFileSync} from 'node:fs'
const base='http://127.0.0.1:3001',expiry=String(Date.now()+120000)
const headers={Cookie:'trunkhill_admin='+expiry+'.'+createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiry).digest('hex')}
const sections=['dashboard','bookings','checkout','blockedPhones','plots','rooms','gear','zoneMedia','plotMap','settings&group=rates','settings&group=payment','settings&group=policy']
let styles=new Set()
for(const section of sections) {
  const response=await fetch(base+'/admin?section='+section,{headers})
  const html=await response.text()
  assert.equal(response.status,200,section)
  assert.ok(html.includes('class="admin-ui"'),section+' admin layout')
  assert.ok(html.includes('data-icon='),section+' Font Awesome')
  assert.ok(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'),section+' render')
  for(const match of html.matchAll(/<link[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g)) styles.add(match[1].replaceAll('&amp;','&'))
}
const css=(await Promise.all([...styles].map(async url=>(await fetch(new URL(url,base))).text()))).join('\n')
assert.ok(css.includes('.admin-ui'))
assert.ok(css.includes('--ad-'),'Tailwind namespace')
assert.ok(css.includes('.svg-inline--fa'),'Font Awesome sizing')
assert.ok(!css.includes('@apply'),'Tailwind compiled')
const login=await(await fetch(base+'/admin')).text()
assert.ok(login.includes('เข้าสู่ระบบผู้ดูแล'))
for(const path of ['/','/booking']) {
  const response=await fetch(base+path);const html=await response.text()
  assert.equal(response.status,200)
  assert.ok(!html.includes('class="admin-ui"'),'customer remains outside admin styles')
}
const global=readFileSync('app/globals.css','utf8')
assert.ok(!global.includes('.admin-workspace'),'admin CSS removed from customer stylesheet')
assert.ok(!readFileSync('app/admin/admin.css','utf8').includes('tailwindcss/preflight'),'no global reset')
console.log('PASS: 12 admin views, login, Font Awesome, compiled/namespaced Tailwind and customer route isolation.')
