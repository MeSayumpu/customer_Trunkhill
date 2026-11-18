import {workbookStream} from '../../../lib/xlsx'
import { isStaff } from '../../../lib/auth'
import { checkinUnpaid, checkoutDue, extraCharge } from '../../../lib/checkout-pricing'
import { checkoutCursor, checkoutFilters, checkoutRows, checkoutStatuses, checkoutSummaries } from '../checkout-data'

// Rows are read 500 at a time and leave as the file is written, so years of check-outs neither wait for thousands of
// small queries nor sit in memory all at once.
const batchSize = 500
async function* excelBatches(filters, signal) {
  yield [['รหัสจอง','เช็กอิน','เช็กเอาต์','ล็อก / ห้อง','อุปกรณ์','ชื่อผู้จอง','เบอร์โทร','สถานะ','ยอดจองเดิม','อุปกรณ์ที่เพิ่มตอน Check-in','ค่าไฟ','ค่าของชำรุด','ค่าใช้จ่ายอื่น ๆ','ค่าผู้เข้าพักเพิ่ม','ส่วนลด','ยอดชำระเพิ่ม','ยอดรวม']]
  let after = ''
  while (!signal.aborted) {
    const rows = await checkoutRows(filters,{after},batchSize)
    const page = rows.slice(0,batchSize)
    const summaries = await checkoutSummaries(page)
    yield page.map(row => {
      const {lodging,rentals} = summaries.get(row.id)
      const extra = extraCharge(row) / 100, added = checkinUnpaid(row) / 100
      return [row.reference||row.id,row.arrival,row.departure,lodging.join(', '),rentals.join(', '),row.guest,row.phone,
        row.completed_at ? checkoutStatuses.done : checkoutStatuses.open,Number(row.total) - added,added,
        Number(row.electricity_amount ?? 0) / 100,(row.damage_amount ?? 0) / 100,(row.other_amount ?? 0) / 100,(row.guest_amount ?? 0) / 100,(row.discount_amount ?? 0) / 100,checkoutDue(row) / 100,Number(row.total) + extra]
    })
    if (rows.length <= batchSize) return
    after = checkoutCursor(page.at(-1))
  }
}

export async function GET(request) {
  if (!(await isStaff())) return new Response(null,{status:403})
  const filters = checkoutFilters(Object.fromEntries(request.nextUrl.searchParams))
  return new Response(ReadableStream.from(workbookStream(excelBatches(filters,request.signal))),{headers:{
    'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition':'attachment; filename="trunkhill-checkouts.xlsx"',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
  }})
}
