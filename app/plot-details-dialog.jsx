'use client'

import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {useCampOptions} from './use-camp-options'
import { CustomerIcon } from './customer-icon'
import { CampLoader } from './camp-loader'
import { ZonePhotoViewer } from './zone-photo-viewer'
import { GalleryCaption } from './zone-details-dialog'
import { PhotoStage } from './photo-stage'
import { useI18n } from './i18n'
import { zoneFeatureIcon } from '../lib/zone-features'

function FeatureList({items,className}) {
  const {t,lang} = useI18n()
  const text = (thai,english) => lang === 'en' ? english || t(thai) : thai
  return <ul className={className} role="list">
    {items.map((item,index) => <li key={index}>
      <span className="zone-feature-icon" aria-hidden="true"><FontAwesomeIcon icon={zoneFeatureIcon(item.icon)}/></span>
      <span className="zone-feature-text"><strong>{text(item.label,item.labelEn)}</strong>
        {item.note && <small>{text(item.note,item.noteEn)}</small>}</span>
    </li>)}
  </ul>
}

function ZoneDescription({text}) {
  const {t} = useI18n()
  const body = useRef(null)
  const [open,setOpen] = useState(false)
  const [long,setLong] = useState(false)
  useEffect(() => {
    const element = body.current
    if (element) setLong(element.scrollHeight > element.clientHeight + 2)
  },[text])
  return <div className="zone-showcase-description">
    <p ref={body} data-open={open || undefined}>{t(text)}</p>
    {(long || open) && <button type="button" className="text-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? t('ย่อข้อความ') : t('อ่านเพิ่มเติม')}<CustomerIcon name="more" className={open ? 'is-flipped' : ''}/>
    </button>}
  </div>
}

function ZoneStage({zone,photos,onOpen}) {
  const {t} = useI18n()
  return <PhotoStage photos={photos} onOpen={onOpen} emptyText={t('ยังไม่มีรูปภาพสำหรับโซน {zone}',{zone})}
    listLabel={t('รูปทั้งหมดของโซน {zone}',{zone})}/>
}

export function PlotDetailsDialog({onClose}) {
  const {t,msg} = useI18n()
  const options=useCampOptions()
  const zoneKey=options.zones.filter(z=>z!=='BOX').join(',')
  const zones=zoneKey.split(',')
  const dialog = useRef(null)
  const photoTrigger = useRef(null)
  const [tab,setTab] = useState(zones[0] || 'A')
  const [data,setData] = useState(null)
  const [error,setError] = useState('')
  const [viewer,setViewer] = useState(null)
  useEffect(() => {
    dialog.current.showModal()
    const controller = new AbortController()
    Promise.all(zones.map(async zone => {
      const response = await fetch('/api/zone-details?' + new URLSearchParams({zone}),{signal:controller.signal})
      if (!response.ok) throw new Error('โหลดรูปภาพไม่สำเร็จ กรุณาปิดแล้วลองอีกครั้ง')
      return [zone,await response.json()]
    })).then(entries => { if (!controller.signal.aborted) setData(Object.fromEntries(entries)) })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  },[zoneKey])
  const zone = data?.[tab]
  const photos = (zone?.media ?? []).filter(item=>item.kind==='image').map((item,index)=>({
    src:'/api/zone-media/'+item.id,alt:t('ภาพโซน {zone} รูปที่ {n}',{zone:tab,n:index+1}),
  }))
  const videos = data ? zones.flatMap(code=>(data[code]?.media||[]).filter(item=>item.kind==='video').map(item=>({...item,zone:code}))) : []
  const highlights = zone?.features?.highlights ?? []
  const facilities = zone?.features?.facilities ?? []
  return <>
    <dialog ref={dialog} className="dialog plot-gallery-dialog" aria-labelledby="plot-gallery-title" onClose={onClose}>
      <header className="dialog-header plot-gallery-header">
        <span className="dialog-header-icon" aria-hidden="true"><CustomerIcon name="gallery"/></span>
        <div><h2 id="plot-gallery-title">{t('ดูรูปแต่ละโซน')}</h2><p className="plot-gallery-subtitle">{t('ภาพจริง จุดเด่น และสิ่งอำนวยความสะดวกของแต่ละโซน')}</p></div>
        <form method="dialog"><button className="icon-button" aria-label={t('ปิดรายละเอียดล็อก')}><CustomerIcon name="close"/></button></form>
      </header>
      <div className="plot-gallery-tabs" aria-label={t('โซนและวิดีโอ')}>
        {[...zones,'video'].map(id=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>{
          setTab(id)
          dialog.current.scrollTop=0
        }}>{id==='video' ? <><CustomerIcon name="video"/><span>{t('วิดีโอ')}</span></> : <><CustomerIcon name="tent"/><span>{t('โซน {zone}',{zone:id})}</span></>}</button>)}
      </div>
      {error && <p className="notice error" role="alert">{msg(error)}</p>}
      {!data && !error && <CampLoader label={t('กำลังโหลดรูปภาพ…')}/>}
      {data && tab!=='video' && <div className="zone-showcase" key={tab}>
        <ZoneStage zone={tab} photos={photos} onOpen={(index,trigger)=>{
          photoTrigger.current=trigger
          setViewer({photos,index})
        }}/>
        <section className="zone-showcase-info" aria-labelledby="zone-showcase-title">
          <h3 id="zone-showcase-title">{t('รายละเอียดโซน {zone}',{zone:tab})}</h3>
          {zone?.description ? <ZoneDescription text={zone.description}/> :
            !highlights.length && !facilities.length && <p className="zone-showcase-empty">{t('ยังไม่มีรายละเอียดเพิ่มเติมสำหรับโซนนี้')}</p>}
          {highlights.length > 0 && <FeatureList items={highlights} className="zone-highlights"/>}
          {facilities.length > 0 && <div className="zone-facilities">
            <h4>{t('สิ่งอำนวยความสะดวก')}</h4>
            <FeatureList items={facilities} className="zone-facility-list"/>
          </div>}
          {zone?.gallery_caption && <GalleryCaption text={zone.gallery_caption}/>}
        </section>
      </div>}
      {data && tab==='video' && <div className="plot-gallery-images plot-gallery-videos">
        {videos.length ? videos.map(video=><figure key={video.id}><video controls playsInline preload="none" src={'/api/zone-media/'+video.id} aria-label={t('วิดีโอโซน {zone}',{zone:video.zone})}/><figcaption>{t('โซน {zone}',{zone:video.zone})}</figcaption></figure>) : <p className="empty">{t('ยังไม่มีวิดีโอ')}</p>}
      </div>}
    </dialog>
    {viewer && <ZonePhotoViewer {...viewer} onChange={index=>setViewer(current=>({...current,index}))} onClose={()=>{
      setViewer(null)
      photoTrigger.current?.focus({preventScroll:true})
    }}/>}
  </>
}
