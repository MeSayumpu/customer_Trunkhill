'use client'

import { useState } from 'react'
import { CampLoader } from './camp-loader'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'

export function TrunkboxOption({rooms,counts,ready,busy,onSelect,onRemove}) {
  const {t} = useI18n()
  const [detailCode,setDetailCode] = useState(null)
  const detail = rooms.find(room=>room.code===detailCode) ?? rooms[0]
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
          return <label className="room-choice" key={room.code} data-checked={checked || undefined} data-booked={!available && !checked || undefined}>
            <input type="checkbox" checked={checked} disabled={busy || (!available && !checked)}
              onChange={event=>event.target.checked ? onSelect(room.code,1) : onRemove(room.code)}/>
            <span className="room-choice-text"><strong>{t(room.name)}</strong><small>{t(room.detail)}</small></span>
            <span className={'status-pill ' + (checked ? 'selected' : available ? 'available' : 'booked')}>{t(checked ? 'เลือกอยู่' : available ? 'ว่าง' : 'จองแล้ว')}</span>
          </label>
        })}
      </div> : <p className="empty">{t('ยังไม่มีห้องพักเปิดให้จอง')}</p>}
    </div>
    <div className="panel stack">
      <h3 className="option-subhead"><CustomerIcon name="gallery"/> {t('รูปและรายละเอียดห้อง')}</h3>
      {rooms.length > 1 && <div className="segmented room-detail-tabs" role="group" aria-label={t('รูปภาพและรายละเอียดห้องพัก')}>
        {rooms.map(room=><button type="button" key={room.code} aria-pressed={detail?.code===room.code} onClick={()=>setDetailCode(room.code)}>{t(room.name)}</button>)}
      </div>}
      {detail && <div className="room-detail-content">
        {!!detail.has_photo ? <img src={'/admin/inventory-photo/'+encodeURIComponent(detail.code)} alt={t(detail.name)} loading="lazy"/> : <p className="empty">{t('ยังไม่มีรูปภาพของ {name}',{name:t(detail.name)})}</p>}
        <h3>{t(detail.name)}</h3><p>{detail.detail ? t(detail.detail) : t('ยังไม่มีรายละเอียดเพิ่มเติม')}</p>
      </div>}
    </div>
  </section>
}
