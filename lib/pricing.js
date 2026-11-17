import { isTent } from './rentals.js'
import { personPriceFor } from './camp-calendar.js'
import { wholeCampCode } from './whole-camp.js'

export const zones = ['A', 'B', 'C', 'D', 'BOX']
export const statuses = { pending: 'รอตรวจสอบ', confirmed: 'ยืนยันแล้ว', cancelled: 'ยกเลิกแล้ว' }
export const money = value => new Intl.NumberFormat('th-TH').format(value) + ' บาท'

// Discount steps of a tent model as [[adults, rate per adult per night], …], smallest group first.
// Models saved before steps existed have one step made from their single rate and guest limit.
export function tentDiscountTiers(tent) {
  let tiers = tent.tent_discount_tiers
  if (typeof tiers === 'string') {
    try { tiers = JSON.parse(tiers) } catch { tiers = null }
  }
  if (Array.isArray(tiers) && tiers.length) {
    return tiers.map(([adults, rate]) => [Number(adults), Number(rate)])
      .filter(([adults, rate]) => adults > 0 && rate > 0).sort((a, b) => a[0] - b[0])
  }
  const limit = tent.tent_discount_guest_limit ?? 0
  const rate = tent.tent_discount_per_guest ?? 0
  return limit > 0 && rate > 0 ? [[limit, rate]] : []
}

export function tentDiscountFor(tents, adults) {
  const savings = []
  for (const tent of tents) {
    const tiers = tentDiscountTiers(tent)
    // The step for this many adults; a larger group than the largest step is discounted like the largest step.
    const [stepAdults, rate] = tiers.find(([limit]) => adults <= limit) ?? tiers.at(-1) ?? [0, 0]
    const modelLimit = Math.min(adults, stepAdults)
    let remaining = tent.price * tent.quantity
    for (let guest = 0; guest < modelLimit && rate > 0 && remaining > 0; guest++) {
      const amount = Math.min(rate, remaining)
      savings.push(amount)
      remaining -= amount
    }
  }
  return savings.sort((a, b) => b - a).slice(0, adults).reduce((sum, amount) => sum + amount, 0)
}

// A room's price covers a set number of guests; each adult or senior beyond that pays extra per night. Children stay free.
// row.guests is {adults, seniors, children} for that room; a room without it (older bookings) has no extra charge.
export function roomExtraGuests(row) {
  if (!row.guests) return 0
  return Math.max(0, row.guests.adults + row.guests.seniors - (row.room_base_guests ?? 2))
}

// How many adults each plot is billed for, plots in code order: as many two-adult plots as possible are filled first,
// then the remaining plots are billed for one adult each (a plot is billed for at least one).
export function plotGuestShares(plotCount, adults) {
  const soloPlots = Math.min(plotCount, Math.max(0, 2 * plotCount - adults))
  const sharedPlots = plotCount - soloPlots
  const sharedAdults = Math.max(0, adults - soloPlots)
  const adultsPerSharedPlot = sharedPlots ? Math.floor(sharedAdults / sharedPlots) : 0
  const extraAdults = sharedPlots ? sharedAdults % sharedPlots : 0
  return Array.from({length:plotCount},(_,index) => index >= sharedPlots ? 1 : adultsPerSharedPlot + Number(index < extraAdults))
}

// Who the lock fee of each lodging line was billed for, worked out the way stayPricing bills them, for the check-out
// screen: Map code → {adults, seniors, children, paying}. A plot holds only the guests billed on it (adults, or seniors
// when no adult came); a room holds everyone staying in it, and its adults and seniors are the paying ones.
// free: guests on the plots who pay no lock fee (seniors who came with an adult, children).
// Returns null where guests are not billed per lock: per-plot pricing, a whole-camp stay, or a room saved without guests.
export function lodgingGuests(items, booked, mode) {
  const rooms = items.filter(item => item.kind === 'room')
  const plots = items.filter(item => item.kind === 'plot').sort((a, b) => a.code < b.code ? -1 : 1)
  if (mode !== 'person' || plots.some(item => item.code === wholeCampCode) || rooms.some(item => item.room_adults == null)) return null
  const inRooms = key => rooms.reduce((sum, room) => sum + room['room_' + key], 0)
  const plotAdults = Math.max(0, booked.adults - inRooms('adults'))
  const plotSeniors = Math.max(0, booked.seniors - inRooms('seniors'))
  const seniorsAsAdults = plotAdults === 0 && plotSeniors > 0 && plots.length > 0
  const billed = seniorsAsAdults ? plotSeniors : plotAdults
  const shares = billed ? plotGuestShares(plots.length, billed) : plots.map(() => 0)
  const byCode = new Map(rooms.map(room => [room.code, {
    adults:room.room_adults, seniors:room.room_seniors, children:room.room_children, paying:room.room_adults + room.room_seniors }]))
  plots.forEach((plot, index) => byCode.set(plot.code, {
    adults:seniorsAsAdults ? 0 : shares[index], seniors:seniorsAsAdults ? shares[index] : 0, children:0, paying:shares[index] }))
  return { byCode, free:{ seniors:plots.length && !seniorsAsAdults ? plotSeniors : 0, children:Math.max(0, booked.children - inRooms('children')) } }
}

// totalAdults and totalSeniors count everyone in the booking. Guests staying in rooms are not billed on the plots.
export function stayPricing(rows, settings, totalAdults, rates, wholeCampAmount = null, totalSeniors = 0) {
  const nights = rates.length
  const inRooms = key => rows.reduce((sum, row) => sum + (row.kind === 'room' ? row.guests?.[key] ?? 0 : 0), 0)
  const plotAdults = Math.max(0, totalAdults - inRooms('adults'))
  const plotSeniors = Math.max(0, totalSeniors - inRooms('seniors'))
  // Seniors on plots stay free when an adult comes along. With no adult they are billed exactly as adults would be:
  // per-person rates, special-day rates and the tent discount all count the seniors instead.
  const seniorsAsAdults = wholeCampAmount === null && plotAdults === 0 && plotSeniors > 0 && rows.some(row => row.kind === 'plot')
  const adults = seniorsAsAdults ? plotSeniors : plotAdults
  const plots = rows.filter(row => row.kind === 'plot').sort((a, b) => a.code < b.code ? -1 : 1)
  // Fill as many two-adult plots as possible before charging the remaining plots at the solo rate.
  const shares = plotGuestShares(plots.length, adults)
  // Per plot in person mode: how many adults it is billed for and the per-person rate, with nights at the same rate grouped.
  const plotBreakdown = new Map()
  const plotAmounts = new Map(plots.map((row, index) => {
    if (row.code === wholeCampCode) return [row.code, wholeCampAmount ?? 0]
    const billedAdults = shares[index]
    const lines = []
    const amount = rates.reduce((sum, rate) => {
      if (settings.mode === 'plot') return sum + (rate.plot_price ?? row.price)
      if (!adults) return sum
      const price = personPriceFor(rate, billedAdults)
      const line = lines.find(item => item.price === price)
      if (line) line.nights++
      else lines.push({ price, nights:1 })
      return sum + price * billedAdults
    }, 0)
    if (lines.length) plotBreakdown.set(row.code, { adults:billedAdults, lines })
    return [row.code, amount]
  }))
  const plotTotal = [...plotAmounts.values()].reduce((sum, amount) => sum + amount, 0)
  let roomTotal = 0
  const roomAmounts = new Map()
  let tentTotal = 0
  let gearTotal = 0
  const tents = []
  for (const row of rows) {
    let amount = row.price * row.quantity * nights
    if (row.kind === 'room') {
      amount += roomExtraGuests(row) * (row.room_extra_guest_price ?? 0) * nights
      roomAmounts.set(row.code, amount)
      roomTotal += amount
    }
    if (isTent(row)) {
      tentTotal += amount
      tents.push(row)
    } else if (row.kind === 'gear') gearTotal += amount
  }
  const discount = plots.length && wholeCampAmount === null
    ? tentDiscountFor(tents, adults) * nights
    : 0
  const total = plotTotal + roomTotal + tentTotal + gearTotal - discount
  return { plotAmounts, plotBreakdown, plotAdults:adults, seniorsAsAdults, plotTotal, roomAmounts, roomTotal, tentTotal, gearTotal, discount, total }
}
