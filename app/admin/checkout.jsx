
import { AdminIcon } from './admin-icon'
import Link, { AdminSearchForm } from '../pending-ui'
import { today } from '../../lib/camp'
import { checkoutDue, electricityFormula, extraCharge } from '../../lib/checkout-pricing'
import { lodgingGuests, money } from '../../lib/pricing'
import { checkoutQr } from '../../lib/promptpay'
import { AdminDialog } from './admin-dialog'
import { bookingItems } from './booking-items'
import { saveCheckout } from './checkout-actions'
import { checkoutCursor, checkoutDetail, checkoutFilters, checkoutPageSize, checkoutPosition, checkoutRows, checkoutSettings, checkoutStatuses, checkoutSummaries, pricingMode } from './checkout-data'
import { CheckoutForm, CheckoutSettingsForm } from './checkout-form'
import { adminUrl } from './navigation'

const shortDate = value => value.split('-').reverse().join('/')
// Gear lines shown per booking in the list; the rest is counted, and the full list is in the Check-out dialog.
const rentalsShown = 3

const guestKinds = [['adults','ผู้ใหญ่'],['seniors','ผู้สูงอายุ'],['children','เด็ก']]
const guestText = counts => guestKinds.filter(([key]) => counts[key] > 0).map(([key,label]) => label + ' ' + counts[key] + ' คน').join(' · ')

// What was booked, one line per lock so the list stays short: its guests (from lodgingGuests, or nothing when guests
// are not billed per lock), its price, and under it the equipment rented for that lock.
function CheckoutItems({items, nights, guests}) {
  const lodging = items.filter(item => item.lodging)
  const rentals = items.filter(item => !item.lodging)
  const unassigned = rentals.flatMap(item => {
    const quantity = item.quantity - item.assignments.reduce((sum, assignment) => sum + assignment.quantity,0)
    return quantity > 0 ? [{ ...item, quantity, amount:Math.round(item.amount * quantity / item.quantity) }] : []
  })
  const free = guests && guestText(guests.free)
  return <div className="checkout-body">
    <section className="checkout-item checkout-booked">
      <h3>รายการที่จอง <small>{nights} คืน</small></h3>
      {lodging.map(site => {
        const attached = rentals.flatMap(item => {
          const assignment = item.assignments.find(row => row.host_code === site.code)
          if (!assignment) return []
          return [{ ...item, quantity:assignment.quantity, amount:Math.round(item.amount * assignment.quantity / item.quantity) }]
        })
        return <div className="checkout-booked-site" key={site.code}>
          <div className="checkout-booked-row">
            <span className="checkout-booked-name"><strong>{site.name}</strong>{site.detail && site.detail !== site.name && <small>{site.detail}</small>}</span>
            <span className="checkout-site-guests">{guests?.byCode.has(site.code) && (guestText(guests.byCode.get(site.code)) || 'ไม่มีผู้ที่คิดค่าล็อก')}</span>
            <strong>{money(site.amount)}</strong>
          </div>
          {attached.map(item => <div className="checkout-booked-row checkout-booked-sub" key={item.code}>
            <span>+ {item.name} × {item.quantity}</span><span/><span>{money(item.amount)}</span></div>)}
          {attached.length > 0 && <div className="checkout-booked-row checkout-booked-sub">
            <span>รวม {site.name}</span><span/><strong>{money(site.amount + attached.reduce((sum,item) => sum + item.amount,0))}</strong></div>}
        </div>
      })}
      {free && <div className="checkout-booked-row checkout-booked-info">
        <span>ไม่คิดค่าล็อก · ไม่นับเป็นหน่วยไฟฟรี</span><span className="checkout-site-guests">{free}</span><span/></div>}
      {unassigned.length > 0 && <div className="checkout-booked-site">
        <div className="checkout-booked-row checkout-booked-info"><span>อุปกรณ์และบริการอื่น ๆ</span><span/><span/></div>
        {unassigned.map(item => <div className="checkout-booked-row checkout-booked-sub" key={item.code}>
          <span>{item.name} × {item.quantity}</span><span/><span>{money(item.amount)}</span></div>)}
      </div>}
    </section>
  </div>
}

async function CheckoutDialog({booking, query, review}) {
  const [items, settings, mode] = await Promise.all([bookingItems(booking.id),checkoutSettings(),pricingMode()])
  // Who was billed on each lock in the booking as it was made (the booked counts, not guests added at check-in).
  const guests = lodgingGuests(items,{ adults:booking.booked_adults ?? booking.adults, seniors:booking.booked_seniors ?? booking.seniors,
    children:booking.booked_children ?? booking.children },mode)
  const formula = electricityFormula(booking,settings)
  const currentFormula = electricityFormula(booking,settings,true)
  const extra = checkoutDue(booking)
  // The number saved with the charges, or the one in the settings when it was set after they were saved.
  const recipient = booking.promptpay || settings.promptpay
  const qr = !booking.completed_at && extra > 0 && recipient ? await checkoutQr(recipient,extra) : null
  const nights = (Date.parse(booking.departure) - Date.parse(booking.arrival)) / 86400000
  const { promptpay, ...summary } = booking
  return <AdminDialog title="Check-out" closeUrl={adminUrl('checkout',query)}>
    <dl className="admin-booking-detail checkout-guest">
      <div><dt>ชื่อผู้จอง</dt><dd>{booking.guest}</dd></div>
      <div><dt>เบอร์โทร</dt><dd>{booking.phone}</dd></div>
      <div><dt>วันเข้าพัก – วันออก</dt><dd>{booking.arrival} → {booking.departure}</dd></div>
      <div><dt>รหัสจอง</dt><dd><code>{booking.reference||booking.id}</code></dd></div>
      <div className="checkout-guest-count"><dt>จำนวนผู้เข้าพัก</dt><dd><strong>{booking.guest_count} คน</strong>
        {booking.booked_adults != null && <span className="checkout-booked-guests"> · จองไว้ {booking.booked_adults + booking.booked_children + booking.booked_seniors} คน</span>}<br/>
        <small>ผู้ใหญ่ {booking.adults} · เด็ก {booking.children} · ผู้สูงอายุ {booking.seniors}</small>
      </dd></div>
    </dl>
    <CheckoutItems items={items} nights={nights} guests={guests}/>
    {booking.tent_discount > 0 && <div className="checkout-line checkout-discount-panel"><span>ส่วนลดค่าเช่าเต็นท์</span><strong>−{money(booking.tent_discount)}</strong></div>}
    <CheckoutForm key={booking.id + ':' + (booking.version ?? 0) + ':' + (booking.completed_at || '')}
      action={saveCheckout.bind(null,booking.id,query)} booking={summary}
      lodging={items.filter(item => item.lodging).map(({code,name}) => ({code,name,guests:guests?.byCode.get(code)?.paying}))} savedFormula={formula}
      currentFormula={currentFormula} qr={qr} canCharge={booking.arrival <= today()} review={review}/>
  </AdminDialog>
}

export async function CheckoutList({query}) {
  const filters = checkoutFilters(query)
  const position = checkoutPosition(query)
  const current = { ...filters,...position }
  const [rows, detail] = await Promise.all([checkoutRows(filters,position),checkoutDetail(query.view)])
  const page = rows.slice(0,checkoutPageSize)
  const summaries = await checkoutSummaries(page)
  const more = rows.length > checkoutPageSize
  if (position.before) page.reverse()
  const previous = position.before ? more : Boolean(position.after)
  const next = position.before ? Boolean(page.length) : more
  const exportQuery = new URLSearchParams(filters)
  return <section className="panel stack admin-content checkout-list">
    <AdminSearchForm key={exportQuery.toString()} className="admin-filters checkout-filters">
      <input type="hidden" name="section" value="checkout"/>
      <label>วันเช็กอินตั้งแต่<input type="date" name="from" defaultValue={filters.from}/></label>
      <label>ถึงวันที่<input type="date" name="to" defaultValue={filters.to}/></label>
      <label>ชื่อผู้จอง / เบอร์โทร / รหัสจอง<input name="q" defaultValue={filters.q} maxLength={120}/></label>
      <label>ล็อก / ห้อง<input name="plot" defaultValue={filters.plot} placeholder="เช่น A02" maxLength={24}/></label>
      <label>สถานะ<select name="status" defaultValue={filters.status}>
        {Object.entries(checkoutStatuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="button"><AdminIcon name="search"/>ค้นหา</button>
      <a className="button secondary" href={'/admin/checkout-export?' + exportQuery}><AdminIcon name="download"/>ส่งออก Excel</a>
    </AdminSearchForm>
    <div className="admin-table-scroll checkout-table-scroll" tabIndex={0} aria-label="ตารางรายการ Check-out">
      <table className="admin-table checkout-table">
        <thead><tr>{['Check-out','วันที่','ล็อก / ห้อง','อุปกรณ์','ผู้จอง','สถานะ / การชำระเงิน','จำนวนเงิน'].map(label =>
          <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{page.map(row => {
          const { lodging, rentals } = summaries.get(row.id)
          const extra = extraCharge(row), due = checkoutDue(row)
          const nights = (Date.parse(row.departure) - Date.parse(row.arrival)) / 86400000
          // The co-* classes place each cell in the phone card; on a wide screen the table is unchanged.
          return <tr key={row.id}>
            <td data-label="จัดการ" className="co-action"><Link className="button secondary" scroll={false} href={adminUrl('checkout',{...current,view:row.id})}
              aria-label={(row.completed_at ? 'ดู Check-out ของ ' : 'เปิด Check-out ของ ') + row.guest}>
              {row.completed_at ? 'ดูรายละเอียด' : 'เปิด Check-out'}</Link></td>
            <td data-label="วันที่" className="admin-booking-date co-date"><span className="co-date-wide"><strong>{row.departure}</strong><br/><small>เข้าพัก {row.arrival}</small></span>
              <span className="co-stay">ออก <strong>{shortDate(row.departure)}</strong> · เข้าพัก {shortDate(row.arrival)} · {nights} คืน</span></td>
            <td data-label="ล็อก / ห้อง" className="co-lodging">{lodging.join(', ') || '—'}</td>
            <td data-label="อุปกรณ์" className={'co-rentals' + (rentals.length ? '' : ' co-empty')}>{rentals.length > 0 ? <ul title={rentals.join('\n')}>
              {rentals.slice(0,rentalsShown).map((item,index) => <li key={index}>{item}</li>)}
              {rentals.length > rentalsShown && <li className="co-more">และอีก {rentals.length - rentalsShown} รายการ</li>}</ul> : '—'}</td>
            <td data-label="ผู้จอง" className="co-guest"><strong>{row.guest}</strong><br/><small className="co-phone">{row.phone === '-' ? '' : row.phone}</small>
              {row.reference && <small className="co-ref">{row.reference}</small>}</td>
            <td data-label="สถานะ" className="co-status"><span className={'admin-status ' + (row.completed_at ? 'confirmed' : 'pending')}>
              {row.completed_at ? checkoutStatuses.done : checkoutStatuses.open}</span>
              {due > 0 && <><br/><small>{row.completed_at ? 'รับยอดเพิ่มแล้ว' : 'รอรับยอดเพิ่ม'}</small></>}</td>
            <td data-label="จำนวนเงิน" className="admin-amount co-amount"><strong>{money(row.total + extra / 100)}</strong>
              {due > 0 && <><br/><small>ยอดเพิ่ม {money(due / 100)}</small></>}</td>
          </tr>
        })}
        {!page.length && <tr><td colSpan={7} className="admin-empty-cell">ไม่พบรายการ Check-out</td></tr>}
        </tbody>
      </table>
    </div>
    {(previous || next || (!page.length && position.before)) && <nav className="admin-pagination actions" aria-label="แบ่งหน้ารายการ">
      {(previous || !page.length) && <Link className="button secondary" href={adminUrl('checkout',page.length
        ? {...filters,before:checkoutCursor(page[0])} : filters)}>← หน้าก่อนหน้า</Link>}
      {next && page.length > 0 && <Link className="button secondary" href={adminUrl('checkout',{...filters,after:checkoutCursor(page.at(-1))})}>หน้าถัดไป →</Link>}
    </nav>}
    {detail && <CheckoutDialog booking={detail} query={current} review={query.saved === 'checkoutDraft'}/>}
  </section>
}

export async function CheckoutSettings() {
  const settings = await checkoutSettings()
  return <CheckoutSettingsForm rate={settings.electricity_rate} freePerGuest={settings.free_units_per_guest} promptpay={settings.promptpay}/>
}
