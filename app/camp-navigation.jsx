'use client'

import { CustomerIcon } from './customer-icon'

import Link from './pending-ui'
import {useCampOptions} from './use-camp-options'
import { useRef, useState } from 'react'
import { readBookingDraft } from './booking-draft'
import { ZoneDetailsDialog } from './zone-details-dialog'
import { PlotDetailsDialog } from './plot-details-dialog'
import { LanguageSwitch, useI18n } from './i18n'
import { RichText } from './rich-text'
import { CampLocation, ContactActions, ContactDialog } from './camp-contacts'

export const campZoneLabel = zone => zone === 'BOX' ? 'Trunkbox' : 'Zone ' + zone

function CampInfoDialog({dialog}) {
  const {t} = useI18n()
  const {facilities,contacts,location}=useCampOptions()
  const [category,setCategory] = useState(null)
  const categories = [
    ['rules','กติกา','rules'],['bathroom','ห้องน้ำ','bathroom'],
    ['wash','จุดล้างจาน','wash'],['waste','จุดทิ้งขยะ','remove'],['cart','รถขนของ','cart'],
    ['common','อาคารส่วนกลาง + Café','cafe'],['activities','กิจกรรม','stay'],
    ['food','ร้านอาหาร','food'],['firstAid','สถานพยาบาล','firstAid'],
  ]
  const active = categories.find(([id])=>id===category)
  return <dialog ref={dialog} className="dialog sheet-dialog camp-info-dialog" aria-labelledby="camp-info-title">
    <header className="dialog-header">
      <span className="dialog-header-icon" aria-hidden="true"><CustomerIcon name="info"/></span>
      <h2 id="camp-info-title">{t('ข้อมูลทั่วไปและสิ่งอำนวยความสะดวก')}</h2>
      <form method="dialog"><button className="icon-button" aria-label={t('ปิดข้อมูลทั่วไป')}><CustomerIcon name="close"/></button></form>
    </header>
    <div className="facility-grid" aria-label={t('หมวดข้อมูลทั่วไป')}>
      {categories.map(([id,label,icon])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>
        <CustomerIcon name={icon}/><span>{t(label)}</span>
      </button>)}
    </div>
    {active ? <section className="facility-detail" aria-live="polite">
      <h3>{t(active[1])}</h3>
      {facilities[category] ? <RichText source={facilities[category]}/> : category==='rules' ? <>
        <p>{t('เลื่อนวันที่และเปลี่ยนล็อกได้ตามเงื่อนไขของแคมป์ ตรวจจำนวนครั้งและวันล่วงหน้าที่ใช้กับรายการของคุณได้ในหน้าตรวจสอบการจอง')}</p>
        <Link href="/booking" onClick={()=>dialog.current.close()}>{t('ตรวจสอบหรือเลื่อนการจอง')}</Link>
      </> : <p>{t('ยังไม่มีรายละเอียดในหมวดนี้ ติดต่อแคมป์เพื่อสอบถามข้อมูลเพิ่มเติม')}</p>}
    </section> : <p className="facility-hint">{t('เลือกหมวดด้านบนเพื่อดูรายละเอียด')}</p>}
    <section className="facility-contacts" aria-labelledby="camp-contact-title">
      <h3 id="camp-contact-title">{t('ติดต่อแคมป์')}</h3>
      <ContactActions contacts={contacts}/>
      <CampLocation location={location} headingLevel={4}/>
    </section>
  </dialog>
}

export function useCampDetails({zone,gear} = {}) {
  const {zones}=useCampOptions()
  const campDialog = useRef(null)
  const [detailsZone,setDetailsZone] = useState(null)
  const [detailsTab,setDetailsTab] = useState('gallery')
  const [plotDetails,setPlotDetails] = useState(false)

  function openZoneDetails() {
    const selected = zone ?? readBookingDraft()?.zone
    setDetailsZone(zones.includes(selected) ? selected : zones[0])
  }

  return {
    onZoneDetails:() => setPlotDetails(true),
    onGeneralDetails:() => {setDetailsTab('details');openZoneDetails()},
    onCampInfo:() => {
      campDialog.current.showModal()
      campDialog.current.scrollTop = 0
    },
    dialogs:<>
      <CampInfoDialog dialog={campDialog}/>
      {plotDetails && <PlotDetailsDialog onClose={()=>setPlotDetails(false)}/>}
      {detailsZone && <ZoneDetailsDialog key={detailsZone} zone={detailsZone} label={campZoneLabel(detailsZone)} initialTab={detailsTab}
        onZoneChange={setDetailsZone} gear={gear} onClose={() => setDetailsZone(null)}/>}
    </>,
  }
}

export function CampHeader({onCampInfo,onZoneDetails,lookup = false,page}) {
  const {t} = useI18n()
  const [contactOpen,setContactOpen] = useState(false)
  return <><header className="site-header"><div className="camp-shell site-header-inner">
    <Link href="/" className="brand" aria-label={t('Trunkhill Campfield · หน้าจองลาน')}>
      <img src="/camp-logo-transparent.webp" alt="Trunkhill Campfield" width="145" height="92"/>
    </Link>
    <nav className="site-nav" aria-label={t('ข้อมูลการจอง')}>
      <Link className="nav-link" href="/" aria-current={page === 'home' ? 'page' : page === 'flow' ? 'location' : undefined}><CustomerIcon name="tent"/><span>{t('จองลาน')}</span></Link>
      {onZoneDetails && <button type="button" className="nav-link" aria-haspopup="dialog" onClick={onZoneDetails}><CustomerIcon name="map"/><span>{t('รายละเอียดล็อก')}</span></button>}
      <Link className="nav-link" href="/booking" aria-current={lookup ? 'page' : undefined}><CustomerIcon name="search"/><span>{t('ตรวจสอบการจอง')}</span></Link>
      <button type="button" className="nav-link" aria-haspopup="dialog" aria-label={t('ข้อมูลทั่วไปและสิ่งอำนวยความสะดวก')} onClick={onCampInfo}><CustomerIcon name="info"/><span>{t('สิ่งอำนวยความสะดวก')}</span></button>
    </nav>
    <LanguageSwitch className="header-language"/>
    <button type="button" className="button header-call" aria-haspopup="dialog" aria-label={t('ข้อมูลการติดต่อ')} onClick={() => setContactOpen(true)}>
      <CustomerIcon name="contact"/><span>{t('ข้อมูลการติดต่อ')}</span>
    </button>
  </div></header>
  {contactOpen && <ContactDialog onClose={() => setContactOpen(false)}/>}</>
}

export function MobileCampMenu({page,onZoneDetails,onCampInfo,summary}) {
  const {t} = useI18n()
  const bookingCurrent = page === 'home' ? 'page' : page === 'flow' ? 'location' : undefined
  return <div className="camp-dock" data-summary={summary ? true : undefined}>
    {summary && <div className="camp-dock-summary"><div className="camp-shell">{summary}</div></div>}
    <nav className="camp-dock-nav" aria-label={t('เมนูลูกค้า')}>
      <Link href="/" aria-current={bookingCurrent}><CustomerIcon name="tent"/><span>{t('จองลาน')}</span></Link>
      <button type="button" onClick={onZoneDetails} aria-haspopup="dialog"><CustomerIcon name="map"/><span>{t('รายละเอียดล็อก')}</span></button>
      <Link href="/booking" aria-current={page === 'lookup' ? 'page' : undefined}><CustomerIcon name="search"/><span>{t('ตรวจสอบการจอง')}</span></Link>
      <button type="button" onClick={onCampInfo} aria-haspopup="dialog" aria-label={t('ข้อมูลทั่วไปและสิ่งอำนวยความสะดวก')}><CustomerIcon name="info"/><span>{t('สิ่งอำนวยความสะดวก')}</span></button>
    </nav>
  </div>
}
