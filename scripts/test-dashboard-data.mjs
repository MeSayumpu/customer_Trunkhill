import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createConnection} from 'mysql2/promise'
const file=resolve('app/admin/dashboard-data.js')
const source=readFileSync(file,'utf8').replace(/from '([^']+)'/g,(_,path)=>`from '${pathToFileURL(resolve(dirname(file),path+'.js')).href}'`)
const {dashboardData,dashboardFilters}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const current='2026-11-13'
assert.equal(dashboardFilters({mode:'month',day:'2028-02-20'},current).length,29)
assert.equal(dashboardFilters({from:'2026-02-30'},current).from,'')
assert.ok(dashboardFilters({from:'2026-12-01'},current).error)
assert.equal(dashboardFilters({from:'2026-11-01'},current).day,'2026-11-01')
const db=await createConnection(process.env.DATABASE_URL)
try {
  const data=await dashboardData(dashboardFilters({from:'2026-11-01',to:'2026-11-30'},current),current)
  const [[expected]]=await db.execute("SELECT COUNT(*) AS count,COALESCE(SUM(total),0) AS revenue FROM bookings WHERE status='confirmed' AND arrival BETWEEN ? AND ?",['2026-11-01','2026-11-30'])
  assert.equal(Number(data.stats.confirmed),Number(expected.count))
  assert.equal(data.revenue.reduce((sum,row)=>sum+Number(row.amount),0)-Number(data.stats.discount),Number(expected.revenue),'revenue categories reconcile to confirmed booking totals')
  assert.equal(data.reports.reduce((sum,row)=>sum+Number(row.amount),0),Number(expected.revenue),'daily reports reconcile')
  const closed=new Set()
  for(const row of data.closures) for(let date=row.start_date;date<=row.end_date;date=new Date(Date.parse(date)+86400000).toISOString().slice(0,10)) if(date>=data.from&&date<=data.to) closed.add(date)
  assert.equal(data.openNights,30-closed.size,'overlapping closure periods counted once')
  assert.ok(!data.inventory.some(i=>i.code==='WHOLE-CAMP'),'virtual whole-camp SKU excluded from capacity')
  const empty=await dashboardData(dashboardFilters({from:'2000-01-01',to:'2000-01-01'},current),current)
  assert.equal(Number(empty.stats.total),0)
  assert.equal(empty.occupancy,0)
  console.log('PASS: dates/leap month, empty range, closure capacity, confirmed counts, daily reports and revenue reconciliation.')
} finally {await db.end()}
process.exit(0)
