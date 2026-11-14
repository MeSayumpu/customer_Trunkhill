import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3001', styles=new Set()
for(const path of ['/','/review','/payment?id=ui-check','/booking']) {
  const response=await fetch(base+path),html=await response.text()
  assert.equal(response.status,200,path)
  assert.ok(html.includes('class="customer-ui"'),path+' customer layout')
  assert.ok(html.includes('data-icon='),path+' Font Awesome')
  assert.ok(!html.includes('class="admin-ui"'),path+' isolated styles')
  assert.ok(html.includes('class="confirm-dialog'),path+' removal confirmation dialog mounted')
  if(path==='/') assert.ok(html.includes('class="tent-map"'),'3D tent map rendered on the booking page')
  for(const match of html.matchAll(/<link[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g)) styles.add(match[1].replaceAll('&amp;','&'))
}
const css=(await Promise.all([...styles].map(async url=>(await fetch(new URL(url,base))).text()))).join('\n')
assert.ok(css.includes('--c-forest'),'customer design tokens compiled')
assert.ok(css.includes('.tent-field'),'3D tent map styles compiled')
assert.ok(!css.includes('@apply'),'no uncompiled @apply rules')
assert.ok(css.includes('.svg-inline--fa'),'Font Awesome stylesheet')
const source=readFileSync('app/customer-ui.css','utf8')
assert.ok(!source.includes('tailwindcss/preflight'),'no global reset')
assert.ok(!/^(?!\s*(?:\/\*|\*|@|}|\.customer-ui|html:has\(\.customer-ui)).*\{/m.test(source.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g,'').replace(/@media[^{]*\{/g,'')),'every rule scoped to .customer-ui')
for(const legacy of ['app/customer.css','app/customer-theme.css','app/customer-feedback.css','app/customer-requested.css','app/mobile-dialogs.css'])
  assert.ok(!existsSync(legacy),legacy+' replaced by app/customer-ui.css')
console.log('PASS: four customer routes, Font Awesome, confirm dialog, 3D tent map, scoped customer-ui.css and legacy stylesheet cleanup.')
