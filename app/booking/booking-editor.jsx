'use client'
import {useEffect,useRef,useState} from 'react'
import {readCamp} from '../camp-request'
import {DatePicker,displayDate} from '../booking-pickers'
import {TentList,TentMap} from '../tent-map'
import {useConfirm} from '../confirm-dialog'
import {CampHeader,MobileCampMenu,useCampDetails} from '../camp-navigation'
import {CampLoader} from '../camp-loader'
import {rescheduleLimit,rescheduleNotice,shiftDate,stayNights} from '../../lib/booking-dates'
import {wholeCampCode} from '../../lib/whole-camp'
import {CustomerIcon} from '../customer-icon'
import {useI18n} from '../i18n'

export function BookingEditor({booking,phone,onSaved,onClose}) {
 const {t,msg,money}=useI18n()
 const plots=booking.lines.filter(i=>i.kind==='plot'&&i.code!==wholeCampCode)
 const notice=booking.reschedule_notice_days??rescheduleNotice
 const limit=booking.reschedule_limit??rescheduleLimit
 const [arrival,setArrival]=useState(booking.arrival),[departure,setDeparture]=useState(booking.departure)
 const [mapping,setMapping]=useState(()=>Object.fromEntries(plots.map(i=>[i.code,i.code])))
 const [active,setActive]=useState(plots[0]?.code||''),[zone,setZone]=useState(plots[0]?.zone||'A'),[view,setView]=useState('map')
 const [catalog,setCatalog]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[quote,setQuote]=useState(null),[retry,setRetry]=useState(0)
 const dateDialog=useRef(null),[dateKey,setDateKey]=useState(0)
 const confirmation=useRef(null)
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[])
 useEffect(()=>{if(quote)confirmation.current?.scrollIntoView({block:'start',behavior:'instant'})},[quote])
 const {dialogs,...menuActions}=useCampDetails({zone})
 const confirm=useConfirm()
 const changed=arrival!==booking.arrival||departure!==booking.departure||Object.entries(mapping).some(([from,to])=>from!==to)
 async function discard(){
  if(changed&&!(await confirm({title:'ออกโดยไม่บันทึก?',message:'วันที่และล็อกใหม่ที่เลือกไว้จะถูกยกเลิก การจองเดิมจะไม่เปลี่ยนแปลง',
   items:[`${displayDate(arrival)} – ${displayDate(departure)}`,...Object.entries(mapping).filter(([from,to])=>from!==to).map(([from,to])=>from+' → '+to)],
   confirmLabel:'ทิ้งการแก้ไข',cancelLabel:'แก้ไขต่อ'})))return
  onClose()
 }
 const payload={id:booking.id,phone,revision:booking.reschedule_count,arrival,departure,plotChanges:Object.entries(mapping).map(([from,to])=>({from,to}))}
 useEffect(()=>{
  const controller=new AbortController();setCatalog(null);setQuote(null);setError('')
  readCamp('/api/camp',{action:'editCatalog',id:booking.id,phone,arrival,departure},controller.signal)
   .then(data=>{if(!controller.signal.aborted)setCatalog(data)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)})
  return ()=>controller.abort()
 },[arrival,departure,retry,booking.id,phone])
 const inventory=catalog?.inventory||[]
 const rows=inventory.filter(i=>i.kind==='plot'&&i.code!==wholeCampCode)
 const counts=Object.fromEntries(Object.values(mapping).map(code=>[code,1]))
 const shortages=catalog?booking.lines.filter(i=>i.kind!=='plot'&&Number(inventory.find(row=>row.code===i.code)?.available||0)<i.quantity):[]
 function select(row){
  if(!active||busy)return
  if(Object.entries(mapping).some(([from,to])=>from!==active&&to===row.code)){setError('ล็อกนี้ถูกเลือกสำหรับรายการอื่นแล้ว');return}
  setMapping(previous=>({...previous,[active]:row.code}));setQuote(null);setError('')
 }
 async function check(){
  setBusy(true);setQuote(null);setError('')
  try{setQuote(await readCamp('/api/camp',{...payload,action:'quoteAmendment'}))}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function save(){
  setBusy(true);setError('')
  try{onSaved(await readCamp('/api/camp',{...payload,action:'amendBooking'}))}catch(e){setError(e.message);setQuote(null)}finally{setBusy(false)}
 }
 return <div className="camp-home flow-page booking-editor-page">
  <CampHeader lookup onCampInfo={menuActions.onCampInfo} onZoneDetails={menuActions.onZoneDetails}/>
  <main className="camp-shell stack flow-shell">
   <section className="panel stack"><h1>{t('เลื่อนวันที่ / เปลี่ยนล็อก')}</h1>
    <ul className="booking-edit-rules"><li>{t('รหัสเดิม')} <strong>{booking.reference||booking.id}</strong> · {t('เลื่อนแล้ว {used}/{limit} ครั้ง',{used:booking.reschedule_count,limit})}</li>
    <li>{t('คงข้อมูลผู้จอง จำนวนคน จำนวนคืน ห้องพัก และอุปกรณ์เดิม ยอดจอง {amount}',{amount:money(booking.total)})}</li>
    <li>{t('เลื่อนล่วงหน้าอย่างน้อย {days} วัน ก่อนวันที่เข้าพัก',{days:notice})}</li></ul>
    <button type="button" className="button secondary danger-text" disabled={busy} onClick={discard}><CustomerIcon name="back"/>{t('กลับโดยไม่บันทึก')}</button>
   </section>
   <section className="camp-booking stack" aria-label={t('เลือกวันที่และล็อกใหม่')}>
    <div className="search-card">
     <button type="button" className="search-field" disabled={busy} onClick={()=>{setDateKey(k=>k+1);dateDialog.current.showModal()}}>
      <span className="search-field-icon" aria-hidden="true"><CustomerIcon name="calendar"/></span>
      <span className="search-field-text"><span>{t('เข้าพัก – วันออกใหม่')}</span><strong>{displayDate(arrival)} – {displayDate(departure)}</strong></span>
     </button>
     <div className="search-field" aria-disabled="true">
      <span className="search-field-icon" aria-hidden="true"><CustomerIcon name="guests"/></span>
      <span className="search-field-text"><span>{t('ผู้เข้าพัก / จำนวนคืนเดิม')}</span><strong>{t('{n} คน',{n:booking.adults+booking.children+booking.seniors})} · {t('{n} คืน',{n:stayNights(booking.arrival,booking.departure)})}</strong></span>
     </div>
    </div>
    {plots.length>0&&<>
     <label>{t('เลือกล็อกเดิมที่ต้องการย้าย')}<select value={active} disabled={busy} onChange={e=>setActive(e.target.value)}>{plots.map(i=><option key={i.code} value={i.code}>{t(i.name)} → {mapping[i.code]}</option>)}</select></label>

     <div className="panel stack camp-picker-panel"><h2>{active} <CustomerIcon name="arrow"/> {mapping[active] || t('เลือกล็อกใหม่')}</h2>
      <div className="segmented" role="group" aria-label={t('รูปแบบการเลือกล็อก')}><button type="button" aria-pressed={view==='map'} onClick={()=>setView('map')}><CustomerIcon name="map"/>{t('ผังลาน')}</button><button type="button" aria-pressed={view==='list'} onClick={()=>setView('list')}><CustomerIcon name="tents"/>{t('รายการล็อก')}</button></div>
      {!catalog?<CampLoader label={t('กำลังตรวจวันและสต๊อก…')}/>:view==='map'?<TentMap rows={rows} counts={counts} ready={!!catalog} busy={busy} onSelect={select} mapVersion={catalog.settings.map_version} label="เลือกล็อกใหม่บนผัง"/>
       :<TentList rows={rows} counts={counts} ready={!!catalog} busy={busy} onSelect={select}/>}
     </div>
    </>}
    <section className="panel stack"><h2>{t('รายการที่ย้ายไปด้วย')}</h2>
     {booking.lines.map(i=><div className="review-cost" key={i.code}><span>{mapping[i.code]&&mapping[i.code]!==i.code?`${t(i.name)} → ${mapping[i.code]}`:t(i.name)} × {i.quantity}</span><span>{money(i.amount)}</span></div>)}
     <p>{t('อุปกรณ์ที่ผูกกับล็อกเดิมจะย้ายตามล็อกใหม่โดยอัตโนมัติ')}</p>
     {shortages.length>0&&<div className="notice error" role="alert">{shortages.map(i=><p key={i.code}>{t('{name}: ไม่ว่างในวันที่คุณเลือก กรุณาเลือกวันอื่น',{name:t(i.name)})}</p>)}</div>}
     {error&&<p className="notice error" role="alert">{msg(error)}</p>}
     {!catalog&&error&&<button type="button" className="button secondary" onClick={()=>setRetry(n=>n+1)}>{t('ตรวจสอบอีกครั้ง')}</button>}
     <button type="button" className="button" disabled={!catalog||busy||shortages.length>0} onClick={check}>{busy?t('กำลังตรวจสอบ…'):t('ตรวจวันว่าง ล็อกว่าง และสต๊อก')}</button>
    </section>
    {quote&&<section ref={confirmation} className="panel stack booking-edit-confirmation" aria-live="polite"><h2>{t('พร้อมยืนยันการเลื่อน')}</h2>
     <div className="reschedule-date old"><span>{t('วันเข้าพักเดิม')}</span><strong>{displayDate(booking.arrival)} – {displayDate(booking.departure)}</strong></div>
     <div className="reschedule-date new"><span><CustomerIcon name="calendar"/> {t('วันเข้าพักใหม่')}</span><strong>{displayDate(arrival)} – {displayDate(departure)}</strong></div>
     <p>{t('วัน ล็อก และสต๊อกเพียงพอ · ยอดเดิม {amount}',{amount:money(quote.total)})}</p>
     <p>{t('สถานะตรวจสลิปคงเดิม แอดมินจะตรวจและยืนยันการชำระเงินเอง')}</p>
     <button type="button" className="button" disabled={busy} onClick={save}>{t('ยืนยันการเลื่อน (ใช้สิทธิ์ {used}/{limit} ครั้ง)',{used:booking.reschedule_count+1,limit})}</button>
    </section>}
   </section>
  </main>
  <dialog ref={dateDialog} className="dialog booking-picker" aria-labelledby="date-title">
   <div className="dialog-close"><button type="button" className="icon-button" aria-label={t('ปิดตัวเลือกวันที่')} onClick={()=>dateDialog.current.close()}><CustomerIcon name="close"/></button></div>
   <DatePicker key={dateKey} dialog={dateDialog} arrival={arrival} departure={departure} today={shiftDate(booking.today,notice)} fixedNights={stayNights(booking.arrival,booking.departure)} onConfirm={(a,d)=>{setArrival(a);setDeparture(d);setQuote(null)}}/>
  </dialog>
  <MobileCampMenu page="lookup" {...menuActions}/>{dialogs}
 </div>
}
