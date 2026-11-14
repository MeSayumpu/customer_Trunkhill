'use client'

import { CustomerIcon } from './customer-icon'

import { useEffect, useRef, useState } from 'react'
import {useCampOptions} from './use-camp-options'
import { zones } from '../lib/pricing'
import { CampLoader } from './camp-loader'
import { readCamp } from './camp-request'
import { ZonePhotoViewer } from './zone-photo-viewer'
import { useI18n } from './i18n'

const tabs = [
  ['gallery',['ภาพ','บรรยากาศ']], ['details',['รายละเอียด','แคมป์']],
  ['gear',['อุปกรณ์','ให้เช่า']], ['rules',['กฎการ','เข้าพัก']],
]

export function GalleryCaption({text}) {
  const {t} = useI18n()
  return <p className="zone-gallery-caption">{t(text).split(/(https?:\/\/[^\s<>"']+)/gi).map((part,index) => {
    if (index % 2 === 0) return part
    const link = part.replace(/[),.!?;]+$/, '')
    let url
    try { url = new URL(link) } catch { return part }
    const hostname = url.hostname
    const facebook = /(^|\.)facebook\.com$/.test(hostname) || hostname === 'fb.watch'
    const tiktok = /(^|\.)tiktok\.com$/.test(hostname)
    if ((!facebook && !tiktok) || url.username || url.password) return part
    return <span key={index}><a href={url.href} target="_blank" rel="noopener noreferrer">
      {facebook ? 'Facebook' : 'TikTok'}</a>{part.slice(link.length)}</span>
  })}</p>
}

export function ZoneDetailsDialog({zone,label,gear,onClose,initialTab='gallery',onZoneChange}) {
  const {t,msg,money} = useI18n()
  const {zones}=useCampOptions()
  const dialog = useRef(null)
  const [tab,setTab] = useState(initialTab)
  const [data,setData] = useState(null)
  const [error,setError] = useState('')
  const [gearResult,setGearResult] = useState(null)
  const [viewer,setViewer] = useState(null)
  const photoTrigger = useRef(null)

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
    const controller = new AbortController()
    fetch('/api/zone-details?' + new URLSearchParams({zone}),{signal:controller.signal})
      .then(response => {
        if (!response.ok) throw new Error('โหลดรายละเอียดโซนไม่สำเร็จ')
        return response.json()
      })
      .then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  },[zone])

  useEffect(() => {
    if (tab !== 'gear' || gear != null || gearResult) return
    const controller = new AbortController()
    readCamp('/api/camp',null,controller.signal)
      .then(({inventory}) => {
        if (!controller.signal.aborted) setGearResult({items:inventory.filter(row => row.kind === 'gear')})
      })
      .catch(() => {
        if (!controller.signal.aborted) setGearResult({error:'โหลดรายการอุปกรณ์ไม่สำเร็จ'})
      })
    return () => controller.abort()
  },[tab,gear,gearResult])

  const gearItems = gear ?? gearResult?.items ?? []
  const photos = data?.media.filter(item => item.kind === 'image').map((item,index) => ({
    src:'/api/zone-media/' + item.id, alt:t('ภาพบรรยากาศ {zone} รูปที่ {n}',{zone:label,n:index + 1}),
  })) || []
  if (data && !photos.length && zone === 'A') photos.push({src:'/camp-field.webp',alt:t('ภาพบรรยากาศ {zone}',{zone:label})})
  const video = data?.media.find(item => item.kind === 'video')
  const sections = [...tabs, ...(video ? [['video',['วิดีโอ']]] : []), ...(data?.gallery_caption ? [['caption',['คำบรรยาย']]] : [])]

  function openPhotos(event,images,index = 0) {
    photoTrigger.current = event.currentTarget
    setViewer({photos:images,index})
  }

  function closePhotos() {
    setViewer(null)
    photoTrigger.current?.focus({preventScroll:true})
  }

  const zoneDialog = <dialog ref={dialog} className="dialog zone-details-dialog" aria-labelledby="zone-dialog-title" onClose={onClose}>
    <form method="dialog" className="dialog-close"><button className="icon-button" aria-label={t('ปิดรายละเอียดลาน')}><CustomerIcon name="close"/></button></form>
    <header className="zone-dialog-heading">
      <h2 id="zone-dialog-title">{t('รายละเอียดลาน {zone}',{zone:label})}</h2>
    </header>
    {onZoneChange && <label>{t('ดูรายละเอียดของ')}<select value={zone} onChange={event=>onZoneChange(event.target.value)}>{zones.map(id=><option key={id} value={id}>{id==='BOX'?'Trunkbox':'Zone '+id}</option>)}</select></label>}
    <div className="zone-detail-tabs" aria-label={t('หมวดรายละเอียดลาน')}>
      {sections.map(([id,words]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => {
        setTab(id)
        dialog.current.scrollTop = 0
      }}>
        <CustomerIcon name={id} className="zone-detail-icon"/>
        <span className="zone-detail-label">{t(words.join(' ')).split(' ').map(word => <span key={word}>{word} </span>)}</span>
      </button>)}
    </div>
    {tab !== 'gear' && error && <p className="notice error" role="alert">{msg(error)}</p>}
    {tab !== 'gear' && !data && !error && <CampLoader label={t('กำลังโหลดรายละเอียด…')}/>}
    {video && tab === 'video' && <div className="zone-video">
      <video controls playsInline preload="none" src={'/api/zone-media/' + video.id} aria-label={t('วิดีโอบรรยากาศ {zone}',{zone:label})}/>
    </div>}
    {data && tab === 'gallery' && <div className="zone-media-panel">
      <div className="zone-photos">
        {photos.length ? photos.map((photo,position) => <figure key={photo.src}>
          <button type="button" className="zone-photo-trigger" aria-haspopup="dialog" aria-label={t('ดูรูปใหญ่ {name}',{name:photo.alt})}
            onClick={event => openPhotos(event,photos,position)}>
            <img src={photo.src} alt="" loading={position > 0 ? 'lazy' : undefined}/>
          </button>
        </figure>) :
          <p className="zone-media-empty">{t('ยังไม่มีรูปสำหรับโซนนี้')}</p>}
      </div>
    </div>}
    {data && tab === 'caption' && <GalleryCaption text={data.gallery_caption}/>}
    {data && (tab === 'details' || tab === 'rules') && <p className="zone-text">
      {tab === 'details' ? t(data.description || 'ยังไม่มีรายละเอียดสำหรับโซนนี้') :
        t(data.rules || 'เด็กอายุไม่เกิน 13 ปีและผู้สูงอายุ 65 ปีขึ้นไปเข้าพักฟรีตามราคาต่อคน\nเลื่อนวันเข้าพักได้ไม่เกิน 3 ครั้ง โดยเลื่อนล่วงหน้าอย่างน้อย 3 วันก่อนวันเข้าพักเดิม')}
    </p>}
    {tab === 'gear' && <div className="zone-text">
      <p>{t('เลือกอุปกรณ์เช่าเพิ่มเติมได้ในขั้นตรวจสอบการจอง')}</p>
      {gear == null && !gearResult && <CampLoader label={t('กำลังโหลดรายการอุปกรณ์…')}/>}
      {gear == null && gearResult?.error && <div className="notice error actions">
        <span role="alert">{t(gearResult.error)}</span>
        <button type="button" className="button secondary" onClick={() => setGearResult(null)}>{t('ลองอีกครั้ง')}</button>
      </div>}
      {gearItems.length > 0 && <ul className="zone-gear-list">
        {gearItems.map(row => <li key={row.code}>
          <div className="zone-gear-item">
            {row.has_photo ? <button type="button" className="zone-photo-trigger zone-gear-photo" aria-haspopup="dialog"
              aria-label={t('ดูรูปใหญ่ {name}',{name:t(row.name)})} onClick={event => openPhotos(event,[{src:'/admin/inventory-photo/' + row.code,alt:row.name}])}>
              <img src={'/admin/inventory-photo/' + row.code} alt="" width="48" height="48" loading="lazy"/>
            </button> : null}
            <span>{t(row.name)}</span>
          </div>
          <strong>{t('{price} / คืน',{price:money(row.price)})}</strong>
        </li>)}
      </ul>}
    </div>}
  </dialog>

  return <>
    {zoneDialog}
    {viewer && <ZonePhotoViewer {...viewer} onChange={index => setViewer(current => ({...current,index}))} onClose={closePhotos}/>}
  </>
}
