import { SlipDialog } from './slip-dialog'
import { Fragment } from 'react'
import Link, { AdminSearchForm } from '../pending-ui'
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
    <BookingFilters key={JSON.stringify(filters)} filters={filters} statuses={filterStatuses} sorts={bookingSorts}/>
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
            <td data-label="รหัสจอง"><div className="admin-booking-id"><Link className="admin-expand-booking" href={adminUrl('bookings',{...current,expand:open?'':row.id})} scroll={false}
              aria-expanded={open} aria-label={(open?'ย่อ ':'ขยาย ')+row.id}>{open?'⌄':'›'}</Link><div><code>{row.reference||row.id}</code><small className={row.reschedule_count?'booking-moved':''}>เลื่อน {row.reschedule_count}/{policy.reschedule_limit} ครั้ง</small></div></div></td>
            <td data-label="ผู้จอง"><strong>{row.guest}</strong><br/><small>{row.phone}</small></td>
            <td data-label="เช็กอิน" className="admin-booking-date">{row.arrival}</td><td data-label="เช็กเอาต์" className="admin-booking-date">{row.departure}</td>
            <td data-label="รายการ"><div className="admin-item-badges">{Number(row.lodging_count)>0&&<span className="lodging">ลาน / ห้อง ({row.lodging_count})</span>}{row.item_count-row.lodging_count>0&&<span className="rental">อุปกรณ์ ({row.item_count-row.lodging_count})</span>}</div></td>
            <td data-label="ยอดรวม" className="admin-amount"><strong>{money(row.total)}</strong></td><td data-label="สถานะ"><Status row={row}/></td>
            <td data-label="จัดการ"><div className="actions admin-row-actions"><Link className="button secondary" href={adminUrl('bookings',{...current,expand:query.expand,view:row.id})} scroll={false}>ดูรายละเอียด</Link><StatusActions row={row} filters={filters} page={page}/></div></td>
          </tr>{open&&<tr className="admin-expanded-row"><td colSpan={8}><div className="booking-expanded-grid">
            <section><h3>ลาน ห้องพัก และอุปกรณ์</h3>{info.items.map(item=><div className="booking-mini-line" key={item.code}><span>{item.name} × {item.quantity}</span><strong>{money(item.amount)}</strong></div>)}
              {row.tent_discount>0&&<p>ส่วนลดเต็นท์ −{money(row.tent_discount)}</p>}</section>
            <section><h3>การชำระเงินและการเข้าพัก</h3><p>พัก {nights} คืน</p><p>{row.submitted_at?'ส่งสลิปแล้ว':row.payment_required?'ยังไม่ได้ส่งสลิป':'ไม่มีรายการชำระผ่านสลิปในระบบ'}</p>
              {!!row.has_slip&&<SlipDialog id={row.id} mime={row.slip_mime}/>}<p><Status row={row}/></p></section>
            <section><h3>ประวัติการเลื่อน</h3><RescheduleHistory history={info.history} embedded/>{!info.history.length&&<p className="muted">ยังไม่มีประวัติการเลื่อน</p>}</section>
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
      <RescheduleHistory history={expansions.get(detail.id).history}/>
      {!!detail.has_slip&&<SlipDialog id={detail.id} mime={detail.slip_mime}/>}
      {detail.slip_mime?.startsWith('image/')&&<img loading="lazy" decoding="async" className="admin-slip-preview" src={'/admin/slip/'+detail.id} alt="สลิปการโอนของรายการนี้"/>}
      {rejection&&<p className="notice error">ปฏิเสธการจองเนื่องจากใช้ไฟล์สลิปซ้ำ</p>}
      <BookingItemsTable items={items} label="รายการที่จองทั้งหมด"/>
      {detail.tent_discount>0&&<p>ส่วนลดค่าเช่าเต็นท์ −{money(detail.tent_discount)}</p>}
      <div className="admin-detail-total"><span>ยอดรวมสุทธิ</span><strong>{money(detail.total)}</strong></div>
      <div className="admin-detail-actions"><StatusActions row={detail} filters={filters} page={page}/></div>
    </AdminDialog>}
  </div>
}
