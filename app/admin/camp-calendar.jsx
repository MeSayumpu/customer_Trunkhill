import Link, { ActionForm } from '../pending-ui'
import { isCalendarDate, shiftDate } from '../../lib/booking-dates'
import { today } from '../../lib/camp'
import { includesNight, isWeekend, nightlyRates, personPriceFor } from '../../lib/camp-calendar'
import { database } from '../../lib/db'
import { money } from '../../lib/pricing'
import { deleteCalendarPeriod, saveCalendarPeriod } from './actions'
import { adminUrl } from './navigation'
import { ConfirmSubmit } from '../confirm-dialog'

const kinds = { closed:'ปิดรับจอง', season:'ราคาตามช่วง', holiday:'วันหยุดพิเศษ' }
const statuses = { ...kinds, weekend:'เสาร์–อาทิตย์', open:'วันปกติ' }
const weekdays = ['อา','จ','อ','พ','พฤ','ศ','ส']
const monthLabel = new Intl.DateTimeFormat('th-TH-u-ca-gregory',{month:'long',year:'numeric',timeZone:'UTC'})
const dayLabel = new Intl.DateTimeFormat('th-TH-u-ca-gregory',{dateStyle:'full',timeZone:'UTC'})
const formatNumber = new Intl.NumberFormat('th-TH')

function PeriodForm({period, day, kind = period?.kind}) {
  return <ActionForm action={saveCalendarPeriod} className="stack admin-calendar-form">
    <input type="hidden" name="kind" value={kind}/>
    {day && <input type="hidden" name="calendarDay" value={day}/>}
    {period && <input type="hidden" name="periodId" value={period.id}/>}
    <label>ชื่อช่วง<input name="label" maxLength={120} defaultValue={period?.label} required/></label>
    <label>ตั้งแต่คืนวันที่<input name="start" type="date" defaultValue={period?.start_date ?? day} required/></label>
    <label>ถึงคืนวันที่ (รวมวันนี้)<input name="end" type="date" defaultValue={period?.end_date ?? day} required/></label>
    {kind === 'season' && <>
      <label>ลานผู้ใหญ่ 1 คน (บาท/คืน)<input name="soloPrice" type="number" min="0" max="100000" defaultValue={period?.solo_person_price} required/></label>
      <label>ลานผู้ใหญ่ 2 คนขึ้นไป (บาท/คน/คืน)<input name="price" type="number" min="0" max="100000" defaultValue={period?.person_price} required/></label>
      <label>ราคาโหมดตามล็อก (บาท/ล็อก/คืน)<input name="plotPrice" type="number" min="0" max="100000" defaultValue={period?.plot_price ?? ''} placeholder="ใช้ราคาของแต่ละล็อก"/></label>
    </>}
    <div className="actions">
      <button className="button">{period ? 'บันทึกการแก้ไข' : 'เพิ่มช่วง'}</button>
      {period && <ConfirmSubmit className="button secondary admin-cancel" formAction={deleteCalendarPeriod} formNoValidate confirm={{
        title:'ลบช่วงนี้ออกจากปฏิทิน?',
        message:'วันในช่วงนี้จะกลับไปใช้ราคาและสถานะปกติทันที และกู้คืนช่วงนี้ไม่ได้',
        items:[`${period.label} · ${kinds[period.kind] ?? period.kind} · ${period.start_date} ถึง ${period.end_date}`],
        confirmLabel:'ลบช่วงนี้',
      }}>ลบช่วงนี้</ConfirmSubmit>}
    </div>
  </ActionForm>
}

function dayStatuses(date, periods) {
  const matches = Object.keys(kinds).filter(kind =>
    periods.some(period => period.kind === kind && includesNight(period,date)))
  if (isWeekend(date)) matches.push('weekend')
  return matches.length ? matches : ['open']
}

function plotPriceLabel(rate, plotPrices) {
  if (rate.plot_price != null) return money(rate.plot_price)
  if (plotPrices.low == null) return 'ไม่มีล็อกเปิดจอง'
  if (plotPrices.low === plotPrices.high) return money(plotPrices.low)
  return formatNumber.format(plotPrices.low) + '–' + money(plotPrices.high)
}

export async function CampCalendar({query}) {
  const current = today()
  const day = isCalendarDate(query.day) ? query.day : current
  const kind = typeof query.kind === 'string' && Object.hasOwn(kinds,query.kind) ? query.kind : null
  const first = day.slice(0,7) + '-01'
  const month = new Date(first)
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const monthEnd = new Date(Date.UTC(year,monthIndex + 1,0))
  const previous = new Date(Date.UTC(year,monthIndex - 1,1)).toISOString().slice(0,10)
  const next = new Date(Date.UTC(year,monthIndex + 1,1)).toISOString().slice(0,10)
  const [[periods], [[settings]]] = await Promise.all([
    database().execute('SELECT * FROM camp_calendar WHERE start_date<=? AND end_date>=? ORDER BY start_date DESC, id DESC',
      [monthEnd.toISOString().slice(0,10),first]),
    database().query('SELECT * FROM settings WHERE id=1'),
  ])
  const perPlot = settings.mode === 'plot'
  const [[plotPrices]] = perPlot
    ? await database().query("SELECT MIN(price) AS low, MAX(price) AS high FROM inventory WHERE kind='plot' AND active=TRUE")
    : [[]]
  const dates = Array.from({length:monthEnd.getUTCDate()},(_,index) => shiftDate(first,index))
  const rates = nightlyRates(dates,settings,periods)
  const selectedPeriods = periods.filter(period => includesNight(period,day))
  const selectedStatuses = dayStatuses(day,periods)
  const selectedRate = rates[Number(day.slice(-2)) - 1]
  const selectedSeason = selectedPeriods.find(period => period.kind === 'season')
  const holiday = selectedStatuses.includes('holiday') || isWeekend(day)
  const source = field => selectedSeason
    ? (field === 'plot_price' && selectedRate.plot_price == null ? 'ราคาของแต่ละล็อก (ฤดูกาลเว้นว่าง)' : 'ฤดูกาล: ' + selectedSeason.label)
    : holiday && settings[{solo_person_price:'holiday_solo_price',person_price:'holiday_person_price',plot_price:'holiday_plot_price'}[field]] != null
      ? 'ราคาวันหยุด' : field === 'plot_price' ? 'ราคาของแต่ละล็อก' : 'ราคาพื้นฐาน'

  return <div className="admin-calendar-layout">
    <section className="panel stack" aria-labelledby="admin-calendar-title">
      <div className="admin-calendar-heading">
        <h2 id="admin-calendar-title">{monthLabel.format(month)}</h2>
        <nav className="actions" aria-label="เลือกเดือนปฏิทิน">
          {isCalendarDate(previous) && <Link className="button secondary" aria-label="เดือนก่อน" href={adminUrl('calendar',{day:previous})} scroll={false} prefetch={false}>‹</Link>}
          <Link className="button secondary" href={adminUrl('calendar',{day:current})} scroll={false} prefetch={false}>วันนี้</Link>
          {isCalendarDate(next) && <Link className="button secondary" aria-label="เดือนถัดไป" href={adminUrl('calendar',{day:next})} scroll={false} prefetch={false}>›</Link>}
        </nav>
      </div>
      <div className="admin-calendar-grid" aria-label="ปฏิทินรายเดือน">
        {weekdays.map(label => <b className="admin-calendar-weekday" key={label} aria-hidden="true">{label}</b>)}
        {Array.from({length:month.getUTCDay()},(_,index) => <span key={index} aria-hidden="true"/>)}
        {dates.map((date,index) => {
          const matches = dayStatuses(date,periods)
          const rate = rates[index]
          const price = matches[0] === 'closed' ? '' : perPlot ? plotPriceLabel(rate,plotPrices)
            : formatNumber.format(personPriceFor(rate,1)) + ' / ' + money(personPriceFor(rate,2))
          return <Link key={date} className="admin-calendar-day" data-kind={matches[0]} data-today={date === current || undefined}
            href={adminUrl('calendar',{day:date})} scroll={false} prefetch={false} aria-current={date === day ? 'date' : undefined}
            aria-label={[dayLabel.format(new Date(date)), ...matches.map(status => statuses[status]), price].filter(Boolean).join(' · ')}>
            <strong>{index + 1}</strong>
            <span className="admin-calendar-day-label">{statuses[matches[0]]}</span>
            {price && <span className="admin-calendar-day-price">{price}</span>}
            <span className="admin-calendar-markers" aria-hidden="true">{matches.map(status => <i key={status} data-kind={status}/>)}</span>
          </Link>
        })}
      </div>
      <ul className="admin-calendar-legend" aria-label="ความหมายของสี">
        {Object.entries(statuses).map(([status,label]) => <li key={status}><i data-kind={status}/>{label}</li>)}
      </ul>
      <p className="small muted">{perPlot ? 'ราคาลานต่อล็อกต่อคืน' : 'ราคาในช่องวันที่เรียงตามผู้ใหญ่ 1 คน / 2 คน (บาทต่อคนต่อคืน)'}</p>
      <p className="small muted">เลือกวันที่เพื่อดูราคา เพิ่มวันปิดรับจอง วันหยุดพิเศษ หรือช่วงราคา</p>
    </section>
    <section className="panel stack" aria-labelledby="admin-calendar-day-title">
      <header>
        <p className="eyebrow">วันที่เลือก</p>
        <h2 id="admin-calendar-day-title">{dayLabel.format(new Date(day))}</h2>
      </header>
      <div className="admin-calendar-legend">
        {selectedStatuses.map(status => <span key={status}><i data-kind={status}/>{statuses[status]}</span>)}
      </div>
      {selectedStatuses[0] === 'closed' ? <p className="notice error">วันนี้ปิดรับจอง — ราคาที่ตั้งไว้ไม่ทำให้วันนี้เปิดจอง</p>
        : selectedSeason && <p className="notice">ใช้ช่วง “{selectedSeason.label}” ก่อนราคาวันหยุดและพื้นฐาน{perPlot && selectedRate.plot_price == null ? ' แต่ช่องราคาตามล็อกเว้นว่าง จึงใช้ราคาของแต่ละล็อก' : ''}</p>}
      {selectedStatuses[0] !== 'closed' && <div className="admin-calendar-rates">
        <h3>ราคาลานของวันที่เลือก</h3>
        <dl>
          {perPlot ? <div><dt>ต่อหนึ่งล็อกต่อคืน<small className="rate-source">{source('plot_price')}</small></dt><dd>{plotPriceLabel(selectedRate,plotPrices)}</dd></div> : <>
            {selectedRate.personTiers?.map(({min,max,price}) => <div key={min}>
              <dt>ผู้ใหญ่ {min === max ? min : `${min}–${max}`} คนต่อล็อก<small className="rate-source">ราคาตามวันและจำนวนคน</small></dt><dd>{money(price)} / คน / คืน</dd>
            </div>)}
            <div><dt>{selectedRate.personTiers ? 'ราคาเมื่อไม่เข้าเงื่อนไขตามวัน: ผู้ใหญ่ 1 คนต่อล็อก' : 'ผู้ใหญ่ 1 คนต่อล็อก'}<small className="rate-source">{source('solo_person_price')}</small></dt>
              <dd>{money(selectedRate.solo_person_price)} / คืน</dd></div>
            <div><dt>{selectedRate.personTiers ? 'ราคาเมื่อไม่เข้าเงื่อนไขตามวัน: ผู้ใหญ่ 2 คนขึ้นไปต่อล็อก' : 'ผู้ใหญ่ 2 คนขึ้นไปต่อล็อก'}<small className="rate-source">{source('person_price')}</small></dt>
              <dd>{money(selectedRate.person_price)} / คน / คืน</dd></div>
          </>}
        </dl>
      </div>}
      <div className="actions admin-calendar-types" aria-label="เพิ่มช่วงในวันที่เลือก">
        {Object.entries(kinds).map(([type,label]) => <Link key={type} className={'button' + (kind === type ? '' : ' secondary')}
          aria-current={kind === type ? 'true' : undefined} href={adminUrl('calendar',{day,kind:type})} scroll={false} prefetch={false}>+ {label}</Link>)}
      </div>
      {kind && <PeriodForm key={day + kind} day={day} kind={kind}/>}
      <div className="stack admin-calendar-periods">
        <h3>ช่วงที่ครอบคลุมวันที่เลือก</h3>
        {!selectedPeriods.length && <p className="small muted">ยังไม่มีช่วงที่กำหนดสำหรับวันนี้</p>}
        {selectedPeriods.map(period => <details key={period.id}>
          <summary><strong>{period.label}</strong><small>{kinds[period.kind]} · {period.start_date} – {period.end_date}</small></summary>
          <PeriodForm period={period} day={day}/>
        </details>)}
      </div>
    </section>
  </div>
}
