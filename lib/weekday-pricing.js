export function weekdayRules(settings) {
  const stored = settings.weekday_person_rates
  return (typeof stored === 'string' ? JSON.parse(stored) : stored) ?? []
}
