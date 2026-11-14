'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { changeStatus } from './actions'
import { AdminIcon } from './admin-icon'
import { money } from '../../lib/pricing'

export function BookingStatusActions({booking,filters,page}) {
  const [status,setStatus]=useState(null)
  const [pending,startTransition]=useTransition()
  const dialog=useRef(null),submitting=useRef(false)
  const titleId=useId(),descriptionId=useId()
  const cancel=status==='cancelled'
  useEffect(()=>{
    if(status && !dialog.current.open) dialog.current.showModal()
  },[status])
  function close() {
    if(submitting.current) return
    dialog.current.close()
    setStatus(null)
  }
  function submit(event) {
    event.preventDefault()
    if(submitting.current) return
    const data=new FormData(event.currentTarget)
    submitting.current=true
    startTransition(async()=>{
      try {
        await changeStatus(data)
        dialog.current?.close()
        setStatus(null)
      } finally {submitting.current=false}
    })
  }
  if(booking.status==='cancelled'||booking.checked_out) return null
  return <div className="actions admin-row-actions">
    {booking.status==='pending'&&(!booking.payment_required||booking.submitted_at)&&<button type="button" className="button booking-approve" onClick={()=>setStatus('confirmed')}>อนุมัติ</button>}
    <button type="button" className="button secondary admin-cancel" onClick={()=>setStatus('cancelled')}>ยกเลิก</button>
    <dialog ref={dialog} className="dialog admin-booking-confirm" data-tone={cancel?'cancel':'approve'} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event=>{event.preventDefault();event.stopPropagation();close()}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()}}}>
      {status&&<form onSubmit={submit} aria-busy={pending}>
        <input type="hidden" name="id" value={booking.id}/><input type="hidden" name="status" value={status}/>
        <input type="hidden" name="q" value={filters.q}/><input type="hidden" name="filterStatus" value={filters.status}/>
        {['from','to','kind','sort','size'].map(key=><input key={key} type="hidden" name={key} value={filters[key]}/>)}<input type="hidden" name="page" value={page}/>
        <div className="booking-confirm-heading"><span className="booking-confirm-icon"><AdminIcon name={cancel?'close':'confirmed'}/></span><button type="button" className="button secondary" aria-label="ปิดหน้าต่างยืนยัน" onClick={close} disabled={pending}><AdminIcon name="close"/></button></div>
        <h2 id={titleId}>{cancel?'ยกเลิกการจองนี้?':'อนุมัติการจองนี้?'}</h2>
        <p id={descriptionId}>{cancel?'รายการนี้จะถูกยกเลิก และคืนพื้นที่หรืออุปกรณ์ที่จองไว้ให้สามารถจองใหม่ได้':'โปรดตรวจสอบข้อมูลและการชำระเงินให้เรียบร้อย ก่อนยืนยันการอนุมัติ'}</p>
        <dl className="booking-confirm-summary"><div><dt>รหัสจอง</dt><dd>{booking.reference||booking.id}</dd></div><div><dt>ผู้จอง</dt><dd>{booking.guest}</dd></div><div><dt>วันเข้าพัก – วันออก</dt><dd>{booking.arrival} → {booking.departure}</dd></div><div><dt>ยอดรวม</dt><dd>{money(booking.total)}</dd></div></dl>
        {cancel&&<p className="booking-confirm-warning">การยกเลิกนี้ไม่ใช่การคืนเงิน หากชำระแล้ว กรุณาตรวจสอบการคืนเงินกับผู้จอง</p>}
        <div className="booking-confirm-actions"><button type="button" className="button secondary" autoFocus onClick={close} disabled={pending}>กลับไปตรวจสอบ</button><button type="submit" className={'button '+(cancel?'booking-confirm-cancel':'booking-approve')} disabled={pending}><AdminIcon name={cancel?'close':'confirmed'}/>{pending?'กำลังดำเนินการ…':cancel?'ยืนยันยกเลิกการจอง':'ยืนยันอนุมัติ'}</button></div>
        {pending&&<p role="status" className="small muted">กำลังบันทึก กรุณารอสักครู่</p>}
      </form>}
    </dialog>
  </div>
}
