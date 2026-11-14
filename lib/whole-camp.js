export const wholeCampCode = 'WHOLE-CAMP'
export const wholeCampName = 'เหมาลาน'
export const wholeCampGuestLimit = 300
const defaultWholeCampTiers = [
  { maxGuests:15, weekdayPrice:4000, weekendPrice:8000, freeUnits:20 },
  { maxGuests:60, weekdayPrice:7000, weekendPrice:14000, freeUnits:50 },
]

export const wholeCampRateFields = [
  { name:'weekdayPrice', label:'จันทร์–พฤหัสบดี (บาท/คืน)', max:100000 },
  { name:'weekendPrice', label:'ศุกร์–อาทิตย์ (บาท/คืน)', max:100000 },
  { name:'freeUnits', label:'ไฟฟรี (หน่วย/กลุ่ม)', max:99999 },
]

export function wholeCampTiers(stored) {
  const rates = typeof stored === 'string' ? JSON.parse(stored) : stored
  if (Array.isArray(rates) && rates.length) return rates
  return defaultWholeCampTiers.map(tier => {
    const configured = rates?.[tier.maxGuests]
    return {
      maxGuests:tier.maxGuests,
      weekdayPrice:configured?.weekdayPrice ?? tier.weekdayPrice,
      weekendPrice:configured?.weekendPrice ?? tier.weekendPrice,
      freeUnits:configured?.freeUnits ?? tier.freeUnits,
    }
  })
}

export function wholeCampTier(guests, tiers = defaultWholeCampTiers) {
  return guests > 0 ? tiers.find(tier => guests <= tier.maxGuests) : undefined
}

export function wholeCampPrice(nights, tier) {
  return nights.reduce((total, night) => {
    const day = new Date(night).getUTCDay()
    return total + (day === 0 || day >= 5 ? tier.weekendPrice : tier.weekdayPrice)
  }, 0)
}
