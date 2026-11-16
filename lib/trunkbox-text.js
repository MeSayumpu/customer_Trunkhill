// Texts of the Trunkbox tab that the admin can replace (camp option "trunkboxText": intro, introEn, price, priceEn).
// The price line takes {price} {base} {extra} {max}, filled in per room.
export const trunkboxTextMax = 240
export const trunkboxTextDefaults = {
  intro:'ห้องพักพร้อมนอน เลือกห้องแล้วเพิ่มอุปกรณ์ได้ในขั้นสรุปการจอง',
  price:'{price} / คืน · รวม {base} คน · เพิ่มคนละ {extra} · สูงสุด {max} คน',
}
// The admin's text for the language when given (English falls back to the Thai text), otherwise the built-in one via t().
export function trunkboxText(saved,key,lang,t,params) {
  const own = (lang === 'en' && saved?.[key + 'En']?.trim()) || saved?.[key]?.trim()
  if (!own) return t(trunkboxTextDefaults[key],params)
  return params ? own.replace(/\{(price|base|extra|max)\}/g,(_,name) => params[name]) : own
}
