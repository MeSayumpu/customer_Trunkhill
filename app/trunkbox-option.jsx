'use client'

import { useState } from 'react'
import { CampLoader } from './camp-loader'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'
import { PhotoGallery } from './photo-stage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { zoneFeatureIcon } from '../lib/zone-features'
import { roomGuestText } from './room-guest-picker'

// Main photo first, then the room's extra photos in the admin's order.
const roomPhotos = (room,t) => [
  ...(room.has_photo ? ['/admin/inventory-photo/' + encodeURIComponent(room.code)] : []),
  ...String(room.gallery || '').split(',').filter(Boolean).map(id => '/api/inventory-gallery/' + id),
].map((src,index) => ({src,alt:t('{name} รูปที่ {n}',{name:t(room.name),n:index + 1})}))

export function TrunkboxOption({rooms,counts,ready,busy,roomGuests = {},onSelect,onRemove}) {
  const {t,lang,money} = useI18n()
  const [detailCode,setDetailCode] = useState(null)
  const detail = rooms.find(room=>room.code===detailCode) ?? rooms[0]
  const roomFeatures = detail?.features ? [...detail.features.highlights,...detail.features.facilities] : []
  return <section className="option-panel accommodation-option" aria-labelledby="trunkbox-title">
    <div className="panel stack">
      <header className="option-head">
        <span className="option-head-icon" aria-hidden="true"><CustomerIcon name="cabin"/></span>
        <div><h2 id="trunkbox-title">Trunkbox</h2><p className="muted small">{t('ห้องพักพร้อมนอน เลือกห้องแล้วเพิ่มอุปกรณ์ได้ในขั้นสรุปการจอง')}</p></div>
      </header>
      {!ready ? <CampLoader label={t('กำลังตรวจสอบห้องว่าง…')}/> : rooms.length ? <div className="room-choice-list">
        {rooms.map(room=>{
          const available = Number(room.available) > 0
          const checked = !!counts[room.code]
          const guests = checked && roomGuests[room.code]
          return <div className="room-choice-item" key={room.code}>
            <label className="room-choice" data-checked={checked || undefined} data-booked={!available && !checked || undefined}>
              {/* Ticking a room opens its guest picker; the room is only picked once the guests are confirmed. */}
              <input type="checkbox" checked={checked} disabled={busy || (!available && !checked)}
                onChange={event=>event.target.checked ? onSelect(room.code) : onRemove(room.code)}/>
              <span className="room-choice-text"><strong>{t(room.name)}</strong><small>{t(room.detail)}</small>
                <small className="room-choice-price">{t('{price} / คืน · รวม {base} คน · เพิ่มคนละ {extra} · สูงสุด {max} คน',
                  {price:money(room.price),base:room.room_base_guests,extra:money(room.room_extra_guest_price),max:room.room_max_guests})}</small></span>
              <span className={'status-pill ' + (checked ? 'selected' : available ? 'available' : 'booked')}>{t(checked ? 'เลือกอยู่' : available ? 'ว่าง' : 'จองแล้ว')}</span>
            </label>
            {guests && <div className="room-choice-guests"><span><CustomerIcon name="guests"/>{roomGuestText(guests,t)}</span>
              <button type="button" className="button secondary button-sm" disabled={busy} onClick={()=>onSelect(room.code)}>{t('แก้ไขผู้เข้าพัก')}</button></div>}
          </div>
        })}
      </div> : <p className="empty">{t('ยังไม่มีห้องพักเปิดให้จอง')}</p>}
    </div>
    <div className="panel stack">
      <h3 className="option-subhead"><CustomerIcon name="gallery"/> {t('รูปและรายละเอียดห้อง')}</h3>
      {rooms.length > 1 && <div className="segmented room-detail-tabs" role="group" aria-label={t('รูปภาพและรายละเอียดห้องพัก')}>
        {rooms.map(room=><button type="button" key={room.code} aria-pressed={detail?.code===room.code} onClick={()=>setDetailCode(room.code)}>{t(room.name)}</button>)}
      </div>}
      {detail && <div className="room-detail-content">
        <PhotoGallery key={detail.code} photos={roomPhotos(detail,t)} emptyText={t('ยังไม่มีรูปภาพของ {name}',{name:t(detail.name)})}
          listLabel={t('รูปทั้งหมดของ {name}',{name:t(detail.name)})}/>
        <h3>{t(detail.name)}</h3><p>{detail.detail ? t(detail.detail) : t('ยังไม่มีรายละเอียดเพิ่มเติม')}</p>
        {/* Highlights and facilities picked for this room in admin. */}
        {roomFeatures.length > 0 && <ul className="summary-item-features room-features" role="list" aria-label={t('จุดเด่นและสิ่งอำนวยความสะดวก')}>
          {roomFeatures.map((item,index) => <li key={index} title={(lang === 'en' ? item.noteEn : item.note) || undefined}>
            <FontAwesomeIcon icon={zoneFeatureIcon(item.icon)}/>{lang === 'en' ? item.labelEn || t(item.label) : item.label}
          </li>)}
        </ul>}
      </div>}
    </div>
  </section>
}
