'use client'
import { useState } from 'react'
import Link from '../pending-ui'
import { adminUrl } from './navigation'
import { shiftDate } from '../../lib/booking-dates'
import { AdminIcon } from './admin-icon'

const dateLabel=new Intl.DateTimeFormat('th-TH-u-ca-gregory',{day:'numeric',month:'short',timeZone:'UTC'})
const statusLabel={pending:'รอตรวจสอบ',confirmed:'ยืนยันแล้ว',staying:'อยู่ในช่วงเข้าพัก',done:'Check-out แล้ว'}
export function DashboardCalendar({inventory,rows,closures,filters,current}) {
  const [expanded,setExpanded]=useState([])
  const dates=Array.from({length:filters.length},(_,i)=>shiftDate(filters.start,i))
  const zones=[...new Set(inventory.map(i=>i.zone))]
  const url=params=>adminUrl('dashboard',{from:filters.from,to:filters.to,day:filters.day,mode:filters.mode,...params})
  const move=direction=>{
    if(filters.mode!=='month') return shiftDate(filters.day,filters.length*direction)
    const date=new Date(filters.start);date.setUTCMonth(date.getUTCMonth()+direction)
    return date.toISOString().slice(0,10)
  }
  const indexed=new Map()
  for(const row of rows) {const key=row.code+'|'+row.night;indexed.set(key,[...(indexed.get(key)||[]),row])}
  const closed=day=>closures.find(c=>c.start_date<=day&&c.end_date>=day)
  return <section className="panel stack dashboard-calendar" id="booking-calendar">
    <div className="dashboard-section-head"><h2><AdminIcon name="rates"/> ปฏิทินการจอง</h2><div className="dashboard-calendar-legend"><span data-state="confirmed">ยืนยันแล้ว</span><span data-state="pending">รอตรวจสอบ</span><span data-state="staying">ช่วงเข้าพัก</span><span data-state="closed">ปิดรับจอง</span></div></div>
    <div className="dashboard-section-head"><div className="actions">
      <Link className="button secondary" href={url({day:move(-1)})} scroll={false} aria-label="ช่วงก่อนหน้า">‹</Link>
      <form action="/admin" className="dashboard-calendar-date"><input type="hidden" name="section" value="dashboard"/><input type="hidden" name="mode" value={filters.mode}/><input type="hidden" name="from" value={filters.from}/><input type="hidden" name="to" value={filters.to}/><input aria-label="วันที่ในปฏิทิน" type="date" name="day" defaultValue={filters.day} key={filters.day} required/><button className="button secondary">ไป</button></form>
      <Link className="button secondary" href={url({day:move(1)})} scroll={false} aria-label="ช่วงถัดไป">›</Link></div>
      <nav className="actions" aria-label="รูปแบบปฏิทิน">{[['month','เดือน'],['week','สัปดาห์'],['day','วัน']].map(([mode,label])=><Link key={mode} className={'button'+(mode===filters.mode?'':' secondary')} aria-current={mode===filters.mode?'true':undefined} href={url({mode})} scroll={false}>{label}</Link>)}</nav>
    </div>
    <p className="small muted">คลิกชื่อโซนเพื่อดูรายล็อก · ตัวเลขคือจำนวนที่จอง / จำนวนทั้งหมดต่อคืน · กดชื่อผู้จองเพื่อจัดการรายการ</p>
    <div className="dashboard-calendar-scroll" tabIndex={0} role="region" aria-label="ตารางการจองแยกโซน"><table className="dashboard-calendar-table"><thead><tr><th scope="col">โซน / ล็อก</th>{dates.map(day=><th key={day} scope="col" data-today={day===current}><time dateTime={day}>{dateLabel.format(new Date(day))}</time></th>)}</tr></thead>
      <tbody>{zones.map(zone=>{const items=inventory.filter(i=>i.zone===zone),open=expanded.includes(zone);return <ZoneRows key={zone} {...{zone,items,open,dates,indexed,closed,current}} toggle={()=>setExpanded(open?expanded.filter(z=>z!==zone):[...expanded,zone])}/>})}</tbody></table>
      {!inventory.length&&<p className="dashboard-empty">ยังไม่มีล็อกหรือห้องพัก</p>}
    </div>
  </section>
}
function ZoneRows({zone,items,open,dates,indexed,closed,current,toggle}) {
  const capacity=items.filter(i=>i.active).reduce((n,i)=>n+Number(i.stock),0)
  return <><tr className="dashboard-zone-row"><th scope="row"><button type="button" onClick={toggle} aria-expanded={open} className="dashboard-zone-toggle"><AdminIcon name={open?'down':'right'}/>{zone==='BOX'?'Trunkbox':'โซน '+zone}<small>{items.length} รายการ</small></button></th>
    {dates.map(day=>{const bookings=items.filter(i=>i.active).flatMap(i=>indexed.get(i.code+'|'+day)||[]),used=bookings.reduce((n,b)=>n+Number(b.quantity),0),unavailable=closed(day)||!capacity;return <td key={day} data-state={unavailable?'closed':used>=capacity?'full':used?'confirmed':'free'}><button type="button" onClick={toggle} aria-label={`ดูรายล็อก ${zone} ${day}`} className="dashboard-zone-count">{unavailable?'ปิดรับจอง':`${used} / ${capacity}`}<small>{unavailable?(closed(day)?.label||'ปิดใช้งาน'):used>=capacity?'เต็ม':`ว่าง ${capacity-used}`}</small></button></td>})}</tr>
    {open&&items.map(item=><tr key={item.code}><th scope="row">{item.name}</th>{dates.map(day=>{const bookings=indexed.get(item.code+'|'+day)||[],unavailable=!item.active||closed(day);return <td key={day} data-state={unavailable?'closed':bookings.length?'booked':'free'}>
      {bookings.map(b=>{const state=b.completed_at?'done':b.status==='pending'?'pending':b.arrival<=current&&b.departure>current?'staying':'confirmed';return <Link key={b.id} className="dashboard-calendar-booking" data-state={state} href={adminUrl('bookings',{q:b.id,view:b.id})} title={`${b.guest} · ${b.arrival} ถึง ${b.departure} · ${statusLabel[state]}`}>{b.guest}<small>{statusLabel[state]}</small></Link>})}
      {unavailable&&<small>{closed(day)?.label||'ปิดใช้งาน'}</small>}{!bookings.length&&!unavailable&&<span className="muted small">ว่าง {item.stock}</span>}</td>})}</tr>)}
  </>
}
export function DashboardReports({rows}) {
  const [mode,setMode]=useState('month'),[page,setPage]=useState(0)
  const grouped=new Map()
  for(const row of rows) {const key=mode==='month'?row.day.slice(0,7):row.day,existing=grouped.get(key)||{day:key,bookings:0,amount:0};existing.bookings+=Number(row.bookings);existing.amount+=Number(row.amount);grouped.set(key,existing)}
  const data=[...grouped.values()],pages=Math.max(1,Math.ceil(data.length/10))
  return <section className="panel stack"><div className="dashboard-section-head"><h2>รายงานรายได้ค่าจอง</h2><div className="actions">{[['day','รายวัน'],['month','รายเดือน']].map(([value,label])=><button key={value} type="button" className={'button'+(mode===value?'':' secondary')} aria-pressed={mode===value} onClick={()=>{setMode(value);setPage(0)}}>{label}</button>)}</div></div>
    <p className="small muted">ตามวันเช็กอิน · ยืนยันแล้ว หลังหักส่วนลด ไม่รวมค่าใช้จ่าย Check-out</p><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>ช่วงเวลา</th><th>รายการจอง</th><th>ยอดค่าจอง</th></tr></thead><tbody>{data.slice(page*10,page*10+10).map(row=><tr key={row.day}><td>{row.day}</td><td>{row.bookings.toLocaleString('th-TH')}</td><td>{row.amount.toLocaleString('th-TH')} บาท</td></tr>)}{!data.length&&<tr><td colSpan={3}>ไม่มีรายการในช่วงวันที่เลือก</td></tr>}</tbody></table></div>
    {pages>1&&<div className="actions"><button className="button secondary" disabled={!page} onClick={()=>setPage(page-1)}>ก่อนหน้า</button><span>{page+1} / {pages}</span><button className="button secondary" disabled={page+1>=pages} onClick={()=>setPage(page+1)}>ถัดไป</button></div>}
  </section>
}
