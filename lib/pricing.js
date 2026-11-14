import { isTent } from './rentals.js'
import { personPriceFor } from './camp-calendar.js'
import { wholeCampCode } from './whole-camp.js'

export const zones = ['A', 'B', 'C', 'D', 'BOX']
export const statuses = { pending: 'รอตรวจสอบ', confirmed: 'ยืนยันแล้ว', cancelled: 'ยกเลิกแล้ว' }
export const money = value => new Intl.NumberFormat('th-TH').format(value) + ' บาท'

function tentDiscount(tents, adults) {
  const savings = []
  for (const tent of tents) {
    const modelLimit = Math.min(adults, tent.tent_discount_guest_limit ?? 0)
    const rate = tent.tent_discount_per_guest ?? 0
    let remaining = tent.price * tent.quantity
    for (let guest = 0; guest < modelLimit && rate > 0 && remaining > 0; guest++) {
      const amount = Math.min(rate, remaining)
      savings.push(amount)
      remaining -= amount
    }
  }
  return savings.sort((a, b) => b - a).slice(0, adults).reduce((sum, amount) => sum + amount, 0)
}

export function stayPricing(rows, settings, adults, rates, wholeCampAmount = null) {
  const nights = rates.length
  const plots = rows.filter(row => row.kind === 'plot').sort((a, b) => a.code < b.code ? -1 : 1)
  // Fill as many two-adult plots as possible before charging the remaining plots at the solo rate.
  const soloPlots = Math.min(plots.length, Math.max(0, 2 * plots.length - adults))
  const sharedPlots = plots.length - soloPlots
  const sharedAdults = Math.max(0, adults - soloPlots)
  const adultsPerSharedPlot = sharedPlots ? Math.floor(sharedAdults / sharedPlots) : 0
  const extraAdults = sharedPlots ? sharedAdults % sharedPlots : 0
  // Per plot in person mode: how many adults it is billed for and the per-person rate, with nights at the same rate grouped.
  const plotBreakdown = new Map()
  const plotAmounts = new Map(plots.map((row, index) => {
    if (row.code === wholeCampCode) return [row.code, wholeCampAmount ?? 0]
    const billedAdults = index >= sharedPlots ? 1 : adultsPerSharedPlot + Number(index < extraAdults)
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
  let tentTotal = 0
  let gearTotal = 0
  const tents = []
  for (const row of rows) {
    const amount = row.price * row.quantity * nights
    if (row.kind === 'room') roomTotal += amount
    if (isTent(row)) {
      tentTotal += amount
      tents.push(row)
    } else if (row.kind === 'gear') gearTotal += amount
  }
  const discount = plots.length && wholeCampAmount === null
    ? tentDiscount(tents, adults) * nights
    : 0
  const total = plotTotal + roomTotal + tentTotal + gearTotal - discount
  return { plotAmounts, plotBreakdown, plotTotal, roomTotal, tentTotal, gearTotal, discount, total }
}
