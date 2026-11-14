// Assembles the Plesk (Hostatom) upload folder from a standalone build.
//   $env:DEPLOY_STANDALONE='1'; $env:NEXT_OUTPUT_DIR='.next-deploy'; node node_modules/next/dist/bin/next build --webpack
//   node scripts/package-hostatom.mjs
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dist = '.next-deploy'
const standalone = path.join(root, dist, 'standalone')
const out = path.join(root, 'deploy', 'hostatom', 'app')

await stat(path.join(standalone, 'server.js'))
await rm(out, { recursive:true, force:true })
await mkdir(out, { recursive:true })

// 1. Standalone server + the static files it serves.
await cp(standalone, out, { recursive:true })
await cp(path.join(root, dist, 'static'), path.join(out, dist, 'static'), { recursive:true })
await cp(path.join(root, 'public'), path.join(out, 'public'), { recursive:true })

// 2. Database migration (run once from Plesk "Run script": db:migrate).
for (const file of ['scripts/init-db.mjs', 'scripts/customer-experience-schema.mjs',
  'lib/rentals.js', 'lib/whole-camp.js', 'lib/booking-reference.js']) await cp(path.join(root, file), path.join(out, file))
await cp(path.join(root, 'db'), path.join(out, 'db'), { recursive:true })
const seen = new Set()
async function copyPackage(name) {
  if (seen.has(name)) return
  seen.add(name)
  const source = path.join(root, 'node_modules', name)
  const target = path.join(out, 'node_modules', name)
  try { await stat(target) } catch { await cp(source, target, { recursive:true }) }
  const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
  for (const dependency of Object.keys(manifest.dependencies || {})) await copyPackage(dependency)
}
await copyPackage('mysql2')

// 3. Runtime package.json for Plesk: no install needed, just start + migrate.
await writeFile(path.join(out, 'package.json'), JSON.stringify({
  name:'trunkhill-campfield', private:true,
  engines:{ node:'>=20.9' },
  scripts:{ start:'node server.js', 'db:migrate':'node scripts/init-db.mjs --keep-catalog' },
}, null, 2) + '\n')

// 4. Never ship local secrets or Windows-only image binaries (next/image is not used).
async function remove(dir, test) {
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    const file = path.join(dir, entry.name)
    if (test(entry.name, file)) await rm(file, { recursive:true, force:true })
    else if (entry.isDirectory()) await remove(file, test)
  }
}
await remove(out, name => /^\.env/.test(name) || /^sharp-(win32|darwin)/.test(name) || /^sharp-libvips-(win32|darwin)/.test(name))
console.log('Ready:', path.relative(root, out))
