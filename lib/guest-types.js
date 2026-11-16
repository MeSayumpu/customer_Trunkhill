// What the guest picker says under each guest type. The admin can change it (camp option "guestTypes").
// detail = the age line; note = the line explaining the red * after "ฟรี". The *En fields are the English wording;
// when one is empty the Thai text goes through the normal translation table.
export const guestTypeKeys = ['adults','children','seniors']
export const guestTypeTextMax = 120
export const guestTypeDefaults = {
  adults:{detail:'อายุ 13–64 ปี',detailEn:'',note:'',noteEn:''},
  children:{detail:'อายุไม่เกิน 13 ปี',detailEn:'',note:'',noteEn:''},
  seniors:{detail:'อายุ 65 ปีขึ้นไป',detailEn:'',note:'',noteEn:''},
}
const text = value => typeof value === 'string' ? value.trim().slice(0,guestTypeTextMax) : ''

export function normalizeGuestTypes(value) {
  return Object.fromEntries(guestTypeKeys.map(key => {
    const saved = value?.[key]
    return [key,saved && typeof saved === 'object'
      ? {detail:text(saved.detail),detailEn:text(saved.detailEn),note:text(saved.note),noteEn:text(saved.noteEn)}
      : guestTypeDefaults[key]]
  }))
}

// Text for the current language: the admin's English when given, otherwise the Thai text via t().
export const guestTypeText = (info,field,lang,t) => lang === 'en' && info[field + 'En'] ? info[field + 'En'] : info[field] ? t(info[field]) : ''

// Lines the admin writes for the "อัตราค่าเข้าพัก" box of the guest picker (camp option "guestRate").
// auto = also show the rate text the system works out from the prices.
export const guestRateLineMax = 200
export const guestRateLinesMax = 10
export function normalizeGuestRate(value) {
  const line = text => typeof text === 'string' ? text.trim().slice(0,guestRateLineMax) : ''
  const lines = Array.isArray(value?.lines) ? value.lines.map(row => ({th:line(row?.th),en:line(row?.en)})).filter(row => row.th).slice(0,guestRateLinesMax) : []
  return {auto:value?.auto !== false,lines}
}
