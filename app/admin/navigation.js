export const adminSections = {
  dashboard: 'Dashboard',
  bookings: 'รายการจอง',
  checkin: 'Check-in',
  checkout: 'Check-out',
  blockedPhones: 'เบอร์ที่ถูกบล็อก',
  plots: 'ลานกางเต็นท์',
  rooms: 'ห้องพัก',
  gear: 'อุปกรณ์ให้เช่า',
  zoneMedia: 'รายละเอียดและสื่อโซน',
  plotMap: 'จัดการผังลาน',
  settings: 'ตั้งค่าแคมป์',
  storage: 'พื้นที่จัดเก็บ',
}

export const adminMenuGroups = [
  { id:'operations', label:'การจอง Check-in และ Check-out', sections:['bookings','checkin','checkout','blockedPhones'] },
  { id:'inventory', label:'ลานและอุปกรณ์', sections:['plots','rooms','gear','plotMap','zoneMedia'] },
  { id:'configuration', label:'การตั้งค่า', sections:['settings','storage'] },
]

export const settingsAliases = { pricing:'rates', calendar:'rates', payment:'payment', checkoutSettings:'payment', bookingPolicy:'policy' }

export const inventoryKinds = { plots:'plot', rooms:'room', gear:'gear' }
export const inventorySections = { plot:'plots', room:'rooms', gear:'gear' }

export function adminUrl(section, params = {}) {
  const group = settingsAliases[section]
  const query = new URLSearchParams(group ? { section:'settings', group } : { section })
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  return '/admin?' + query
}
