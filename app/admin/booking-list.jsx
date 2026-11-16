import { SlipDialog } from './slip-dialog'
import { slipArchivedMime } from './booking-backup-data'
import { Fragment } from 'react'
import Link, { ActionForm, AdminSearchForm } from '../pending-ui'
import { database } from '../../lib/db'
import { money, statuses } from '../../lib/pricing'
import { adminUrl } from './navigation'
import { BookingStatusActions } from './booking-status-actions'
import { AdminDialog } from './admin-dialog'
import { bookingItems, BookingItemsTable } from './booking-items'
import { RescheduleHistory } from '../booking/reschedule-history'
import { bookingFilters, bookingStats, bookingRows, bookingExpansion, bookingSorts } from './booking-list-data'
import { BookingFilters, BookingPageSize } from './booking-controls'
import { AdminIcon } from './admin-icon'
import { saveBookingNote } from './actions'

// Database times are UTC strings; shown in Thai time so the admin can match them with the time on the transfer slip.
const thaiDateTime=value=>value?new Date(String(value).replace(' ','T')+'Z').toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'})+' น.':'—'
// Stay as one line for the phone card: 28/11/2026 – 29/11/2026 · 1 คืน
const shortDate=value=>value.split('-').reverse().join('/')
const filterStatuses={...statuses,review:'รอตรวจสลิป'}
function Status({row}) {
  return <span className={'admin-status '+row.status}>{row.status==='pending' && row.payment_required
    ? row.submitted_at?'รอตรวจสลิป':'รอชำระเงิน':statuses[row.status]}</span>
}
function StatusActions({row,filters,page}) {
  return <BookingStatusActions booking={row} filters={filters} page={page}/>
}

export async function BookingList({query}) {
  const filters=bookingFilters(query)
  const [stats,[[policy]]]=await Promise.all([bookingStats(filters),database().query('SELECT reschedule_limit FROM settings WHERE id=1')])
  const pages=Math.max(1,Math.ceil(Number(stats.total)/filters.size))
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(Number(query.page))?Number(query.page):1))
  const rows=await bookingRows(filters,(page-1)*filters.size)
  const current={...filters,page}
  const all=query.expand==='all'
  const expanded=rows.filter(row=>all||row.id===query.expand)
  const detail=rows.find(row=>row.id===query.view)
  const expansions=await bookingExpansion([...new Set([...expanded.map(row=>row.id),...(detail?[detail.id]:[])])])
  const [items,[[rejection]]]=await Promise.all([
    detail?bookingItems(detail.id):[],
    detail?database().execute('SELECT 1 FROM duplicate_slip_events WHERE booking=? LIMIT 1',[detail.id]):[[]],
  ])
  const pageNumbers=[...new Set([1,...Array.from({length:5},(_,i)=>page+i-2).filter(n=>n>0&&n<=pages),pages])].sort((a,b)=>a-b)
  return <div className="stack booking-list-page">
    <div className="booking-stat-grid" aria-label="สรุปตามตัวกรองที่เลือก ไม่รวมค่าใช้จ่ายเพิ่มตอน Check-out" title="สรุปตามตัวกรองที่เลือก · ยอดยืนยันไม่รวมค่าใช้จ่ายเพิ่มตอน Check-out">
      {[['รายการจองที่พบ',stats.total,'all'],['รอตรวจสลิป',stats.review,'pending'],['ยืนยันแล้ว',stats.confirmed,'confirmed'],['ยอดรวมที่ยืนยันแล้ว',money(stats.revenue),'revenue']].map(([label,value,tone])=>
        <section className={'booking-stat '+tone} key={tone}><div><span>{label}</span><strong>{value}</strong></div><span className="booking-stat-icon"><AdminIcon name={tone}/></span></section>)}
    </div>
    <BookingFilters key={JSON.stringify(filters)} filters={filters} open={query.from!==undefined||query.to!==undefined} statuses={filterStatuses} sorts={bookingSorts}/>
    <div className="admin-table-toolbar">
      <div className="actions"><span>แสดง {rows.length} รายการในหน้านี้</span><Link href={adminUrl('bookings',{...current,expand:all?'':'all'})} scroll={false}>{all?'⌃ ย่อทุกแถว':'⌄ ขยายดูสรุปทุกแถว'}</Link></div>
      <nav className="admin-filter-tabs" aria-label="กรองสถานะ">{[['','ทั้งหมด'],...Object.entries(statuses)].map(([key,label])=>
        <Link key={key} href={adminUrl('bookings',{...filters,status:key,from:undefined,to:undefined})} aria-current={filters.status===key?'page':undefined}>{label}</Link>)}</nav>
    </div>
    <div className="booking-table-shell">
      <div className="admin-table-scroll booking-table-scroll" tabIndex={0} aria-label="ตารางรายการจอง"><table className="admin-table booking-table">
        <thead><tr>{['รหัสจอง','ผู้จอง','เช็กอิน','เช็กเอาต์','สรุปรายการจอง','ยอดรวม','สถานะ','จัดการ'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(row=>{
          const open=expanded.some(item=>item.id===row.id)
          const info=expansions.get(row.id)
          const nights=(Date.parse(row.departure)-Date.parse(row.arrival))/86400000
          return <Fragment key={row.id}><tr data-expanded={open||undefined}>
            <td data-label="รหัสจอง" className="bk-code"><div className="admin-booking-id"><Link className="admin-expand-booking" href={adminUrl('bookings',{...current,expand:open?'':row.id})} scroll={false}
              aria-expanded={open} aria-label={(open?'ย่อ ':'ขยาย ')+row.id}>{open?'⌄':'›'}</Link><div><code>{row.reference||row.id}</code><small className={row.reschedule_count?'booking-moved':''}>เลื่อน {row.reschedule_count}/{policy.reschedule_limit} ครั้ง</small></div></div></td>
            <td data-label="ผู้จอง" className="bk-guest"><strong>{row.guest}</strong><br/><small className="bk-phone">{row.phone==='-'?'':row.phone}</small><br/><span className="booking-made-at">จอง/โอนเงิน<strong>{thaiDateTime(row.created_at)}</strong></span></td>
            <td data-label="เช็กอิน" className="admin-booking-date bk-in"><span className="bk-date">{row.arrival}</span><span className="bk-stay">{shortDate(row.arrival)} – {shortDate(row.departure)} · {nights} คืน</span></td><td data-label="เช็กเอาต์" className="admin-booking-date bk-out">{row.departure}</td>
            <td data-label="รายการ" className="bk-items"><div className="admin-item-badges">{Number(row.lodging_count)>0&&<span className="lodging">ลาน / ห้อง ({row.lodging_count})</span>}{row.item_count-row.lodging_count>0&&<span className="rental">อุปกรณ์ ({row.item_count-row.lodging_count})</span>}</div>{row.admin_note&&<p className="booking-note-line" title={row.admin_note}><AdminIcon name="note"/>{row.admin_note}</p>}</td>
            <td data-label="ยอดรวม" className="admin-amount bk-total"><strong>{money(row.total)}</strong></td><td data-label="สถานะ" className="bk-status"><Status row={row}/></td>
            <td data-label="จัดการ" className="bk-actions"><div className="actions admin-row-actions"><Link className="button secondary" href={adminUrl('bookings',{...current,expand:query.expand,view:row.id})} scroll={false}>ดูรายละเอียด</Link><StatusActions row={row} filters={filters} page={page}/></div></td>
          </tr>{open&&<tr className="admin-expanded-row"><td colSpan={8}><div className="booking-expanded-grid">
            <section><h3>ลาน ห้องพัก และอุปกรณ์</h3>{info.items.map(item=><div className="booking-mini-line" key={item.code}><span>{item.name} × {item.quantity}</span><strong>{money(item.amount)}</strong></div>)}
              {row.tent_discount>0&&<p>ส่วนลดเต็นท์ −{money(row.tent_discount)}</p>}</section>
            <section><h3>การชำระเงินและการเข้าพัก</h3><p>พัก {nights} คืน</p><p>{row.submitted_at?'ส่งสลิปแล้ว':row.payment_required?'ยังไม่ได้ส่งสลิป':'ไม่มีรายการชำระผ่านสลิปในระบบ'}</p>
              {!!row.has_slip&&<SlipDialog id={row.id} mime={row.slip_mime}/>}<p><Status row={row}/></p></section>
            <section><h3>ประวัติการเลื่อน</h3><RescheduleHistory history={info.history} embedded/>{!info.history.length&&<p className="muted">ยังไม่มีประวัติการเลื่อน</p>}</section>
            <section className="booking-note-section"><h3>หมายเหตุของแอดมิน</h3>{row.admin_note?<p className="booking-note-text">{row.admin_note}</p>:<p className="muted">ยังไม่มีหมายเหตุ</p>}
              <Link href={adminUrl('bookings',{...current,expand:query.expand,view:row.id})+'#booking-note'} scroll={false}>{row.admin_note?'แก้ไขหมายเหตุ':'เพิ่มหมายเหตุ'}</Link></section>
          </div></td></tr>}</Fragment>
        })}{!rows.length&&<tr><td colSpan={8} className="admin-empty-cell">ไม่พบรายการจองตามตัวกรอง <Link href={adminUrl('bookings')}>ล้างตัวกรอง</Link></td></tr>}</tbody>
      </table></div>
      <footer className="booking-pagination">
        <AdminSearchForm key={'size-'+JSON.stringify(filters)} className="actions"><input type="hidden" name="section" value="bookings"/>
          {Object.entries(filters).filter(([key])=>key!=='size').map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
          <label>แสดงแถวต่อหน้า:<BookingPageSize value={filters.size}/></label>
          <span className="muted">จากทั้งหมด {stats.total} รายการ</span></AdminSearchForm>
        <nav className="actions" aria-label="แบ่งหน้ารายการจอง">
          {page>1?<Link className="button secondary" href={adminUrl('bookings',{...filters,page:page-1})}>ก่อนหน้า</Link>:<button className="button secondary" disabled>ก่อนหน้า</button>}
          {pageNumbers.map((number,index)=><Fragment key={number}>{index>0&&number>pageNumbers[index-1]+1&&<span>…</span>}<Link className={'button'+(number===page?'':' secondary')} aria-current={number===page?'page':undefined} href={adminUrl('bookings',{...filters,page:number})}>{number}</Link></Fragment>)}
          {page<pages?<Link className="button secondary" href={adminUrl('bookings',{...filters,page:page+1})}>ถัดไป</Link>:<button className="button secondary" disabled>ถัดไป</button>}
        </nav>
      </footer>
    </div>
    {detail&&<AdminDialog title="รายละเอียดการจอง" closeUrl={adminUrl('bookings',{...current,expand:query.expand})}>
      <dl className="admin-booking-detail"><div><dt>รหัสจอง</dt><dd><code>{detail.reference||detail.id}</code></dd></div><div><dt>ผู้จอง</dt><dd>{detail.guest}</dd></div><div><dt>เบอร์โทร</dt><dd>{detail.phone}</dd></div><div><dt>วันเข้าพัก – วันออก</dt><dd>{detail.arrival} → {detail.departure}</dd></div><div><dt>สถานะ</dt><dd><Status row={detail}/></dd></div><div><dt>จำนวนครั้งที่เลื่อน</dt><dd>{detail.reschedule_count}/{policy.reschedule_limit} ครั้ง</dd></div></dl>
      {/* Admin-only note: plain text, saved on its own so nothing else on the booking changes. */}
      <ActionForm action={saveBookingNote} className="booking-note-form" id="booking-note">
        <input type="hidden" name="id" value={detail.id}/><input type="hidden" name="q" value={filters.q}/><input type="hidden" name="filterStatus" value={filters.status}/>
        {['from','to','madeFrom','madeTo','kind','sort','size'].map(key=><input key={key} type="hidden" name={key} value={filters[key]}/>)}<input type="hidden" name="page" value={page}/><input type="hidden" name="expand" value={query.expand||''}/>
        <label>หมายเหตุของแอดมิน <small>ลูกค้าไม่เห็นข้อความนี้</small>
          <textarea name="note" rows={3} maxLength={1000} defaultValue={detail.admin_note||''} placeholder="เช่น รับมัดจำแล้ว 750 บาท · ลูกค้าพาสุนัขมา 2 ตัว"/></label>
        <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกหมายเหตุ</button></div>
      </ActionForm>
      <RescheduleHistory history={expansions.get(detail.id).history}/>
      {!!detail.has_slip&&<SlipDialog id={detail.id} mime={detail.slip_mime}/>}
      {/* Slip sent but its image was removed after a backup (storage page, step 2). */}
      {detail.slip_mime===slipArchivedMime&&<p className="notice">รูปสลิปของรายการนี้ถูกลบออกจากระบบหลังสำรองข้อมูลแล้ว เปิดดูได้จากไฟล์สำรองในโฟลเดอร์ slips ชื่อไฟล์ {detail.reference||detail.id}</p>}
      {/* Right above the slip, so the admin can compare it with the time printed on the slip. */}
      <p className="booking-time-field"><span>วันที่จอง (วันที่โอนเงิน)</span><strong>{thaiDateTime(detail.created_at)}</strong></p>
      {detail.slip_mime?.startsWith('image/')&&<img loading="lazy" decoding="async" className="admin-slip-preview" src={'/admin/slip/'+detail.id} alt="สลิปการโอนของรายการนี้"/>}
      {rejection&&<p className="notice error">ปฏิเสธการจองเนื่องจากใช้ไฟล์สลิปซ้ำ</p>}
      <BookingItemsTable items={items} label="รายการที่จองทั้งหมด"/>
      {detail.tent_discount>0&&<p>ส่วนลดค่าเช่าเต็นท์ −{money(detail.tent_discount)}</p>}
      <div className="admin-detail-total"><span>ยอดรวมสุทธิ</span><strong>{money(detail.total)}</strong></div>
      <div className="admin-detail-actions"><StatusActions row={detail} filters={filters} page={page}/></div>
    </AdminDialog>}
  </div>
}
