'use client'

import {prepareUploads} from '../upload-files'
import { roomGuestText } from '../room-guest-picker'
import Link, { PendingScreen } from '../pending-ui'
import { useEffect, useState, useRef } from 'react'
import {bookingReceiptFile,canShareReceipt,downloadReceiptFile} from '../booking-receipt-image'
import { displayDate } from '../booking-pickers'
import { PagedItems } from '../paged-items'
import { CampLoader } from '../camp-loader'
import { CampHeader, MobileCampMenu, useCampDetails } from '../camp-navigation'
import { BookingSteps } from '../booking-steps'
import { PageHero } from '../page-hero'
import { CustomerIcon } from '../customer-icon'
import { useConfirm } from '../confirm-dialog'
import { useI18n } from '../i18n'
import { useCampOptions } from '../use-camp-options'

export function PaymentScreen({id}) {
  const {contacts} = useCampOptions()
  const i18n = {...useI18n(), phone:contacts.tel}
  const {t,msg,money} = i18n
  const confirmAction = useConfirm()
  const [booking,setBooking] = useState(null)
  const [deadline,setDeadline] = useState(0)
  const [seconds,setSeconds] = useState(0)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [file,setFile] = useState(null)
  const [preview,setPreview] = useState('')
  const [downloadMessage,setDownloadMessage] = useState('')
  const autoDownloaded=useRef(false)
  useEffect(()=>{
    if(!file || !file.type.startsWith('image/')){setPreview('');return}
    const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)
  },[file])
  // The proof image is drawn as soon as the result page shows, so the share sheet can open straight from the tap
  // (iOS only allows it while the tap is still "fresh", which drawing the image first would use up).
  const [receipt,setReceipt] = useState(null)
  const [receiptUrl,setReceiptUrl] = useState('')
  const [showReceipt,setShowReceipt] = useState(false)
  useEffect(()=>{
    if(!receipt)return
    const url=URL.createObjectURL(receipt);setReceiptUrl(url);return()=>URL.revokeObjectURL(url)
  },[receipt])
  async function downloadReceipt(){
    try{
      const file=receipt||await bookingReceiptFile(booking,i18n)
      if(!receipt)setReceipt(file)
      if(canShareReceipt(file)){
        try{await navigator.share({files:[file]});setDownloadMessage('')}
        catch(error){
          // Closing the share sheet is not a failure; anything else falls back to the image shown for long-press saving.
          if(error?.name!=='AbortError'){setShowReceipt(true);setDownloadMessage('กดค้างที่รูปด้านล่าง แล้วเลือกบันทึกรูปภาพ')}
        }
        return
      }
      downloadReceiptFile(file)
      // Touch browsers without file sharing (some in-app browsers) often block downloads too, so the image is shown as well.
      if(matchMedia('(pointer:coarse)').matches){setShowReceipt(true);setDownloadMessage('หากรูปไม่ถูกบันทึก กดค้างที่รูปด้านล่าง แล้วเลือกบันทึกรูปภาพ')}
      else setDownloadMessage('')
    }catch{setDownloadMessage('ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง')}
  }
  const [paymentMethod,setPaymentMethod] = useState('qr')
  const [copyMessage,setCopyMessage] = useState('')
  const [cancelling,setCancelling] = useState(false)
  const {dialogs,...menuActions} = useCampDetails()

  async function load(body, signal, method = body ? 'POST' : 'GET') {
    const token = sessionStorage.getItem('trunkhill-payment-' + id)
    if (!token) throw new Error('เปิดรายการชำระเงินจากแท็บเดิม หรือใช้รหัสจองและเบอร์โทรค้นหาสถานะที่หน้าหลัก')
    const response = await fetch('/api/payment?' + new URLSearchParams({id}), {
      method,body,signal,
      headers:{Authorization:'Bearer ' + token},
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setBooking(data)
    setDeadline(Date.now() + Math.max(0,Number(data.remaining)) * 1000)
    setSeconds(Math.max(0,Number(data.remaining)))
  }

  useEffect(() => {
    const controller = new AbortController()
    load(undefined,controller.signal).catch(error => {
      if (!controller.signal.aborted) setError(error.message)
    })
    return () => controller.abort()
  },[id])

  useEffect(() => {
    if (!deadline || booking?.submitted) return
    const update = () => setSeconds(Math.max(0,Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const timer = setInterval(update,250)
    return () => clearInterval(timer)
  },[deadline,booking?.submitted])

  async function confirm(event) {
    event.preventDefault()
    if (busy || cancelling || !seconds) return
    const body = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await prepareUploads(body,{booking:id,token:sessionStorage.getItem('trunkhill-payment-'+id)});await load(body)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelBooking() {
    if (busy || cancelling) return
    const accepted = await confirmAction({
      title:'ยกเลิกการจองนี้?',
      message:'ระบบจะคืนล็อกและอุปกรณ์ที่กันไว้ทันที และไม่สามารถกู้คืนรายการนี้ได้ หากโอนเงินแล้ว กรุณาติดต่อแคมป์ก่อนยกเลิก',
      items:booking ? [t('รหัสจอง {code}',{code:booking.reference || booking.id}) + ' · ' + money(booking.total)] : [],
      confirmLabel:'ยืนยันยกเลิกการจอง',
      cancelLabel:'ชำระเงินต่อ',
    })
    if (!accepted) return
    setCancelling(true)
    setError('')
    try {
      await load(undefined,undefined,'DELETE')
    } catch (error) {
      setError(error.message)
    } finally {
      setCancelling(false)
    }
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(booking.bank_account)
      setCopyMessage('คัดลอกเลขบัญชีแล้ว')
    } catch {
      setCopyMessage('คัดลอกอัตโนมัติไม่ได้ กรุณากดค้างที่เลขบัญชีเพื่อเลือกและคัดลอก')
    }
  }

  const done = Boolean(booking?.submitted && booking.status !== 'cancelled')
  useEffect(()=>{if(done)window.scrollTo({top:0,behavior:'instant'})},[done])
  useEffect(()=>{
    if(!done || autoDownloaded.current)return
    const key='trunkhill-receipt-downloaded-'+id
    if(sessionStorage.getItem(key))return
    autoDownloaded.current=true
    bookingReceiptFile(booking,i18n).then(file=>{
      setReceipt(file)
      // Computers still get the automatic download; phones save through the share sheet when the guest taps the button.
      if(!matchMedia('(pointer:coarse)').matches){downloadReceiptFile(file);sessionStorage.setItem(key,'1')}
    }).catch(()=>{})
  },[done,id,booking])
  const expired = booking && !booking.submitted && seconds === 0
  const cancelled = booking?.status === 'cancelled'
  const countdown = String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0')
  const nights = booking ? (Date.parse(booking.departure) - Date.parse(booking.arrival)) / 86400000 : 0
  const subtotals = { plot:0, room:0, tent:0, gear:0 }
  for (const item of booking?.items ?? []) subtotals[item.kind === 'gear' ? (item.is_tent ? 'tent' : 'gear') : item.kind] += item.amount
  const wholeCampBooking = booking?.items.some(item => item.code === 'WHOLE-CAMP')
  const code = booking?.reference || booking?.id
  return <div className="camp-home customer-compact payment-home">
    {busy && <PendingScreen label="กำลังส่งและตรวจสลิปซ้ำ…"/>}
    <CampHeader page="flow" onCampInfo={menuActions.onCampInfo} onZoneDetails={menuActions.onZoneDetails}/>
    <PageHero aria-label={t('ขั้นตอนการจอง')}><BookingSteps current={done ? 4 : 3}/></PageHero>
    <main className="camp-shell payment-shell">
      {!booking && <section className="panel stack payment-receipt">
        <h1>{t('ชำระเงิน')}</h1>
        {error ? <p role="alert">{msg(error)}</p> : <CampLoader label={t('กำลังโหลดข้อมูลการจอง…')}/>}
        {error && <Link className="button secondary" href="/">{t('กลับหน้าหลัก')}</Link>}
      </section>}
      {done && <section className="panel stack payment-receipt">
        <img loading="lazy" decoding="async" className="receipt-watermark" src="/camp-logo-transparent.webp" alt=""/>
        <span className="payment-check" aria-hidden="true"><CustomerIcon name="check"/></span>
        <h1>{booking.total > 0 ? t('ส่งหลักฐานการชำระเงินแล้ว') : t('ส่งคำขอจองแล้ว')}</h1>
        <p>{t(booking.status === 'confirmed' ? 'แคมป์ยืนยันการจองแล้ว' : booking.total > 0
          ? 'แคมป์จะตรวจสอบสลิปก่อนยืนยันการจอง' : 'รอแคมป์ยืนยันการจอง')}</p>
        <div className="payment-code"><span>{t('รหัสการจอง')}</span><strong>{code}</strong></div>
        {booking.guest && <p className="payment-guest"><span>{t('ผู้จอง')}</span> <strong>{booking.guest}</strong></p>}
        <p>{displayDate(booking.arrival)} – {displayDate(booking.departure)} · {t('{n} คืน',{n:nights})} · {money(booking.total)}</p>
        <button className="button" onClick={downloadReceipt}><CustomerIcon name="download"/> {t('บันทึกรูปหลักฐานการจอง')}</button>{/* Only a failed download says anything here. */}{downloadMessage && <p className="small muted" role="status">{t(downloadMessage)}</p>}
        {showReceipt && receiptUrl && <img className="receipt-preview" src={receiptUrl} alt={t('รูปหลักฐานการจอง')}/>}
        <Link className="button secondary" href="/">{t('กลับหน้าหลัก')}</Link>
      </section>}
      {booking && !done && <>
        <h1 className="payment-title">{t('ชำระเงิน')}</h1>
        {booking.duplicateRejected && <section className="notice error" role="alert"><strong>{t('ปฏิเสธการจอง: พบไฟล์สลิปซ้ำ')}</strong>
          <p>{t('ระบบยกเลิกรายการนี้และคืนรายการที่กันไว้แล้ว')}</p>
          {booking.phoneBlocked && <p>{t('เบอร์โทรนี้ส่งสลิปซ้ำเกิน 3 ครั้ง จึงถูกบล็อกการจอง กรุณาติดต่อแคมป์เพื่อขอปลดล็อก')}</p>}
          <button className="button secondary" type="button" onClick={menuActions.onCampInfo}>{t('ติดต่อแคมป์')}</button>
        </section>}
        <div className="payment-grid">
          <section className="panel stack payment-card payment-summary-card">
            <h2>{t('สรุปการจอง')}</h2>
            <div className="notice"><small>{t('เลขอ้างอิง')}</small><br/><strong>{code}</strong></div>
            <div className="review-cost"><span>{t('วันเข้าพัก')}</span><strong>{displayDate(booking.arrival)}</strong></div>
            <div className="review-cost"><span>{t('วันออก')}</span><strong>{displayDate(booking.departure)} · {t('{n} คืน',{n:nights})}</strong></div>
            <p>{t('ผู้ใหญ่')} {booking.adults} · {t('เด็ก')} {booking.children} · {t('ผู้สูงอายุ')} {booking.seniors}</p>
            <h3>{t('สรุปค่าใช้จ่าย')}</h3>
            <PagedItems items={booking.items} size={3} label={t('รายการค่าใช้จ่าย')}>{page => page.map((item,index) =>
              <div className="review-cost" key={index}><span>{t(item.name)} × {item.quantity}
                {item.room_adults != null && <small className="review-cost-rule"> · {roomGuestText({adults:item.room_adults,seniors:item.room_seniors,children:item.room_children},t)}</small>}</span><span>{money(item.amount)}</span></div>)}</PagedItems>
            {/* Same subtotals as the review step, so the guest can follow how the total was reached. */}
            {subtotals.plot > 0 && <div className="review-cost review-lodging-subtotal"><span>{t(wholeCampBooking ? 'รวมค่าเหมาลาน' : booking.pricing_mode === 'person' ? 'รวมค่าลานตามจำนวนคน' : 'รวมค่าลาน')}</span><span>{money(subtotals.plot)}</span></div>}
            {subtotals.room > 0 && <div className="review-cost"><span>{t('ค่าห้องพัก')}</span><span>{money(subtotals.room)}</span></div>}
            {subtotals.tent > 0 && <div className="review-cost"><span>{t('รวมค่าเช่าเต็นท์')}</span><span>{money(subtotals.tent)}</span></div>}
            {subtotals.gear > 0 && <div className="review-cost"><span>{t('รวมค่าเช่าอุปกรณ์')}</span><span>{money(subtotals.gear)}</span></div>}
            {booking.tent_discount > 0 && <div className="review-cost"><span>{t('ส่วนลดค่าเช่าเต็นท์')}</span><strong>−{money(booking.tent_discount)}</strong></div>}
            <div className="review-total review-cost"><strong>{t('ยอดรวม')}</strong><strong>{money(booking.total)}</strong></div>
            <p className="small muted">{t('หลังส่งสลิป แคมป์จะตรวจสอบการชำระเงินก่อนยืนยันรายการ')}</p>
          </section>
          <section className="panel stack payment-card payment-method-card">
            <h2>{t('วิธีการชำระเงิน')}</h2>
            {!expired && !cancelled && <div className="customer-switch" aria-label={t('ช่องทางโอนเงิน')}>
              <button type="button" aria-pressed={paymentMethod === 'qr'} onClick={() => setPaymentMethod('qr')}><CustomerIcon name="qr"/> {t('สแกน QR')}</button>
              <button type="button" aria-pressed={paymentMethod === 'bank'} onClick={() => setPaymentMethod('bank')}><CustomerIcon name="bank"/> {t('โอนเลขบัญชี')}</button>
            </div>}
            {!expired && !cancelled && paymentMethod === 'bank' && <section className="notice stack" aria-label={t('โอนผ่านบัญชีธนาคาร')}>
              <strong>{t('โอนผ่านบัญชีธนาคาร')}</strong><div className="payment-amount"><span>{t('ยอดที่ต้องโอน')}</span><strong>{money(booking.total)}</strong></div>
              {booking.bank_name && booking.bank_account ? <>
                <p>{t('ธนาคาร:')} <strong>{t(booking.bank_name)}</strong></p>
                <p>{t('ชื่อบัญชี:')} <strong>{t(booking.recipient)}</strong></p>
                <label>{t('เลขบัญชี')}<input readOnly value={booking.bank_account} aria-label={t('เลขบัญชีธนาคาร')} onFocus={event => event.target.select()} style={{fontSize:'1.25rem',fontWeight:700,letterSpacing:'.06em',width:'100%'}}/></label>
                <button type="button" className="button secondary" onClick={copyAccount}><CustomerIcon name="copy"/> {t('คัดลอกเลขบัญชี')}</button>
                <p role="status" className="small">{t(copyMessage)}</p>
                <p>{t('โอนยอด {amount} และตรวจชื่อผู้รับในแอปธนาคารก่อนยืนยัน จากนั้นแนบสลิปด้านล่าง',{amount:money(booking.total)})}</p>
              </> : <p>{t('แคมป์ยังไม่ได้ระบุบัญชีธนาคาร กรุณาติดต่อแคมป์เพื่อขอข้อมูลก่อนโอน')}</p>}
            </section>}
            {!expired && !cancelled && booking.recipient && paymentMethod === 'qr' && <div className="payment-qr">
              <div className="payment-amount"><span>{t('ยอดที่ต้องโอน')}</span><strong>{money(booking.total)}</strong></div><div className="payment-qr-heading"><span>{t('สแกน QR เพื่อโอนเงิน')}</span><strong>{booking.recipient}</strong></div>
              <a className="payment-qr-image" href="/api/payment/qr" target="_blank" rel="noreferrer" aria-label={t('เปิด QR รับเงินขนาดเต็มในแท็บใหม่')}>
                <img loading="lazy" decoding="async" src="/api/payment/qr" alt={t('QR รับเงินของแคมป์ กดเพื่อดูขนาดเต็ม')} width="360" height="360"/>
              </a>
              <div className="payment-qr-actions">
                <a className="button secondary" href="/api/payment/qr" target="_blank" rel="noreferrer"><CustomerIcon name="expand"/> {t('ขยาย QR')}</a>
                <a className="button secondary" href="/api/payment/qr" download="camp-payment-qr"><CustomerIcon name="download"/> {t('บันทึกรูป QR')}</a>
              </div>
              <p className="small muted">{t('ใช้มือถือเครื่องเดียว: บันทึกรูป แล้วเลือกรูปจากแอปธนาคารเพื่อสแกน')}</p>
            </div>}
            {!booking.recipient && !expired && !cancelled && <p className="notice error">{t('แคมป์ยังไม่ได้ตั้งค่า QR รับเงิน')}</p>}

            {expired || cancelled ? <p className="notice error payment-cancelled"><CustomerIcon name="cry"/>{cancelled ? t('รายการจองถูกยกเลิกแล้ว') : t('หมดเวลาชำระเงิน ระบบคืนรายการที่กันไว้แล้ว')}</p>
              : <p className="payment-timer">{t('กรุณาชำระและส่งสลิปภายใน')} <strong>{countdown}</strong></p>}
            {!expired && !cancelled && <form className="stack" onSubmit={confirm}>
              <label className="payment-upload">{t('แนบสลิปการโอน')}
                <span className="small muted">{t('JPG, PNG, WebP หรือ PDF · ใช้พื้นที่จัดเก็บร่วมกับระบบ')}</span>
                <span className="button secondary upload-trigger"><CustomerIcon name="upload"/> {file ? t('เปลี่ยนไฟล์สลิป') : t('เลือกไฟล์สลิป')}</span>
                {file&&<span className="upload-filename">{file.name}</span>}
                <input className="upload-input" onChange={event=>{const selected=event.target.files?.[0];setError('');setFile(selected||null)}} type="file" name="slip" accept="image/jpeg,image/png,image/webp,application/pdf" required disabled={!booking.recipient || busy || cancelling}/>
              </label>
              {preview&&<img loading="lazy" decoding="async" className="slip-preview" src={preview} alt={t('ตัวอย่างสลิปที่เลือก')}/>}
              {file?.type==='application/pdf'&&<p className="notice"><CustomerIcon name="receipt"/> {t('เลือกไฟล์ PDF แล้ว: {name}',{name:file.name})}</p>}
              <p className="small muted">{t('ห้ามใช้ไฟล์สลิปซ้ำกับรายการอื่น ระบบจะปฏิเสธการจอง และบล็อกเบอร์โทรเมื่อพบซ้ำเกิน 3 ครั้ง สลิปใหม่ต้องรอแอดมินตรวจเงินเข้า')}</p>
              <button className="button" disabled={!booking.recipient || busy || cancelling}>{busy ? t('กำลังตรวจสลิป…') : t('ส่งสลิปเพื่อตรวจสอบ →')}</button>
            </form>}
            {error && <p className="notice error" role="alert">{msg(error)}</p>}
            <details className="notice">
              <summary>{t('มีปัญหาในการชำระเงิน?')}</summary>
              <div className="stack">
                <p><strong>{t('ใช้มือถือเครื่องเดียว:')}</strong> {t('บันทึกรูป QR แล้วเลือกรูปในแอปธนาคาร หรือเลือกโอนด้วยเลขบัญชี')}</p>
                <p><strong>{t('ยอดหรือชื่อผู้รับไม่ตรง:')}</strong> {t('อย่าเพิ่งยืนยันโอน ให้ตรวจยอดจองและข้อมูลรับเงิน หากยังไม่ตรงให้ติดต่อแคมป์')}</p>
                <p><strong>{t('โอนแล้วแต่ส่งสลิปไม่ได้ / หมดเวลา:')}</strong> {t('อย่าโอนซ้ำหรือจองใหม่เพื่อชำระซ้ำ เก็บสลิปและรหัสจอง {code} แล้วติดต่อแคมป์',{code})}</p>
                <p><strong>{t('โอนขาด โอนเกิน หรือโอนซ้ำ:')}</strong> {t('เก็บหลักฐานทุกรายการแล้วติดต่อแคมป์เพื่อตรวจยอดก่อนชำระเพิ่ม')}</p>
                <button type="button" className="button secondary" onClick={menuActions.onCampInfo}>{t('ดูข้อมูลติดต่อแคมป์')}</button>
              </div>
            </details>
            {(expired || cancelled) && <Link className="button secondary" href="/">{t('กลับไปจองใหม่')}</Link>}
          </section>

        </div>
        {booking.status === 'pending' && !booking.submitted && <div className="payment-cancel-area">
          <button className="button secondary danger-text" type="button" disabled={busy || cancelling} onClick={cancelBooking}>
            <CustomerIcon name="remove"/>{cancelling ? t('กำลังยกเลิก…') : t('ยกเลิกการจอง')}
          </button>
        </div>}
      </>}
    </main>
    <MobileCampMenu page="flow" {...menuActions}/>
    {dialogs}
  </div>
}
