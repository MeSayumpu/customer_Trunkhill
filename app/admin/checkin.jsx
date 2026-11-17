import { AdminIcon } from './admin-icon'
import Link, { AdminSearchForm } from '../pending-ui'
import { today } from '../../lib/camp'
import { money } from '../../lib/pricing'
import { AdminDialog } from './admin-dialog'
import { bookingItems, BookingItemsTable } from './booking-items'
import { saveCheckin } from './checkin-actions'
import { checkinAdded, checkinCursor, checkinDetail, checkinFilters, checkinGear, checkinGuestMax, checkinItemMax, checkinNights, checkinNoteMax,
  checkinPageSize, checkinPosition, checkinRows, checkinStatuses } from './checkin-data'
import { CheckinForm } from './checkin-form'
import { checkoutSummaries } from './checkout-data'
import { adminUrl } from './navigation'

const shortDate = value => value.split('-').reverse().join('/')
const thaiDateTime = value => new Date(String(value).replace(' ','T') + 'Z')
  .toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}) + ' น.'
const rentalsShown = 3

async function CheckinDialog({booking, query}) {
  const date = today()
  const nights = checkinNights(booking,date)
  const open = !booking.checked_out && booking.arrival <= date
  const [items, added, gear] = await Promise.all([bookingItems(booking.id),checkinAdded(booking.id),open ? checkinGear(nights) : []])
  return <AdminDialog title="Check-in" closeUrl={adminUrl('checkin',query)}>
    <dl className="admin-booking-detail checkout-guest">
      <div><dt>ชื่อผู้จอง</dt><dd>{booking.guest}</dd></div>
      <div><dt>เบอร์โทร</dt><dd>{booking.phone}</dd></div>
      <div><dt>วันเข้าพัก – วันออก</dt><dd>{booking.arrival} → {booking.departure}</dd></div>
      <div><dt>รหัสจอง</dt><dd><code>{booking.reference || booking.id}</code></dd></div>
      {booking.checked_in_at && <div className="checkout-guest-count"><dt>เวลา Check-in</dt><dd><strong>{thaiDateTime(booking.checked_in_at)}</strong><br/>
        <small>จองไว้ ผู้ใหญ่ {booking.booked_adults} · เด็ก {booking.booked_children} · ผู้สูงอายุ {booking.booked_seniors}</small></dd></div>}
    </dl>
    <div className="checkout-body"><BookingItemsTable items={items} label="รายการที่จอง"/></div>
    <CheckinForm key={booking.id + ':' + added.length + ':' + (booking.checked_in_at || '')}
      action={saveCheckin.bind(null,booking.id,query)}
      booking={{ adults:booking.adults, children:booking.children, seniors:booking.seniors, checkin_note:booking.checkin_note,
        checked_in_at:booking.checked_in_at, checked_out:Boolean(booking.checked_out), added_amount:booking.added_amount ?? 0 }}
      gear={gear.map(({code,name,price,available,is_tent}) => ({code,name,price,available,tent:Boolean(is_tent)}))} nights={nights.length}
      added={added.map(({name,quantity,unit_price,nights,amount}) => ({name,quantity,unit_price,nights,amount}))}
      canCheckin={booking.arrival <= date} checkoutUrl={adminUrl('checkout',{view:booking.id})}
      noteMax={checkinNoteMax} guestMax={checkinGuestMax} itemMax={checkinItemMax}/>
  </AdminDialog>
}

// Confirmed bookings waiting to arrive (soonest first), then the check-in itself in a dialog.
// The list uses the same table/card layout as the check-out list.
export async function CheckinList({query}) {
  const filters = checkinFilters(query)
  const position = checkinPosition(query)
  const current = { ...filters,...position }
  const date = today()
  const [rows, detail] = await Promise.all([checkinRows(filters,position),checkinDetail(query.view)])
  const page = rows.slice(0,checkinPageSize)
  const summaries = await checkoutSummaries(page)
  const more = rows.length > checkinPageSize
  if (position.before) page.reverse()
  const previous = position.before ? more : Boolean(position.after)
  const next = position.before ? Boolean(page.length) : more
  return <section className="panel stack admin-content checkout-list">
    <AdminSearchForm key={new URLSearchParams(filters).toString()} className="admin-filters checkout-filters">
      <input type="hidden" name="section" value="checkin"/>
      <label>วันเช็กอินตั้งแต่<input type="date" name="from" defaultValue={filters.from}/></label>
      <label>ถึงวันที่<input type="date" name="to" defaultValue={filters.to}/></label>
      <label>ชื่อผู้จอง / เบอร์โทร / รหัสจอง<input name="q" defaultValue={filters.q} maxLength={120}/></label>
      <label>สถานะ<select name="status" defaultValue={filters.status}>
        {Object.entries(checkinStatuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="button"><AdminIcon name="search"/>ค้นหา</button>
    </AdminSearchForm>
    <div className="admin-table-scroll checkout-table-scroll" tabIndex={0} aria-label="ตารางรายการ Check-in">
      <table className="admin-table checkout-table">
        <thead><tr>{['Check-in','วันที่','ล็อก / ห้อง','อุปกรณ์','ผู้จอง','สถานะ','ยอดค่าจอง'].map(label =>
          <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{page.map(row => {
          const { lodging, rentals } = summaries.get(row.id)
          const nights = (Date.parse(row.departure) - Date.parse(row.arrival)) / 86400000
          // When the guests are due: today, or already past the arrival day without a check-in.
          // A stay closed by check-out is finished, including older ones checked out before check-in existed.
          const finished = Boolean(row.checked_out), arrived = Boolean(row.checked_in_at) || finished
          const due = arrived ? '' : row.arrival === date ? 'เข้าวันนี้' : row.arrival < date ? 'เลยวันเข้าพัก' : ''
          return <tr key={row.id}>
            <td data-label="จัดการ" className="co-action"><Link className="button secondary" scroll={false} href={adminUrl('checkin',{...current,view:row.id})}
              aria-label={(arrived ? 'ดู Check-in ของ ' : 'เปิด Check-in ของ ') + row.guest}>
              {arrived ? 'ดูรายละเอียด' : 'เปิด Check-in'}</Link></td>
            <td data-label="วันที่" className="admin-booking-date co-date"><span className="co-date-wide"><strong>{row.arrival}</strong><br/><small>ออก {row.departure}</small></span>
              <span className="co-stay">เข้า <strong>{shortDate(row.arrival)}</strong> · ออก {shortDate(row.departure)} · {nights} คืน</span></td>
            <td data-label="ล็อก / ห้อง" className="co-lodging">{lodging.join(', ') || '—'}</td>
            <td data-label="อุปกรณ์" className={'co-rentals' + (rentals.length ? '' : ' co-empty')}>{rentals.length > 0 ? <ul title={rentals.join('\n')}>
              {rentals.slice(0,rentalsShown).map((item,index) => <li key={index}>{item}</li>)}
              {rentals.length > rentalsShown && <li className="co-more">และอีก {rentals.length - rentalsShown} รายการ</li>}</ul> : '—'}</td>
            <td data-label="ผู้จอง" className="co-guest"><strong>{row.guest}</strong><br/><small className="co-phone">{row.phone === '-' ? '' : row.phone}</small>
              {row.reference && <small className="co-ref">{row.reference}</small>}</td>
            <td data-label="สถานะ" className="co-status"><span className={'admin-status ' + (arrived ? 'confirmed' : 'pending')}>
              {finished ? 'Check-out แล้ว' : row.checked_in_at ? checkinStatuses.done : checkinStatuses.open}</span>
              {due && <span className={'checkin-due' + (row.arrival < date ? ' late' : '')}>{due}</span>}
              {row.checked_in_at && <><br/><small>{thaiDateTime(row.checked_in_at)}</small></>}</td>
            <td data-label="ยอดค่าจอง" className="admin-amount co-amount"><strong>{money(row.total)}</strong></td>
          </tr>
        })}
        {!page.length && <tr><td colSpan={7} className="admin-empty-cell">ไม่พบรายการ Check-in</td></tr>}
        </tbody>
      </table>
    </div>
    {(previous || next || (!page.length && position.before)) && <nav className="admin-pagination actions" aria-label="แบ่งหน้ารายการ">
      {(previous || !page.length) && <Link className="button secondary" href={adminUrl('checkin',page.length
        ? {...filters,before:checkinCursor(page[0])} : filters)}>← หน้าก่อนหน้า</Link>}
      {next && page.length > 0 && <Link className="button secondary" href={adminUrl('checkin',{...filters,after:checkinCursor(page.at(-1))})}>หน้าถัดไป →</Link>}
    </nav>}
    {detail && <CheckinDialog booking={detail} query={current}/>}
  </section>
}
