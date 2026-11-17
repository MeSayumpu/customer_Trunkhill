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
// The host's own logs cannot be read from Plesk, so the process keeps a short diary in app-events.log (app root):
// when it starts, how much memory it holds each minute, and why it ends. A "start" that follows no "exit" or "signal"
// line means the process was killed from outside (for example for using too much memory).
const eventsLog = path.join(__dirname, 'app-events.log')
function note(text) {
  try {
    if (fs.existsSync(eventsLog) && fs.statSync(eventsLog).size > 200000) fs.renameSync(eventsLog, eventsLog + '.old')
    fs.appendFileSync(eventsLog, new Date().toISOString() + ' pid=' + process.pid + ' ' + text + '\n')
  } catch {}
}
const memory = () => { const usage = process.memoryUsage(); return 'rss=' + Math.round(usage.rss / 1048576) + 'MB heap=' + Math.round(usage.heapUsed / 1048576) + 'MB' }
note('start node=' + process.version)
// An error nothing caught leaves the process in an unknown state: write it down and let the host start a fresh one.
process.on('uncaughtException', error => { note('uncaughtException ' + (error && error.stack || error)); process.exit(1) })
// A promise nobody awaited failed. Node would end the whole site for it; one failed background step should not do that.
process.on('unhandledRejection', reason => note('unhandledRejection ' + (reason && reason.stack || reason)))
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => { note('signal ' + signal + ' ' + memory()); process.exit(0) })
process.on('exit', code => note('exit code=' + code + ' ' + memory()))
setInterval(() => note('alive ' + memory()), 60000).unref()

require('./server.js')
