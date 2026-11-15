'use client'

import { CustomerIcon } from './customer-icon'

import { useState } from 'react'
import {useCampOptions} from './use-camp-options'
import {bookingWindowEnd} from '../lib/booking-window'
import { shiftDate } from '../lib/booking-dates'
import { useI18n } from './i18n'

const day = 86400000
const weekdays = ['อา','จ','อ','พ','พฤ','ศ','ส']
export const guestTypes = [
  ['adults', 'ผู้ใหญ่', 'อายุ 14–64 ปี'],
  ['children', 'เด็ก', 'อายุไม่เกิน 13 ปี'],
  ['seniors', 'ผู้สูงอายุ', 'อายุ 65 ปีขึ้นไป'],
]

export function displayDate(value) {
  if (!value) return 'เลือกวันที่'
  const [year, month, date] = value.split('-')
  return Number(date) + '/' + Number(month) + '/' + year
}

export function DatePicker({ dialog, arrival, departure, today, onConfirm, fixedNights, bookingWindow }) {
  const {t,lang} = useI18n()
  const monthLabel = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'th-TH-u-ca-gregory', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const options=useCampOptions()
  const windowReady=Boolean(bookingWindow||options.loaded)
  const last=bookingWindowEnd(today,options.loaded?options.window:bookingWindow||options.window),lastDeparture=shiftDate(last,1)
  const [start, setStart] = useState(arrival)
  const [end, setEnd] = useState(departure)
  const [choosingEnd, setChoosingEnd] = useState(false)
  const [month, setMonth] = useState((arrival || today).slice(0, 7))
  const first = new Date(month + '-01T00:00:00Z')
  const offset = first.getUTCDay()
  const adjacent = delta => new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)).toISOString().slice(0, 7)
  const length = (Date.parse(adjacent(1) + '-01') - first.getTime()) / day
  const nights = (Date.parse(end) - Date.parse(start)) / day

  function select(date) {
    if (fixedNights) {
      setStart(date)
      setEnd(shiftDate(date,fixedNights))
    } else if (!choosingEnd || date <= start) {
      setStart(date)
      setEnd('')
      setChoosingEnd(true)
    } else {
      setEnd(date)
      setChoosingEnd(false)
    }
  }

  return <div className="stack picker-content">
    <h2 id="date-title">{t('เลือกวันที่เข้าพัก - วันออก')}</h2>
    <div className="date-preview"><span>{t('วันเข้าพัก')} <strong>{t(displayDate(start))}</strong></span>
      <span>{t('วันออก')} <strong>{t(displayDate(end))}</strong></span>
      <b>{nights > 0 ? t('{n} คืน',{n:nights}) : t('– คืน')}</b></div>
    <div className="month-nav">
      <button className="button secondary" aria-label={t('เดือนก่อน')} disabled={month <= today.slice(0, 7)} onClick={() => setMonth(adjacent(-1))}><CustomerIcon name="previous"/></button>
      <strong>{monthLabel.format(first)}</strong>
      <button className="button secondary" aria-label={t('เดือนถัดไป')} disabled={!windowReady||month>=lastDeparture.slice(0,7)} onClick={() => setMonth(adjacent(1))}><CustomerIcon name="next"/></button>
    </div>
    <div className="calendar-grid weekdays" aria-hidden="true">{weekdays.map(label => <b key={label}>{t(label)}</b>)}</div>
    <div className="calendar-grid">
      {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
      {Array.from({ length }, (_, index) => {
        const date = month + '-' + String(index + 1).padStart(2, '0')
        const endpoint = date === start || date === end
        const inRange = date > start && date < end
        return <button key={date} aria-label={displayDate(date)} aria-pressed={endpoint}
          className={endpoint ? 'endpoint' : inRange ? 'in-range' : ''}
          disabled={!windowReady || date < today || date>(choosingEnd?lastDeparture:last) || (fixedNights && shiftDate(date,fixedNights)>lastDeparture) || (choosingEnd && (Date.parse(date) - Date.parse(start)) / day > 30)}
          onClick={() => select(date)}>{index + 1}{endpoint && <small>{date === start ? t('เข้าพัก') : t('ออก')}</small>}</button>
      })}
    </div>
    {!windowReady&&<p role="status">{t(options.error||'กำลังตรวจสอบระยะเปิดรับจอง…')}</p>}
    <p className="small muted" aria-live="polite">{fixedNights ? t('เลือกวันเข้าพักใหม่ ระบบจะคงระยะเวลาเดิม {n} คืน',{n:fixedNights}) :
      choosingEnd ? t('เลือกวันออกภายใน 30 คืน') : t('แตะวันที่เพื่อเริ่มเลือกช่วงเข้าพัก')}</p>
    <div className="picker-actions"><button className="button secondary" onClick={() => dialog.current.close()}>{t('ยกเลิก')}</button>
      <button className="button" disabled={!windowReady || !(nights >= 1 && nights <= 30) || start>last || end>lastDeparture} onClick={() => { onConfirm(start, end); dialog.current.close() }}>{t('ยืนยันวันที่')}</button></div>
  </div>
}

const guestMax = 100

// Typed guest count: digits only, no leading zero, 1–100. Clearing the field means none (0).
function GuestCountInput({value,label,onChange}) {
  const {t} = useI18n()
  const [draft,setDraft] = useState(null)
  const shown = draft ?? String(value)
  return <input className="guest-count-input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done"
    aria-label={t('จำนวน{label}',{label})} value={shown} maxLength={3}
    onFocus={event => event.currentTarget.select()}
    onChange={event => {
      const digits = event.target.value.replace(/[^0-9]/g,'').replace(/^0+/,'').slice(0,3)
      const number = Math.min(guestMax,Number(digits || 0))
      setDraft(digits ? String(number) : '')
      onChange(number)
    }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
    onBlur={() => setDraft(null)}/>
}

export function GuestPicker({ guests, setGuests, settings, rates = [], dialog, wholeCamp = false }) {
  const {t,money} = useI18n()
  const hasWeekdayRates = rates.length ? rates.some(rate => rate.personTiers?.length) : settings?.hasWeekdayRates
  function rateRange(field) {
    const values = rates.length ? rates.map(rate => rate[field]) : [settings[field]]
    const low = Math.min(...values)
    const high = Math.max(...values)
    return low === high ? money(low) : money(low) + '–' + money(high)
  }
  function adjust(key, amount) {
    setGuests(previous => ({ ...previous, [key]: Math.max(0, Math.min(guestMax, previous[key] + amount)) }))
  }
  // Plots: seniors are free only when an adult comes along; children need an adult or a senior with them.
  const seniorsPay = !wholeCamp && guests.adults === 0 && guests.seniors > 0
  const childrenAlone = !wholeCamp && guests.adults + guests.seniors === 0 && guests.children > 0
  return <div className="stack picker-content">
    <h2 id="guest-title">{t('เลือกจำนวนผู้เข้าพัก')}</h2>
    {guestTypes.map(([key, label, detail]) => <div className="guest-row" key={key}>
      <div className="guest-description"><div className="guest-type-label"><strong>{t(label)}</strong>{key !== 'adults' && !(key === 'seniors' && seniorsPay) && <span className="free-guest-badge">{t('ฟรี')}</span>}</div><small>{t(detail)}</small></div>
      <div className="guest-counter">
        <button aria-label={t('ลดจำนวน{label}',{label:t(label)})} disabled={guests[key] === 0} onClick={() => adjust(key, -1)}><CustomerIcon name="minus"/></button>
        <GuestCountInput value={guests[key]} label={t(label)} onChange={number => setGuests(previous => ({...previous,[key]:number}))}/>
        <button aria-label={t('เพิ่มจำนวน{label}',{label:t(label)})} disabled={guests[key] >= guestMax} onClick={() => adjust(key, 1)}><CustomerIcon name="plus"/></button>
        <span>{t('คน')}</span>
      </div>
    </div>)}
    <div className="guest-rate"><strong>{t('อัตราค่าเข้าพัก')}</strong><span>{t('ผู้ใหญ่ {n} คน',{n:guests.adults})}</span>
      {wholeCamp ? <b>{t('ราคาเหมาลานตามจำนวนผู้ใหญ่และคืนที่เข้าพัก เด็กและผู้สูงอายุไม่นับรวม')}</b> : settings?.mode === 'person' ? hasWeekdayRates
        ? <b>{t('ราคาขึ้นอยู่กับวันเข้าพักและจำนวนผู้ใหญ่ต่อล็อก ดูยอดรวมได้ที่หน้าตรวจสอบการจอง')}</b> : <b>
        {t('1 คนต่อล็อก {price} / คืน',{price:rateRange('solo_person_price')})}<br/>
        {t('2 คนขึ้นไปต่อล็อก {price} / คน / คืน',{price:rateRange('person_price')})}
      </b> : <b>{settings ? t('คิดราคาตามล็อก') : t('รอตรวจสอบราคา')}</b>}</div>
    {seniorsPay && <p className="notice" role="note">{t('กรณีผู้สูงอายุเข้าพักโดยไม่มีผู้ใหญ่ จะคิดราคาผู้สูงอายุตามราคาผู้ใหญ่')}</p>}
    {childrenAlone && <p className="notice error" role="alert">{t('การจองล็อกต้องมีผู้ใหญ่หรือผู้สูงอายุอย่างน้อย 1 คน')}</p>}
    <div className="picker-actions"><button className="button" onClick={() => dialog.current.close()}>{t('เสร็จสิ้น')}</button></div>
  </div>
}
