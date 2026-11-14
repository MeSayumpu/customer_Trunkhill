import { weekdayRules } from './weekday-pricing.js'

export async function calendarPeriods(connection, nights) {
  const [periods] = await connection.execute(
    `SELECT kind,start_date,end_date,solo_person_price,person_price,plot_price
     FROM camp_calendar WHERE start_date <= ? AND end_date >= ?`,
    [nights.at(-1), nights[0]],
  )
  return periods
}

export const includesNight = (period, night) => night >= period.start_date && night <= period.end_date

export function isWeekend(night) {
  const weekday = new Date(night).getUTCDay()
  return weekday === 0 || weekday === 6
}

export function firstClosedNight(nights, periods) {
  return nights.find(night => periods.some(period => period.kind === 'closed' && includesNight(period, night)))
}

export function nightlyRates(nights, settings, periods) {
  const rules = settings.mode === 'plot' ? [] : weekdayRules(settings)
  const holidayHasPersonPrice = settings.holiday_solo_price != null || settings.holiday_person_price != null
  return nights.map(night => {
    const season = periods.find(period => period.kind === 'season' && includesNight(period, night))
    if (season) return {
      solo_person_price: season.solo_person_price,
      person_price: season.person_price,
      plot_price: season.plot_price,
    }
    const specialHoliday = periods.some(period => period.kind === 'holiday' && includesNight(period, night))
    const holiday = specialHoliday || isWeekend(night)
    const weekday = new Date(night).getUTCDay()
    const personTiers = specialHoliday && holidayHasPersonPrice ? [] : rules.filter(rule => rule.day === weekday)
    return {
      ...(personTiers.length ? { personTiers } : {}),
      solo_person_price: (holiday ? settings.holiday_solo_price : null) ?? settings.solo_person_price,
      person_price: (holiday ? settings.holiday_person_price : null) ?? settings.person_price,
      plot_price: holiday ? settings.holiday_plot_price : null,
    }
  })
}
export function personPriceFor(rate, adults) {
  const tier = rate.personTiers?.find(rule => adults >= rule.min && adults <= rule.max)
  return tier?.price ?? (adults === 1 ? rate.solo_person_price : rate.person_price)
}
