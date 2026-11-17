import {workbook} from '../../../lib/xlsx'
import { isStaff } from '../../../lib/auth'
import { checkinUnpaid, checkoutDue, extraCharge } from '../../../lib/checkout-pricing'
import { checkoutCursor, checkoutFilters, checkoutPageSize, checkoutRows, checkoutStatuses, checkoutSummaries } from '../checkout-data'

async function excelRows(filters) {
  const result=[]
  result.push(['รหัสจอง','เช็กอิน','เช็กเอาต์','ล็อก / ห้อง','อุปกรณ์','ชื่อผู้จอง','เบอร์โทร','สถานะ','ยอดจองเดิม','อุปกรณ์ที่เพิ่มตอน Check-in','ค่าไฟ','ค่าของชำรุด','ค่าใช้จ่ายอื่น ๆ','ค่าผู้เข้าพักเพิ่ม','ส่วนลด','ยอดชำระเพิ่ม','ยอดรวม'])
  let after = ''
  while (true) {
    const rows = await checkoutRows(filters,{after})
    const page = rows.slice(0,checkoutPageSize)
    const summaries = await checkoutSummaries(page)
    result.push(...page.map(row => {
      const {lodging,rentals} = summaries.get(row.id)
      const extra = extraCharge(row) / 100, added = checkinUnpaid(row) / 100
      return [row.reference||row.id,row.arrival,row.departure,lodging.join(', '),rentals.join(', '),row.guest,row.phone,
        row.completed_at ? checkoutStatuses.done : checkoutStatuses.open,Number(row.total) - added,added,
        Number(row.electricity_amount ?? 0) / 100,(row.damage_amount ?? 0) / 100,(row.other_amount ?? 0) / 100,(row.guest_amount ?? 0) / 100,(row.discount_amount ?? 0) / 100,checkoutDue(row) / 100,Number(row.total) + extra]
    }))
    if (rows.length <= checkoutPageSize) return result
    after = checkoutCursor(page.at(-1))
  }
}

export async function GET(request) {
  if (!(await isStaff())) return new Response(null,{status:403})
  const filters = checkoutFilters(Object.fromEntries(request.nextUrl.searchParams))
  return new Response(workbook(await excelRows(filters)),{headers:{
    'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition':'attachment; filename="trunkhill-checkouts.xlsx"',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
  }})
}
