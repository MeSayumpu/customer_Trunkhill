'use client'
import { CustomerIcon } from '../customer-icon'

import { BookingEditor } from './booking-editor'
import { PageHero } from '../page-hero'
import { RescheduleHistory } from './reschedule-history'

import { useEffect, useState } from 'react'
import { rescheduleLimit, rescheduleNoteDefault, stayNights } from '../../lib/booking-dates'
import { statuses } from '../../lib/pricing'
import { displayDate, guestTypes } from '../booking-pickers'
import { readCamp } from '../camp-request'
import { PendingScreen } from '../pending-ui'
import { CampHeader, MobileCampMenu, useCampDetails } from '../camp-navigation'
import { useI18n } from '../i18n'
import { useCampOptions } from '../use-camp-options'
import { contactHref } from '../../lib/camp-contacts'

const dateRange = ({arrival,departure}) => displayDate(arrival) + ' – ' + displayDate(departure)

function BookingSummary({booking}) {
  const {t,money,locale} = useI18n()
  const status = booking.status === 'cancelled' ? 'ยกเลิกแล้ว' : booking.checked_out ? 'Check-out แล้ว' : booking.status === 'pending' && booking.payment_required
    ? (booking.payment_submitted ? 'รอตรวจสอบการชำระเงิน' : 'รอชำระเงิน') : statuses[booking.status]
  // Lines arrive as plots, rooms, then rentals in the rental menu's order (itemOrder in lib/rentals).
  const lines = booking.lines
  const guests = guestTypes.map(([key,label]) => t(label) + ' ' + booking[key]).join(' · ')
  return <section className="panel stack booking-summary" aria-labelledby="booking-summary-title">
    <div className="section-head"><h2 id="booking-summary-title"><CustomerIcon name="receipt"/> {t('รายละเอียดการจอง')}</h2><div className="actions">
      <span className="notice"><CustomerIcon name="calendar"/> {t('เลื่อน {used}/{limit} ครั้ง',{used:booking.reschedule_count ?? 0,limit:booking.reschedule_limit??rescheduleLimit})}</span>
      <span className={'notice'+(booking.status==='cancelled'?' booking-status-cancelled':'')}><CustomerIcon name={booking.status==='cancelled'?'close':'info'}/> {t(status)}</span>
    </div></div>
    <dl className="booking-summary-fields">
      <div className="booking-summary-code"><dt>{t('รหัสการจอง')}</dt><dd><code>{booking.reference||booking.id}</code></dd></div>
      <div><dt>{t('ชื่อผู้จอง')}</dt><dd>{booking.guest}</dd></div>
      <div><dt>{t('เบอร์โทรผู้จอง')}</dt><dd>{booking.phone}</dd></div>
      <div><dt>{t('วันเวลาที่ทำรายการ')}</dt><dd>{booking.created_at ? new Date(booking.created_at.replace(' ','T')+'Z').toLocaleString(locale,{timeZone:'Asia/Bangkok'}) : '—'}</dd></div>
      <div><dt>{t('วันที่จองไว้')}</dt><dd>{dateRange(booking)} · {t('{n} คืน',{n:stayNights(booking.arrival,booking.departure)})}</dd></div>
      <div className="booking-summary-guests"><dt>{t('จำนวนผู้เข้าพัก')}</dt><dd>{t('{n} คน',{n:booking.adults + booking.children + booking.seniors})}<br/><small>{guests}</small></dd></div>
    </dl>
    <div>
      <h3>{t('ล็อก ห้องพัก และอุปกรณ์')}</h3>
      <ul className="booking-summary-lines" role="list">
        {lines.map(line => <li key={line.code}>
          <div><strong>{t(line.name)} × {line.quantity}</strong></div>
          <span>{money(line.amount)}</span>
        </li>)}
      </ul>
    </div>
    {booking.tent_discount > 0 && <div className="review-cost"><span>{t('ส่วนลดค่าเช่าเต็นท์')}</span><strong>−{money(booking.tent_discount)}</strong></div>}
    <div className="review-cost review-total"><strong>{t('ยอดจอง')}</strong><strong>{money(booking.total)}</strong></div>
  </section>
}

export function BookingManagement() {
  const {t,msg,lang} = useI18n()
  const {contacts,rescheduleNote} = useCampOptions()
  const campPhone = contacts.tel
  const [booking,setBooking]=useState(null)
  const [phone,setPhone]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [editing,setEditing]=useState(false)
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[editing,booking?.id,message])
  const {dialogs,...menuActions}=useCampDetails()
  async function search(event) {
    event.preventDefault()
    const data=new FormData(event.currentTarget),number=String(data.get('phone'))
    setBusy(true);setError('');setMessage('')
    try {setBooking(await readCamp('/api/camp',{action:'lookup',id:String(data.get('id')).trim(),phone:number}));setPhone(number)}
    catch(error){setError(error.message)}finally{setBusy(false)}
  }
  const remaining=booking?Math.max(0,(booking.reschedule_limit??rescheduleLimit)-booking.reschedule_count):0
  // Admin's own description (settings → reschedule terms) or the built-in one; {days} and {n} are filled in either way.
  const noteParams={days:booking?.reschedule_notice_days,n:booking?.reschedule_limit??rescheduleLimit}
  const customNote=(lang==='en'&&rescheduleNote?.en?.trim())||rescheduleNote?.th?.trim()
  const noteLines=(customNote?customNote.replace(/\{(days|n)\}/g,(_,key)=>noteParams[key]):t(rescheduleNoteDefault,noteParams)).split('\n').filter(line=>line.trim())
  const saved=value=>{setBooking(value);setEditing(false);setMessage('บันทึกการแก้ไขแล้ว ใช้สิทธิ์ 1 ครั้ง')}
  if(editing&&booking)return <BookingEditor booking={booking} phone={phone} onClose={()=>setEditing(false)} onSaved={saved}/>
  return <div className="camp-home customer-compact booking-management">
    {busy&&<PendingScreen label="กำลังค้นหาการจอง…"/>}
    <CampHeader onCampInfo={menuActions.onCampInfo} onZoneDetails={menuActions.onZoneDetails} lookup/>
    <PageHero aria-labelledby="manage-booking-title"><div className="booking-hero-copy">
      <h1 id="manage-booking-title">{t('ตรวจสอบการจอง')}</h1>
    </div></PageHero>
    <main className={'camp-shell stack manage-booking'+(booking?'':' manage-booking-search')}>
      {!booking&&<form onSubmit={search} className="panel stack booking-lookup">
        <div className="booking-lookup-fields">
          <label>{t('รหัสการจอง')}<input name="id" required maxLength={64} autoCapitalize="characters" spellCheck={false} disabled={busy}/></label>
          <label>{t('เบอร์โทรผู้จอง')}<input name="phone" type="tel" autoComplete="tel" required maxLength={24} disabled={busy}/></label>
        </div>
        {error&&<p className="notice error" role="alert">{msg(error)}</p>}
        <button className="button" disabled={busy}>{t('ค้นหาการจอง')}</button>
      </form>}
      {booking&&<>

        {message&&<p className="notice" role="status">{t(message)}</p>}
        <BookingSummary booking={booking}/>
        <RescheduleHistory history={booking.history}/>
        {booking.status==='cancelled'&&<section className="panel stack" aria-label={t('ติดต่อแอดมินเรื่องการยกเลิก')}>
          <h2>{t('ติดต่อแอดมิน')}</h2>
          <p>{t('รายการนี้ยกเลิกแล้ว หากมีข้อสงสัยหรือโอนเงินแล้ว กรุณาติดต่อแอดมิน พร้อมแจ้งรหัสการจอง')} <strong>{booking.reference||booking.id}</strong></p>
          <div className="actions">{campPhone&&<a className="button" href={contactHref('tel',campPhone)}>{t('โทรหาแอดมิน {phone}',{phone:campPhone})}</a>}
            <button className="button secondary" type="button" aria-haspopup="dialog" onClick={menuActions.onCampInfo}>{t('ดูข้อมูลติดต่อแคมป์')}</button></div>
        </section>}
        {editing?<BookingEditor booking={booking} phone={phone} onClose={()=>setEditing(false)} onSaved={saved}/>:
          <div className="actions">
            {booking.status!=='cancelled'&&<button type="button" className="button" disabled={!!booking.reschedule_block} aria-describedby={booking.reschedule_block?'booking-edit-block':undefined} onClick={()=>{setEditing(true);setMessage('')}}>{t('เลื่อน / แก้ไขการจอง')}</button>}
            <button type="button" className="button secondary" onClick={()=>{setBooking(null);setPhone('');setMessage('');setError('')}}>{t('ค้นหาอีกครั้ง')}</button>
          </div>}
        {!editing&&booking.status!=='cancelled'&&booking.reschedule_block&&<div className="notice" id="booking-edit-block">
          <strong>{t('ยังไม่สามารถเลื่อนหรือแก้ไขรายการนี้ได้')}</strong>
          <p>{msg(booking.reschedule_block)}</p>
          {campPhone&&<a className="button secondary" href={contactHref('tel',campPhone)}>{t('ติดต่อแอดมิน {phone}',{phone:campPhone})}</a>}
        </div>}
        {booking.status!=='cancelled'&&<section className="notice" aria-label={t('เงื่อนไขการแก้ไขการจอง')}>
          <strong>{t('สามารถเลื่อนหรือแก้ไขการจองได้รวม {n} ครั้ง และไม่สามารถยกเลิกการจองได้',{n:booking.reschedule_limit??rescheduleLimit})}</strong>
          <p>{t('ใช้สิทธิ์แล้ว {used} ครั้ง · เหลือ {left} ครั้ง',{used:booking.reschedule_count,left:remaining})}</p>
          {noteLines.map((line,index)=><p key={index}>{line}</p>)}
        </section>}
      </>}
    </main>
    <MobileCampMenu page="lookup" {...menuActions}/>{dialogs}
  </div>
}
