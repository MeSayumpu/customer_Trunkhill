import { wholeCampTier } from './whole-camp.js'

export function decimalUnits(input, places, max) {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!new RegExp('^\\d{1,6}(?:\\.\\d{1,' + places + '})?$').test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const units = Number(whole) * 10 ** places + Number(fraction.padEnd(places, '0'))
  return units <= max ? units : null
}

export const maxUnitsMilli = 99_999_999
export const maxExtraSatang = 99_999_999
export const maxRateSatang = 99_999
export const maxFreeUnitsMilli = 999_999
export const defaultElectricity = { electricity_rate:1000, free_units_per_guest:1000 }

export function electricityFormula(booking, settings, useCurrent = false) {
  const policy = booking.completed_at || (!useCurrent && booking.electricity_rate != null) ? booking : settings
  return {
    rate:policy.electricity_rate,
    freePerGuest:policy.free_units_per_guest,
    // Who shares the free electricity: the number the admin set at check-out, otherwise the guests who paid the entry fee
    // in the booking (guests added later are not counted unless the admin changes the number).
    // Check-outs closed before this number existed counted every guest, and keep doing so.
    guests:booking.free_guests ?? (booking.completed_at ? booking.guest_count : booking.paying_guests ?? booking.guest_count),
    locks:Math.max(1,Number(booking.plot_count)),
    ...(booking.whole_camp ? { fixedFreeUnits:booking.whole_camp_free_units ?? wholeCampTier(booking.guest_count)?.freeUnits ?? 0 } : {}),
  }
}

// The rate and allowance a charge was worked out with. The guests of each lock are typed in the form itself, so they
// are not part of it.
export function electricityFormulaKey({rate,freePerGuest,fixedFreeUnits}) {
  return fixedFreeUnits == null ? [rate,freePerGuest].join(':') : [rate,fixedFreeUnits,'whole-camp'].join(':')
}

export const maxLockGuests = 500
export const lockGuestCount = input => /^\d{1,3}$/.test(String(input ?? '').trim()) && Number(input) <= maxLockGuests ? Number(input) : null

// Where the form starts: the booking's paying guests shared between its locks as evenly as whole people allow.
export function defaultLockGuests(total, count) {
  const share = Math.floor(total / count)
  return Array.from({length:count},(_,index) => share + (index < total % count ? 1 : 0))
}

// lockGuests: the guests of this lock, each bringing freePerGuest free units — charge = (units used − free units) × rate.
// Without it (check-outs saved before guests were counted per lock) the booking's guests are shared between its locks.
export function electricityCharge(unitsMilli, {rate,freePerGuest,guests,locks,fixedFreeUnits}, lockGuests) {
  if (fixedFreeUnits == null && lockGuests != null) {
    const free = BigInt(freePerGuest) * BigInt(lockGuests)
    const billable = BigInt(unitsMilli) > free ? BigInt(unitsMilli) - free : 0n
    return {
      freeUnits:Number(free) / 1000,
      billableUnits:Number(billable) / 1000,
      amount:Number((billable * BigInt(rate ?? 0) + 500n) / 1000n),
    }
  }
  // Keep fractional free units exact and round the final charge to satang.
  const lockCount = BigInt(locks)
  const free = fixedFreeUnits == null ? BigInt(freePerGuest) * BigInt(guests) : BigInt(fixedFreeUnits * 1000) * lockCount
  const remaining = BigInt(unitsMilli) * lockCount - free
  const billable = remaining > 0n ? remaining : 0n
  const divisor = lockCount * 1000n
  return {
    freeUnits:Number(free) / Number(divisor),
    billableUnits:Number(billable) / Number(divisor),
    amount:Number((billable * BigInt(rate ?? 0) + divisor / 2n) / divisor),
  }
}

// Charges entered at check-out (satang). A booking's total already holds equipment added at check-in, but that part is
// not paid yet: checkoutDue is everything still to collect at check-out.
// discount_amount is what the admin takes off at check-out (for example when a charge came out too high).
export const extraCharge = row => Number(row.electricity_amount ?? 0) + (row.damage_amount ?? 0) + (row.other_amount ?? 0) + (row.guest_amount ?? 0) -
  (row.discount_amount ?? 0)
export const checkinUnpaid = row => Number(row.checkin_amount ?? 0) * 100
export const checkoutDue = row => extraCharge(row) + checkinUnpaid(row)

export const checkoutChargeFields = ['units','damage','other']
export const checkoutChargeField = (field, code) => code ? field + ':' + code : field

export function savedCheckoutCharges(booking) {
  return {
    units:booking.units_milli ?? 0,
    electricity:Number(booking.electricity_amount ?? 0),
    damage:booking.damage_amount ?? 0,
    other:booking.other_amount ?? 0,
  }
}

export function hasUnallocatedCheckoutCharges(booking, lodgingCount) {
  return lodgingCount > 1 && booking && booking.lodging_charges == null &&
    checkoutChargeFields.some(field => savedCheckoutCharges(booking)[field] > 0)
}

export function checkoutChargeTotals(rows, formula) {
  const lines = []
  const totals = { units:0, electricity:0, damage:0, other:0 }
  for (const row of rows) {
    const units = decimalUnits(row.units === '' ? '0' : row.units,3,maxUnitsMilli)
    const damage = decimalUnits(row.damage === '' ? '0' : row.damage,2,maxExtraSatang)
    const other = decimalUnits(row.other === '' ? '0' : row.other,2,maxExtraSatang)
    // A whole-camp stay has its own fixed allowance, so its lines carry no guests.
    const guests = formula.fixedFreeUnits == null ? lockGuestCount(row.guests) : undefined
    if ([units,damage,other,guests].includes(null)) return null
    const { amount:electricity } = electricityCharge(units,formula,guests)
    lines.push({units,electricity,damage,other,...(guests === undefined ? {} : {guests})})
    totals.units += units
    totals.electricity += electricity
    totals.damage += damage
    totals.other += other
  }
  if (totals.units > maxUnitsMilli || totals.damage > maxExtraSatang || totals.other > maxExtraSatang) return null
  return { ...totals, lines }
}
