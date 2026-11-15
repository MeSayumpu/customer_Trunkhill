'use client'

import { useState } from 'react'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'
import { guestTypes } from './booking-pickers'
import { roomExtraGuests } from '../lib/pricing'
import { guestTypeText, normalizeGuestTypes } from '../lib/guest-types'

// Shown as "ผู้ใหญ่ 2 · ผู้สูงอายุ 1 · เด็ก 1"; empty groups are left out.
export const roomGuestText = (guests,t) => guestTypes.filter(([key]) => guests[key]).map(([key,label]) => t(label) + ' ' + guests[key]).join(' · ')

// Guests of one Trunkbox room. Unlike the plot picker, seniors pay like adults here, so only children are free.
// Adults + seniors may not exceed what the room takes; children are not counted.
export function RoomGuestPicker({room, initial, nights, onConfirm, onCancel, guestInfo}) {
  const {t,money,lang} = useI18n()
  const info = normalizeGuestTypes(guestInfo)
  const detail = key => guestTypeText(info[key],'detail',lang,t)
  const note = key => guestTypeText(info[key],'note',lang,t)
  const [guests,setGuests] = useState(initial ?? {adults:Math.min(2,room.room_max_guests),seniors:0,children:0})
  const paying = guests.adults + guests.seniors
  const full = paying >= room.room_max_guests
  const extra = roomExtraGuests({...room,guests})
  const perNight = room.price + extra * room.room_extra_guest_price
  const adjust = (key,step) => setGuests(previous => ({...previous,[key]:Math.max(0,Math.min(key === 'children' ? 20 : 100,previous[key] + step))}))
  return <div className="stack picker-content room-guest-picker">
    <h2 id="room-guest-title">{t('ผู้เข้าพัก {name}',{name:t(room.name)})}</h2>
    <p className="small muted">{t('ราคาห้อง {price} / คืน รวมผู้เข้าพัก {base} คน · รับได้สูงสุด {max} คน (ไม่นับเด็ก)',
      {price:money(room.price),base:room.room_base_guests,max:room.room_max_guests})}</p>
    {guestTypes.map(([key,label]) => <div className="guest-row" key={key}>
      <div className="guest-description"><div className="guest-type-label"><strong>{t(label)}</strong>{key === 'children' && <span className="free-guest-badge">{t('ฟรี')}{note(key) && <span className="free-guest-mark" aria-hidden="true">*</span>}</span>}</div>
        {detail(key) && <small>{detail(key)}</small>}
        {key === 'children' && note(key) && <small className="guest-type-note"><span className="free-guest-mark">*</span> {note(key)}</small>}</div>
      <div className="guest-counter">
        <button type="button" aria-label={t('ลดจำนวน{label}',{label:t(label)})} disabled={guests[key] === 0} onClick={() => adjust(key,-1)}><CustomerIcon name="minus"/></button>
        <output aria-label={t('จำนวน{label}',{label:t(label)})}>{guests[key]}</output>
        <button type="button" aria-label={t('เพิ่มจำนวน{label}',{label:t(label)})} disabled={key === 'children' ? guests.children >= 20 : full} onClick={() => adjust(key,1)}><CustomerIcon name="plus"/></button>
        <span>{t('คน')}</span>
      </div>
    </div>)}
    <div className="guest-rate"><strong>{t('ค่าห้องพัก')}</strong>
      <span>{t('ผู้ใหญ่และผู้สูงอายุ {n} คน',{n:paying})}</span>
      <b>{extra > 0
        ? t('{price} + คนเพิ่ม {n} คน × {extra} = {total} / คืน',{price:money(room.price),n:extra,extra:money(room.room_extra_guest_price),total:money(perNight)})
        : t('{price} / คืน',{price:money(perNight)})}
        {nights > 1 && <><br/>{t('รวม {n} คืน {total}',{n:nights,total:money(perNight * nights)})}</>}</b>
      {full && <small>{t('ครบจำนวนสูงสุดของห้องแล้ว')}</small>}
    </div>
    {paying === 0 && <p className="notice error" role="alert">{t('ต้องมีผู้ใหญ่หรือผู้สูงอายุอย่างน้อย 1 คน')}</p>}
    <div className="picker-actions">
      <button type="button" className="button secondary" onClick={onCancel}>{t('ยกเลิก')}</button>
      <button type="button" className="button" disabled={paying === 0} onClick={() => onConfirm(guests)}>{t('ยืนยัน')}</button>
    </div>
  </div>
}
