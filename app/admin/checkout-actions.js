'use server'

import { redirect } from 'next/navigation'
import { isAdmin, isStaff } from '../../lib/auth'
import { today } from '../../lib/camp'
import { database, transaction } from '../../lib/db'
import { maxExtraSatang, checkoutChargeField, checkoutChargeFields, checkoutChargeTotals, checkoutDue, decimalUnits, electricityFormula, electricityFormulaKey, hasUnallocatedCheckoutCharges, maxFreeUnitsMilli, maxRateSatang, savedCheckoutCharges } from '../../lib/checkout-pricing'
import { promptpayId } from '../../lib/promptpay'
import { adminUrl } from './navigation'
import { checkoutFilters, checkoutLodgingCodes, checkoutOccupancy, checkoutPosition, checkoutSettings } from './checkout-data'

export async function saveCheckoutSettings(_state, form) {
  if (!(await isAdmin())) redirect('/admin')
  const rate = decimalUnits(form.get('rate'),2,maxRateSatang)
  const freePerGuest = decimalUnits(form.get('freePerGuest'),3,maxFreeUnitsMilli)
  const recipient = String(form.get('promptpay') || '').trim()
  const promptpay = recipient ? promptpayId(recipient) : null
  if (rate === null) return { error:'ระบุค่าไฟต่อหน่วยเป็นตัวเลขตั้งแต่ 0 ถึง 999.99 บาท' }
  if (freePerGuest === null) return { error:'ระบุหน่วยไฟฟรีต่อคนตั้งแต่ 0 ถึง 999.999 หน่วย' }
  if (recipient && !promptpay) return { error:'ระบุเบอร์มือถือพร้อมเพย์ 10 หลัก หรือเลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก' }
  await database().execute(
    `INSERT INTO checkout_settings (id,electricity_rate,free_units_per_guest,promptpay) VALUES (1,?,?,?)
     ON DUPLICATE KEY UPDATE electricity_rate=VALUES(electricity_rate),free_units_per_guest=VALUES(free_units_per_guest),
       promptpay=VALUES(promptpay)`,[rate,freePerGuest,promptpay])
  redirect(adminUrl('checkoutSettings',{saved:'checkoutSettings'}))
}

export async function saveCheckout(id, query, _state, form) {
  if (!(await isStaff())) redirect('/admin')
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id)) return { error:'ไม่พบรายการจอง' }
  const finishing = form.get('intent') === 'complete'
  const version = String(form.get('version'))
  const note = String(form.get('note') || '').trim()
  if (!finishing && note.length > 500) return { error:'หมายเหตุต้องไม่เกิน 500 ตัวอักษร' }
  // Guests who actually stayed (used for the free electricity) and the charge the admin sets for the extra ones.
  const guests = ['adults','children','seniors'].map(name => /^\d{1,3}$/.test(String(form.get(name) ?? '').trim()) ? Number(form.get(name)) : null)
  const guestAmount = decimalUnits(String(form.get('guestAmount') ?? '').trim() || '0',2,maxExtraSatang)
  if (!finishing && (guests.includes(null) || guests[0] + guests[1] + guests[2] < 1)) return { error:'ระบุจำนวนผู้เข้าพักอย่างน้อย 1 คน' }
  if (!finishing && guestAmount === null) return { error:'ค่าผู้เข้าพักเพิ่มไม่ถูกต้อง' }

  const error = await transaction(async connection => {
    const [[booking]] = await connection.execute(
      `SELECT b.arrival,b.status,${checkoutOccupancy} FROM bookings b WHERE b.id=? FOR UPDATE`,[id])
    if (!booking || booking.status !== 'confirmed') return 'รายการจองนี้ไม่สามารถ Check-out ได้'
    if (booking.arrival > today()) return 'สามารถ Check-out ได้ตั้งแต่วันเช็กอิน'
    const [[checkout]] = await connection.execute('SELECT * FROM booking_checkouts WHERE booking=?',[id])
    const [[checkin]] = await connection.execute('SELECT added_amount FROM booking_checkins WHERE booking=?',[id])
    if (!checkin) return 'ต้อง Check-in ก่อนจึงจะ Check-out ได้'
    if (checkout?.completed_at) return 'รายการนี้ Check-out แล้ว'
    if (version !== String(checkout?.version ?? 0)) return 'รายการถูกแก้ไขแล้ว กรุณาเปิดใหม่เพื่อตรวจสอบยอดล่าสุด'
    if (finishing) {
      if (!checkout) return 'บันทึกยอดค่าใช้จ่ายก่อนยืนยัน Check-out'
      if (checkoutDue({ ...checkout,checkin_amount:checkin.added_amount }) > 0 && form.get('received') !== 'on') return 'ยืนยันว่าได้รับยอดชำระเพิ่มเติมแล้ว'
      await connection.execute('UPDATE booking_checkouts SET completed_at=UTC_TIMESTAMP() WHERE booking=?',[id])
      return null
    }

    const codes = await checkoutLodgingCodes(connection,id)
    booking.guest_count = guests[0] + guests[1] + guests[2]
    const keep = form.get('chargeMode') === 'keep'
    if (keep && !hasUnallocatedCheckoutCharges(checkout,codes.length)) return 'กรุณาเปิดรายการใหม่เพื่อตรวจสอบยอด'
    const settings = await checkoutSettings(connection)
    const formula = electricityFormula({ ...booking,...checkout },settings,!keep && form.get('useCurrentFormula') === 'on')
    if (electricityFormulaKey(formula) !== form.get('formula')) return 'สูตรค่าไฟเปลี่ยนแล้ว กรุณาเปิดรายการใหม่เพื่อตรวจสอบยอด'
    const charges = keep ? savedCheckoutCharges(checkout) : checkoutChargeTotals((codes.length ? codes : ['']).map(code =>
      Object.fromEntries(checkoutChargeFields.map(field => [field,form.get(checkoutChargeField(field,code))]))),formula)
    if (!charges) return 'ตรวจสอบจำนวนหน่วยไฟและค่าใช้จ่ายรายล็อก รวมถึงยอดรวมของแต่ละประเภท'
    const {units,electricity,damage,other} = charges
    const lodgingCharges = !keep && codes.length
      ? JSON.stringify(Object.fromEntries(codes.map((code,index) => [code,charges.lines[index]]))) : null
    const recipient = checkout?.promptpay ?? settings.promptpay
    await connection.execute(
      `INSERT INTO booking_checkouts (booking,units_milli,electricity_rate,free_units_per_guest,electricity_amount,damage_amount,other_amount,lodging_charges,note,promptpay,guest_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE units_milli=VALUES(units_milli),electricity_rate=VALUES(electricity_rate),guest_amount=VALUES(guest_amount),
       free_units_per_guest=VALUES(free_units_per_guest),electricity_amount=VALUES(electricity_amount),
       damage_amount=VALUES(damage_amount),other_amount=VALUES(other_amount),lodging_charges=VALUES(lodging_charges),
       note=VALUES(note),promptpay=VALUES(promptpay),version=version+1`,
      [id,units,formula.rate,formula.freePerGuest,electricity,damage,other,lodgingCharges,note,recipient,guestAmount])
    await connection.execute('UPDATE bookings SET adults=?,children=?,seniors=? WHERE id=?',[...guests,id])
    return null
  })
  if (error) return { error }
  const filters = checkoutFilters(query)
  redirect(adminUrl('checkout',finishing
    ? { ...filters,status:'done',view:id,saved:'checkout' }
    : { ...filters,...checkoutPosition(query),view:id,saved:'checkoutDraft' }))
}
