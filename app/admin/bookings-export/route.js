import { isAdmin } from '../../../lib/auth'
import { bookingFilters, bookingRows, bookingStats } from '../booking-list-data'
import { statuses } from '../../../lib/pricing'
function csv(values) {
  return values.map(value=>{
    let text=String(value??'')
    if(typeof value==='string' && /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text)) text="'"+text
    return '"'+text.replaceAll('"','""')+'"'
  }).join(',')+'\r\n'
}
async function* rows(filters,total,signal) {
  const encoder=new TextEncoder()
  yield encoder.encode('\uFEFF'+csv(['รหัสจอง','ผู้จอง','เบอร์โทร','เช็กอิน','เช็กเอาต์','ยอดรวม','สถานะ','จำนวนครั้งที่เลื่อน','วันที่สร้างรายการ','หมายเหตุแอดมิน']))
  for(let offset=0;offset<total && !signal.aborted;offset+=500) {
    const page=await bookingRows(filters,offset,500)
    if(!page.length) return
    yield encoder.encode(page.map(row=>csv([row.reference||row.id,row.guest,"'"+row.phone,row.arrival,row.departure,row.total,
      row.status==='pending' && row.submitted_at?'รอตรวจสลิป':statuses[row.status],row.reschedule_count,row.created_at,row.admin_note??''])).join(''))
  }
}
export async function GET(request) {
  if(!(await isAdmin())) return new Response(null,{status:403})
  const filters=bookingFilters(Object.fromEntries(request.nextUrl.searchParams))
  const stats=await bookingStats(filters)
  return new Response(ReadableStream.from(rows(filters,Number(stats.total),request.signal)),{headers:{
    'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="trunkhill-bookings.csv"',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  }})
}
