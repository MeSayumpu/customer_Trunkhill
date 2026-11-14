// Camp contact channels and location, edited in Admin → ตั้งค่าแคมป์ → ช่องทางติดต่อและที่ตั้ง.
export const contactChannels = [
  { key:'tel', name:'Tel', label:'เบอร์โทรศัพท์', placeholder:'099-227-7700', type:'tel' },
  { key:'line', name:'LINE', label:'LINE ID หรือลิงก์ LINE', placeholder:'@trunkhill หรือ https://lin.ee/…', type:'text' },
  { key:'facebook', name:'Facebook', label:'ลิงก์ Facebook', placeholder:'https://www.facebook.com/…' },
  { key:'tiktok', name:'TikTok', label:'ลิงก์ TikTok', placeholder:'https://www.tiktok.com/@…' },
  { key:'youtube', name:'YouTube', label:'ลิงก์ YouTube', placeholder:'https://www.youtube.com/@…' },
  { key:'instagram', name:'Instagram', label:'ลิงก์ Instagram', placeholder:'https://www.instagram.com/…' },
  { key:'x', name:'X', label:'ลิงก์ X', placeholder:'https://x.com/…' },
  { key:'lemon8', name:'Lemon8', label:'ลิงก์ Lemon8', placeholder:'https://www.lemon8-app.com/@…' },
]

export const defaultContacts = { tel:'099-227-7700' }

export function normalizeContacts(stored) {
  const value = stored && typeof stored === 'object' ? stored : {}
  return Object.fromEntries(contactChannels.map(({key}) => [key, typeof value[key] === 'string' ? value[key] : (defaultContacts[key] || '')]))
}

export function validTel(value) { return value === '' || /^\+?[0-9][0-9 -]{5,19}$/.test(value) }
export function validLink(value) {
  if (value === '') return true
  try { const url = new URL(value); return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password } catch { return false }
}
const lineId = value => /^@?[a-z0-9._-]{2,40}$/i.test(value)
export function validLine(value) { return value === '' || lineId(value) || validLink(value) }
export function validContact(key, value) { return key === 'tel' ? validTel(value) : key === 'line' ? validLine(value) : validLink(value) }

// A LINE ID (not a link) is shown as text the visitor can copy; it still opens LINE through line.me.
export const isLink = (key, value) => key !== 'tel' && !(key === 'line' && lineId(value))

export function contactHref(key, value) {
  if (!value) return null
  if (key === 'tel') return 'tel:' + value.replace(/[^0-9+]/g, '')
  if (key === 'line' && lineId(value)) return 'https://line.me/R/ti/p/' + (value.startsWith('@') ? value : '~' + value)
  return value
}

// Location: address text + coordinates ("13.7563, 100.5018" or a Google Maps link that contains them).
export function parseCoordinates(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const text = decodeURIComponent(value.trim())
  const patterns = [/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const lat = Number(match[1]), lng = Number(match[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return {lat:Number(lat.toFixed(6)), lng:Number(lng.toFixed(6))}
  }
  return null
}

export function normalizeLocation(stored) {
  const value = stored && typeof stored === 'object' ? stored : {}
  const text = key => typeof value[key] === 'string' ? value[key] : ''
  const point = parseCoordinates(text('coords'))
  return { address:text('address'), coords:point ? point.lat + ', ' + point.lng : '', mapUrl:text('mapUrl') }
}

export function locationLinks(location) {
  const point = parseCoordinates(location?.coords)
  const query = point ? point.lat + ',' + point.lng : location?.address?.trim()
  if (!query) return null
  return {
    embed:'https://www.google.com/maps?' + new URLSearchParams({q:query, z:point ? '15' : '13', output:'embed'}),
    open:location.mapUrl || 'https://www.google.com/maps/search/?' + new URLSearchParams({api:'1', query}),
    directions:'https://www.google.com/maps/dir/?' + new URLSearchParams({api:'1', destination:query}),
  }
}
