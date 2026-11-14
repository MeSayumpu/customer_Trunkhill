'use client'

import { useRef, useState } from 'react'
import { CustomerIcon } from './customer-icon'
import { ZonePhotoViewer } from './zone-photo-viewer'
import { useI18n } from './i18n'

const thumbLimit = 5

// Large photo with arrows, swipe, counter and a thumbnail row (“+N ดูทั้งหมด” opens the full-screen viewer).
export function PhotoStage({photos,emptyText,listLabel,onOpen}) {
  const {t} = useI18n()
  const [index,setIndex] = useState(0)
  const touch = useRef(null)
  const multiple = photos.length > 1
  const move = step => setIndex(current => (current + step + photos.length) % photos.length)
  if (!photos.length) return <div className="zone-stage zone-stage-empty">
    <CustomerIcon name="gallery"/><p>{emptyText}</p>
  </div>
  const photo = photos[index]
  const hidden = photos.length - thumbLimit + 1
  const thumbs = photos.length > thumbLimit ? photos.slice(0,thumbLimit - 1) : photos
  return <div className="zone-showcase-media">
    <div className="zone-stage" onKeyDown={event => {
      if (!multiple || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }} onTouchStart={event => { touch.current = event.touches[0].clientX }} onTouchEnd={event => {
      const start = touch.current
      touch.current = null
      if (start == null || !multiple) return
      const distance = event.changedTouches[0].clientX - start
      if (Math.abs(distance) > 40) move(distance > 0 ? -1 : 1)
    }}>
      <button type="button" className="zone-stage-photo" aria-label={t('ดูรูปใหญ่ {name}',{name:photo.alt})} aria-haspopup="dialog"
        onClick={event => onOpen(index,event.currentTarget)}>
        <img key={photo.src} src={photo.src} alt={photo.alt}/>
      </button>
      <span className="zone-stage-badge"><CustomerIcon name="camera"/>{t('ภาพจริงจากสถานที่')}</span>
      {multiple && <>
        <button type="button" className="zone-stage-arrow is-previous" aria-label={t('ภาพก่อนหน้า')} onClick={() => move(-1)}><CustomerIcon name="previous"/></button>
        <button type="button" className="zone-stage-arrow is-next" aria-label={t('ภาพถัดไป')} onClick={() => move(1)}><CustomerIcon name="next"/></button>
      </>}
      <span className="zone-stage-count" aria-live="polite">{index + 1} / {photos.length}</span>
    </div>
    {multiple && <div className="zone-thumbs" aria-label={listLabel}>
      {thumbs.map((item,position) => <button key={item.src} type="button" aria-pressed={position === index}
        aria-label={t('แสดง {name}',{name:item.alt})} onClick={() => setIndex(position)}>
        <img src={item.src} alt="" loading="lazy" decoding="async"/>
      </button>)}
      {photos.length > thumbLimit && <button type="button" className="zone-thumbs-more" aria-haspopup="dialog"
        aria-label={t('ดูรูปทั้งหมด {n} รูป',{n:photos.length})} onClick={event => onOpen(Math.max(index,thumbLimit - 1),event.currentTarget)}>
        <img src={photos[thumbLimit - 1].src} alt="" loading="lazy" decoding="async"/>
        <span><strong>+{hidden}</strong>{t('ดูทั้งหมด')}</span>
      </button>}
    </div>}
  </div>
}

// PhotoStage plus its own full-screen viewer, for places that do not manage a viewer themselves.
export function PhotoGallery({photos,emptyText,listLabel}) {
  const trigger = useRef(null)
  const [viewer,setViewer] = useState(null)
  return <>
    <PhotoStage photos={photos} emptyText={emptyText} listLabel={listLabel} onOpen={(index,element) => {
      trigger.current = element
      setViewer({index})
    }}/>
    {viewer && <ZonePhotoViewer photos={photos} index={viewer.index} onChange={index => setViewer({index})} onClose={() => {
      setViewer(null)
      trigger.current?.focus({preventScroll:true})
    }}/>}
  </>
}
