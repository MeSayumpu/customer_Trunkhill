import { CampError, catalog, lookup, phoneNumber, reserve } from '../../../lib/camp'
import { amendBooking } from '../../../lib/booking-amendments'

export const runtime = 'nodejs'

import { api } from '../../../lib/api'

export function GET(request) {
  const q = request.nextUrl.searchParams
  return api(() => catalog(q.get('arrival'), q.get('departure')))
}

export function POST(request) {
  return api(async () => {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CampError('ข้อมูลไม่ถูกต้อง')
    if (body.action === 'lookup') return lookup(body.id,phoneNumber(body.phone))
    if (body.action === 'editCatalog') {
      const booking=await lookup(body.id,phoneNumber(body.phone))
      if(booking.reschedule_block)throw new CampError(booking.reschedule_block,409)
      return catalog(body.arrival,body.departure,booking.id)
    }
    if (body.action === 'reschedule') throw new CampError('กรุณารีเฟรชหน้าและใช้ปุ่มเลื่อน / แก้ไขการจอง',409)
    if (body.action === 'quoteAmendment') return amendBooking(body)
    if (body.action === 'amendBooking') return amendBooking(body,true)
    return reserve(body)
  })
}

