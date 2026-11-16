'use client'

import { useState } from 'react'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'
import { guestTypes } from './booking-pickers'
import { guestTypeText, normalizeGuestTypes } from '../lib/guest-types'

// Shown as "ผู้ใหญ่ 2 · ผู้สูงอายุ 1 · เด็ก 1"; empty groups are left out.
export const roomGuestText = (guests,t) => guestTypes.filter(([key]) => guests[key]).map(([key,label]) => t(label) + ' ' + guests[key]).join(' · ')

// Guests of one Trunkbox room. Unlike the plot picker, seniors pay like adults here, so only children are free.
// Adults + seniors + children together may not exceed what the room takes.
export function RoomGuestPicker({room, initial, onConfirm, onCancel, guestInfo}) {
  const {t,money,lang} = useI18n()
  const info = normalizeGuestTypes(guestInfo)
  const detail = key => guestTypeText(info[key],'detail',lang,t)
  const note = key => guestTypeText(info[key],'note',lang,t)
  const [guests,setGuests] = useState(initial ?? {adults:Math.min(2,room.room_max_guests),seniors:0,children:0})
  const paying = guests.adults + guests.seniors
  // Everyone counts towards what the room takes, children included.
  const full = paying + guests.children >= room.room_max_guests
  const adjust = (key,step) => setGuests(previous => ({...previous,[key]:Math.max(0,previous[key] + step)}))
  return <div className="stack picker-content room-guest-picker">
    <h2 id="room-guest-title">{t('ผู้เข้าพัก {name}',{name:t(room.name)})}</h2>
    {guestTypes.map(([key,label]) => <div className="guest-row" key={key}>
      <div className="guest-description"><div className="guest-type-label"><strong>{t(label)}</strong>{key === 'children' && <span className="free-guest-badge">{t('ฟรี')}{note(key) && <span className="free-guest-mark" aria-hidden="true">*</span>}</span>}</div>
        {detail(key) && <small>{detail(key)}</small>}
        {key === 'children' && note(key) && <small className="guest-type-note"><span className="free-guest-mark">*</span> {note(key)}</small>}</div>
      <div className="guest-counter">
        <button type="button" aria-label={t('ลดจำนวน{label}',{label:t(label)})} disabled={guests[key] === 0} onClick={() => adjust(key,-1)}><CustomerIcon name="minus"/></button>
        <output aria-label={t('จำนวน{label}',{label:t(label)})}>{guests[key]}</output>
        <button type="button" aria-label={t('เพิ่มจำนวน{label}',{label:t(label)})} disabled={full} onClick={() => adjust(key,1)}><CustomerIcon name="plus"/></button>
        <span>{t('คน')}</span>
      </div>
    </div>)}
    <div className="guest-rate"><strong>{t('ค่าห้องพัก')}</strong>
      <ul className="room-rate-list">
        <li>{t('{price}/คืน สำหรับ {base} คน',{price:money(room.price),base:room.room_base_guests})}</li>
        <li>{t('ผู้เข้าพักเพิ่มเติม {extra}/คน/คืน (เฉพาะค่าเข้าพื้นที่ ไม่มีอุปกรณ์การนอน)',{extra:money(room.room_extra_guest_price)})}</li>
        <li>{t('เข้าพักได้สูงสุด {max} คน',{max:room.room_max_guests})}</li>
      </ul>
    </div>
    {paying === 0 && <p className="notice error" role="alert">{t('ต้องมีผู้ใหญ่หรือผู้สูงอายุอย่างน้อย 1 คน')}</p>}
    <div className="picker-actions">
      <button type="button" className="button secondary" onClick={onCancel}>{t('ยกเลิก')}</button>
      <button type="button" className="button" disabled={paying === 0} onClick={() => onConfirm(guests)}>{t('ยืนยัน')}</button>
    </div>
  </div>
}
