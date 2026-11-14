import Link from '../pending-ui'
import { today } from '../../lib/camp'
import { shiftDate, stayNights } from '../../lib/booking-dates'
import { money, statuses } from '../../lib/pricing'
import { adminUrl } from './navigation'
import { AdminIcon } from './admin-icon'
import { dashboardData, dashboardFilters } from './dashboard-data'
import { DashboardCalendar, DashboardReports } from './dashboard-calendar'

const number=new Intl.NumberFormat('th-TH',{maximumFractionDigits:1})
const fullDate=new Intl.DateTimeFormat('th-TH-u-ca-gregory',{dateStyle:'long',timeZone:'UTC'})
const colors=['#315c42','#83a773','#d3ac69','#7c9fb0','#a8839f','#b8c4a8','#b78066']
function Metric({label,value,detail,icon}) {
  return <div className="panel dashboard-metric"><dt>{label}<AdminIcon name={icon}/></dt><dd><strong>{value}</strong><small className="muted">{detail}</small></dd></div>
}
function Pie({title,items}) {
  const total=items.reduce((n,i)=>n+i.value,0)
  let position=0
  const segments=items.map((item,index)=>{const start=position;position+=total?item.value/total*100:0;return `${colors[index%colors.length]} ${start}% ${position}%`})
  return <section className="dashboard-pie"><h3>{title}</h3><div className="dashboard-pie-content">
    <div className="dashboard-donut" role="img" aria-label={title+': '+(total?items.map(i=>`${i.label} ${number.format(i.value)} หน่วย-คืน`).join(', '):'ไม่มีข้อมูล')} style={{background:total?`conic-gradient(${segments.join(',')})`:'#e7ebe3'}}><div><strong>{number.format(total)}</strong><small>หน่วย-คืน</small></div></div>
    <ul>{items.map((item,index)=><li key={item.label}><i style={{background:colors[index%colors.length]}}/><span>{item.label}</span><strong>{number.format(total?item.value/total*100:0)}%</strong><small>{number.format(item.value)}</small></li>)}{!total&&<li className="muted">ไม่มีการใช้งานในช่วงนี้</li>}</ul>
  </div></section>
}
function grouped(rows,key) {
  const values=new Map()
  for(const row of rows) {const label=key(row);values.set(label,(values.get(label)||0)+Number(row.used))}
  return [...values].map(([label,value])=>({label,value}))
}
function Trend({data}) {
  const start=data.from>shiftDate(data.to,-29)?data.from:shiftDate(data.to,-29)
  const count=Math.max(0,stayNights(start,data.to)+1)
  const values=Array.from({length:count},(_,index)=>{
    const day=shiftDate(start,index),used=Number(data.trend.find(r=>r.night===day)?.used||0)
    const closed=data.closures.some(c=>c.start_date<=day&&c.end_date>=day)
    return {day,value:!closed&&data.capacity?used/data.capacity*100:0,closed}
  })
  const points=values.map((r,i)=>`${40+i*420/Math.max(1,count-1)},${150-r.value*1.2}`).join(' ')
  return <section className="panel stack"><div><h2><AdminIcon name="dashboard"/> แนวโน้มอัตราเข้าพัก</h2><p className="small muted">สูงสุด 30 คืนท้ายของช่วงที่เลือก · ล็อกและห้องพัก</p></div>
    {values.length?<><svg className="dashboard-trend" viewBox="0 0 490 190" role="img" aria-label="กราฟอัตราเข้าพัก ดูตัวเลขแต่ละวันในรายละเอียดด้านล่าง">{[0,25,50,75,100].map(value=><g key={value}><line x1="40" x2="460" y1={150-value*1.2} y2={150-value*1.2} stroke="#e1e7df"/><text x="3" y={154-value*1.2}>{value}%</text></g>)}<polygon points={`40,150 ${points} 460,150`} fill="#edf2e6"/><polyline points={points} fill="none" stroke="#315c42" strokeWidth="3"/>{values.map((r,i)=><circle key={r.day} cx={40+i*420/Math.max(1,count-1)} cy={150-r.value*1.2} r="3" fill="#315c42"><title>{r.day+': '+(r.closed?'ปิดรับจอง':number.format(r.value)+'%')}</title></circle>)}<text x="40" y="177">{start}</text><text x="460" y="177" textAnchor="end">{data.to}</text></svg><details className="small"><summary>ดูตัวเลขรายวัน</summary><ul>{values.map(r=><li key={r.day}>{r.day} · {r.closed?'ปิดรับจอง':number.format(r.value)+'%'}</li>)}</ul></details></>:<p className="muted">ไม่มีข้อมูลในช่วงนี้</p>}
  </section>
}

export async function Dashboard({query={}}) {
  const current=today(),filters=dashboardFilters(query,current)
  const filterForm=<form action="/admin" className="dashboard-range"><input type="hidden" name="section" value="dashboard"/>
    <label>ตั้งแต่วันที่<input type="date" name="from" defaultValue={filters.from}/></label><label>ถึงวันที่<input type="date" name="to" defaultValue={filters.to}/></label><button className="button"><AdminIcon name="filter"/>แสดงข้อมูล</button><Link className="button secondary" href={adminUrl('dashboard')}>ทั้งหมด</Link>
  </form>
  if(filters.error) return <div className="panel stack">{filterForm}<p role="alert" className="notice error">{filters.error}</p></div>
  const data=await dashboardData(filters,current)
  const lodging=data.usage.filter(i=>i.kind!=='gear')
  const zones=[...new Set(data.inventory.map(i=>i.zone))]
  const revenues=[{label:'ค่ากางเต็นท์ / เหมาลาน',amount:0},{label:'ค่า Trunkbox',amount:0},{label:'ค่าเช่าเต็นท์',amount:0},{label:'ค่าเช่าอุปกรณ์',amount:0},{label:'ค่าไฟ',amount:Number(data.extras.electricity)/100}]
  for(const row of data.revenue) revenues[row.kind==='plot'?0:row.kind==='room'?1:row.is_tent?2:3].amount+=Number(row.amount)
  const gross=revenues.reduce((n,r)=>n+r.amount,0),discount=Number(data.stats.discount),other=Number(data.extras.other)/100
  return <div className="stack admin-dashboard">
    <section className="dashboard-welcome"><div><span className="eyebrow">TRUNKHILL CAMPFIELD</span><h2>ภาพรวมแคมป์</h2><p>วันนี้ {fullDate.format(new Date(current))} · เวลาไทย</p></div>{filterForm}</section>
    <p className="small muted dashboard-period">สรุปช่วง {data.from} ถึง {data.to} · ไม่ระบุวันที่ = ตั้งแต่เริ่มต้นถึงปัจจุบัน · จำนวนจองและรายได้อ้างอิงวันเช็กอิน ส่วนอัตราเข้าพักอ้างอิงคืนที่พักตามการจอง</p>
    <dl className="dashboard-metrics"><Metric label="รายการจองในช่วงที่เลือก" value={number.format(data.stats.total)} detail={`ยืนยันแล้ว ${data.stats.confirmed} · รอตรวจสอบ ${data.stats.pending}`} icon="bookings"/>
      <Metric label="อัตราเข้าพัก" value={number.format(data.occupancy)+'%'} detail={`${number.format(data.used)} / ${number.format(data.capacity*data.openNights)} หน่วย-คืน`} icon="plots"/>
      <Metric label="เช็กอินวันนี้" value={number.format(data.today.arrivals)} detail={`${number.format(data.today.guests)} คน · รายการยืนยันแล้ว`} icon="rooms"/>
      <Metric label="ต้อง Check-out วันนี้" value={number.format(data.today.departures)} detail="ถึงกำหนดออกและยังไม่ปิดรายการ" icon="checkout"/>
    </dl>
    <div className="dashboard-layout"><div className="stack dashboard-primary">
      <DashboardCalendar inventory={data.inventory} rows={data.calendar} closures={data.closures} filters={filters} current={current}/>
      <section className="panel stack"><div className="dashboard-section-head"><h2><AdminIcon name="bookings"/> การจองล่าสุด</h2><Link className="text-button" href={adminUrl('bookings',{from:data.from,to:data.to})}>ดูทั้งหมด →</Link></div>
        <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>วันเช็กอิน</th><th>ผู้จอง</th><th>โซน / รายการ</th><th>คืน</th><th>ยอดค่าจอง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{data.recent.map(row=><tr key={row.id}><td>{row.arrival}</td><td>{row.guest}</td><td>{row.lodging||'อุปกรณ์เช่า'}</td><td>{stayNights(row.arrival,row.departure)}</td><td>{money(row.total)}</td><td><span className={'admin-status '+row.status}>{statuses[row.status]}</span></td><td><Link className="button secondary" href={adminUrl('bookings',{q:row.id,view:row.id})}>ดูรายการ</Link></td></tr>)}{!data.recent.length&&<tr><td colSpan={7}>ไม่มีรายการจองในช่วงวันที่เลือก</td></tr>}</tbody></table></div>
      </section>
    </div><aside className="stack dashboard-secondary">
      <section className="panel stack"><h2>เมนูด่วน</h2><div className="dashboard-quick-actions">{[['bookings','bookings','จัดการการจอง'],['checkout','checkout','Check-out'],['settings','rates','จัดการราคา'],['plots','plots','จัดการพื้นที่']].map(([section,icon,label])=><Link key={section} href={adminUrl(section,section==='settings'?{group:'rates'}:{})}><AdminIcon name={icon}/><span>{label}</span></Link>)}</div><Link className="text-button" href="#booking-calendar">ตรวจสอบพื้นที่ว่างในปฏิทิน →</Link></section>
      <Trend data={data}/>
      <section className="panel stack"><h2><AdminIcon name="plotMap"/> ภาพรวมพื้นที่</h2><p className="small muted">สัดส่วนคืนที่ถูกจองในช่วงที่เลือก</p><div className="dashboard-site">{zones.map(zone=>{
        const capacity=data.inventory.filter(i=>i.zone===zone&&i.active).reduce((n,i)=>n+Number(i.stock),0)*data.openNights
        const used=lodging.filter(i=>i.zone===zone).reduce((n,i)=>n+Number(i.used),0),rate=capacity?used/capacity*100:0
        return <div key={zone}><AdminIcon name={zone==='BOX'?'rooms':'plots'}/><strong>{zone==='BOX'?'Trunkbox':'โซน '+zone}</strong><span>{number.format(used)} / {number.format(capacity)}</span><small>{number.format(rate)}%</small><meter min="0" max={Math.max(1,capacity)} value={used} aria-label={'อัตราเข้าพัก '+zone}/></div>
      })}</div></section>
    </aside></div>
    <section className="panel stack"><div><h2>สัดส่วนการใช้บริการ</h2><p className="small muted">รายการยืนยันแล้ว · หน่วย-คืน = จำนวนที่จอง × จำนวนคืนในช่วงที่เลือก</p></div><div className="dashboard-pies">
      <Pie title="แยกตามโซน" items={grouped(lodging,r=>r.zone==='BOX'?'Trunkbox':'โซน '+r.zone)}/><Pie title="ล็อก / Trunkbox" items={grouped(lodging,r=>r.name)}/><Pie title="เต็นท์เช่า" items={grouped(data.usage.filter(r=>r.kind==='gear'&&r.is_tent),r=>r.name)}/><Pie title="อุปกรณ์เช่า" items={grouped(data.usage.filter(r=>r.kind==='gear'&&!r.is_tent),r=>r.name)}/>
    </div></section>
    <div className="dashboard-bottom"><section className="panel stack"><div><h2><AdminIcon name="revenue"/> รายได้แยกประเภท</h2><p className="small muted">ค่าจองที่ยืนยันแล้วตามวันเช็กอิน · ค่าไฟและค่าใช้จ่ายเพิ่มเติมเฉพาะที่ปิด Check-out แล้ว</p></div><dl className="dashboard-revenue">{revenues.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{money(row.amount)}</dd></div>)}<div><dt>ส่วนลดค่าเต็นท์</dt><dd>−{money(discount)}</dd></div><div><dt>ค่าเสียหาย / ค่าใช้จ่ายอื่น</dt><dd>{money(other)}</dd></div><div className="dashboard-revenue-total"><dt>รวมสุทธิ</dt><dd>{money(gross-discount+other)}</dd></div></dl></section><DashboardReports key={data.from+data.to} rows={data.reports}/></div>
    <p className="small muted">อัตราเข้าพักใช้จำนวนล็อกและห้องพักที่เปิดใช้งานในปัจจุบัน หักคืนที่แคมป์ปิดรับจอง และนับเหมาลานครอบคลุมทุกล็อกและห้องพัก ตัวเลขย้อนหลังจึงอาจเปลี่ยนเมื่อปรับสต๊อกหรือสถานะพื้นที่</p>
  </div>
}
