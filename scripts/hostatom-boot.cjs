// Plesk startup file. Plesk's command console does not receive the app's environment variables,
// so database migrations run here, inside the app's own environment, when a flag file is present:
//   create run-migration.flag in the app root (contents = optional init-db flags, e.g. --keep-catalog),
//   then Restart App and open the site once. The result is written to migration.log.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const flag = path.join(__dirname, 'run-migration.flag')
if (fs.existsSync(flag)) {
  const args = fs.readFileSync(flag, 'utf8').trim().split(/\s+/).filter(Boolean)
  fs.rmSync(flag)
  const run = spawnSync(process.execPath, ['scripts/init-db.mjs', ...args], { cwd: __dirname, env: process.env, encoding: 'utf8' })
  const scrub = text => String(text || '').replace(/mysql:\/\/\S+/g, '[DATABASE_URL]')
  fs.writeFileSync(path.join(__dirname, 'migration.log'),
    `${new Date().toISOString()} init-db ${args.join(' ')} exit=${run.status}\n${scrub(run.stdout)}${scrub(run.stderr)}${run.error ? scrub(run.error.message) : ''}\n`)
}
require('./server.js')
