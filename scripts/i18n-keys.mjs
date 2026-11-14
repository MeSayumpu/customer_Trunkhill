// Lists every Thai string a customer can see, so lib/i18n-en.js can be checked for gaps.
//   node scripts/i18n-keys.mjs            → prints missing keys (exit 1 if any)
//   node scripts/i18n-keys.mjs --all      → prints every key as JSON
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const thai = /[฀-๿]/
const customerFiles = [
  ...readdirSync('app').filter(name => /\.(jsx|js)$/.test(name)).map(name => join('app',name)),
  ...['booking','payment','review'].flatMap(dir => readdirSync(join('app',dir)).filter(name => /\.(jsx|js)$/.test(name)).map(name => join('app',dir,name))),
  'lib/pricing.js',
]
// Server modules whose messages reach customers through the API.
const serverFiles = ['lib/camp.js','lib/payment.js','lib/reschedule.js','lib/booking-amendments.js','lib/storage.js','lib/booking-dates.js','lib/api.js','lib/request-language.js','app/api/uploads/route.js']

function literals(source) {
  const found = []
  const code = source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/.*$/gm,'$1')
  for (const match of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
    const text = (match[1] ?? match[2]).replace(/\\n/g,'\n').replace(/\\'/g,"'")
    // Minified code can pair quotes across statements; those spans are code, not text.
    if (thai.test(text) && !/throw new|=>|\);/.test(text)) found.push(text)
  }
  for (const match of code.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    if (thai.test(match[1])) found.push({template:match[1]})
  }
  // Thai text written directly between JSX tags.
  for (const match of code.matchAll(/>([^<>{}]*[฀-๿][^<>{}]*)</g)) {
    if (!/throw new|=>|\);/.test(match[1])) found.push(match[1].trim())
  }
  return found
}

const keys = new Set(), templates = []
for (const file of customerFiles) for (const item of literals(readFileSync(file,'utf8'))) {
  if (typeof item === 'string') keys.add(item); else templates.push({file,template:item.template})
}
const serverKeys = new Set(), serverTemplates = []
for (const file of serverFiles) for (const item of literals(readFileSync(file,'utf8'))) {
  if (typeof item === 'string') serverKeys.add(item); else serverTemplates.push({file,template:item.template})
}

const { en, enPatterns } = await import('../lib/i18n-en.js')
if (process.argv.includes('--all')) {
  console.log(JSON.stringify({ui:[...keys],server:[...serverKeys],templates,serverTemplates},null,1))
} else {
  const missing = [...new Set([...keys,...serverKeys])].filter(key => !(key in en) && !enPatterns.some(([pattern]) => pattern.test(key)))
  const untested = serverTemplates.filter(({template}) => {
    const sample = template.replace(/\$\{[^}]*\}/g,'X')
    return !enPatterns.some(([pattern]) => pattern.test(sample))
  })
  for (const key of missing) console.log('missing:', JSON.stringify(key))
  for (const {file,template} of untested) console.log('no pattern:', file, JSON.stringify(template))
  for (const {file,template} of templates) console.log('ui template (wrap with t + params):', file, JSON.stringify(template.slice(0,90)))
  console.log(`${keys.size} UI keys, ${serverKeys.size} server keys, ${serverTemplates.length} server templates · missing ${missing.length}, no pattern ${untested.length}`)
  process.exitCode = missing.length || untested.length ? 1 : 0
}
