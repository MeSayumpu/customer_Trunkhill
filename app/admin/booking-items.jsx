import { database } from '../../lib/db'
import { money } from '../../lib/pricing'

export const lodgingLine = `(i.kind = 'plot' OR (i.kind = 'room' AND NOT EXISTS (
  SELECT 1 FROM booking_rentals attached WHERE attached.booking = l.booking AND attached.code = l.code
)))`

export async function bookingItems(id) {
  const [items] = await database().execute(
    `SELECT l.code,l.name,l.quantity,l.amount,l.room_adults,l.room_seniors,l.room_children,i.detail,i.kind,i.is_tent,${lodgingLine} AS lodging
     FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking=?
     ORDER BY lodging DESC,l.code`,[id])
  const [assignments] = await database().execute(
    `SELECT r.code,r.host AS host_code,h.name AS host,r.quantity FROM booking_rentals r
     JOIN booking_lines h ON h.booking=r.booking AND h.code=r.host
     WHERE r.booking=? ORDER BY r.host`,[id])
  const hostsByItem = new Map()
  for (const row of assignments) {
    const hosts = hostsByItem.get(row.code) || []
    hosts.push(row)
    hostsByItem.set(row.code,hosts)
  }
  return items.map(item => {
    const assignments = hostsByItem.get(item.code) || []
    return { ...item, assignments, hosts:assignments.map(row => row.host + ' × ' + row.quantity) }
  })
}

export function BookingItemsTable({ items, label }) {
  return <table className="admin-items-table" aria-label={label}>
    <thead><tr><th scope="col">รายการ</th><th scope="col">จำนวน / หน่วย</th><th scope="col">ยอดรายการ</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.code}>
      <th scope="row">{item.name}{item.hosts.length > 0 && <small>{item.hosts.join(' · ')}</small>}
        {item.room_adults != null && <small>ผู้เข้าพัก: ผู้ใหญ่ {item.room_adults} · ผู้สูงอายุ {item.room_seniors} · เด็ก {item.room_children}</small>}</th>
      <td>{item.quantity} {item.kind === "plot" ? "ล็อก" : item.kind === "room" ? "ห้อง" : item.is_tent ? "หลัง" : "ชิ้น"}</td><td><strong>{money(item.amount)}</strong></td>
    </tr>)}
    {!items.length && <tr><td colSpan={3}>ไม่มีรายการ</td></tr>}
    </tbody>
  </table>
}

