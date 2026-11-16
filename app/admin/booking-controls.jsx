'use client'
import { useState } from 'react'
import Link, { AdminSearchForm } from '../pending-ui'
import { adminUrl } from './navigation'
import { AdminIcon } from './admin-icon'
// The extra filters start open only when the admin has set one; the default check-in range alone keeps them folded.
export function BookingFilters({filters,statuses,sorts,open:picked=false}) {
  const [open,setOpen]=useState(!!(picked||filters.madeFrom||filters.madeTo||filters.kind||filters.sort!=='newest'))
  return <AdminSearchForm className="booking-search">
    <input type="hidden" name="section" value="bookings"/><input type="hidden" name="size" value={filters.size}/>
    <div className="booking-search-main">
      <label>ค้นหารายการจอง<input name="q" defaultValue={filters.q} maxLength={120} placeholder="ชื่อขึ้นต้น เบอร์โทร หรือรหัสจอง"/></label>
      <label>สถานะ<select name="status" defaultValue={filters.status}><option value="">ทุกสถานะ</option>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <button className="button"><AdminIcon name="search"/>ค้นหา</button>
      <button className="button secondary booking-filter-toggle" type="button" aria-expanded={open} aria-controls="booking-extra-filters" onClick={()=>setOpen(!open)}>
        <AdminIcon name="filter"/>ตัวกรองเพิ่ม</button>
    </div>
    <div id="booking-extra-filters" className="booking-extra-filters" hidden={!open}>
      <div className="booking-filter-grid">
        <label>เช็กอินตั้งแต่<input type="date" name="from" defaultValue={filters.from}/></label>
        <label>เช็กอินถึง<input type="date" name="to" defaultValue={filters.to}/></label>
        <label>วันที่จอง/โอนเงิน ตั้งแต่<input type="date" name="madeFrom" defaultValue={filters.madeFrom}/></label>
        <label>วันที่จอง/โอนเงิน ถึง<input type="date" name="madeTo" defaultValue={filters.madeTo}/></label>
        <label>ประเภทรายการ<select name="kind" defaultValue={filters.kind}><option value="">ทั้งหมด (ลาน/ห้อง &amp; อุปกรณ์)</option><option value="lodging">มีลาน / ห้องพัก</option><option value="rental">มีอุปกรณ์ / บริการเสริม</option></select></label>
        <label>เรียงลำดับ<select name="sort" defaultValue={filters.sort}>{Object.entries(sorts).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <Link href={adminUrl('bookings')} className="button secondary">ล้างตัวกรองทั้งหมด</Link>
      </div>
    </div>
    {((filters.from&&filters.to&&filters.from>filters.to)||(filters.madeFrom&&filters.madeTo&&filters.madeFrom>filters.madeTo))&&<p className="notice error">วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด</p>}
  </AdminSearchForm>
}
export function BookingPageSize({value}) {
  return <select name="size" defaultValue={value} onChange={event=>event.currentTarget.form.requestSubmit()}>{[10,20,50,100].map(size=><option key={size}>{size}</option>)}</select>
}
