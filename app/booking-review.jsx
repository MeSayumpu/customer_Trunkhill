'use client'

import { CustomerIcon } from './customer-icon'

import Link from './pending-ui'
import { Fragment, useRef, useState } from 'react'
import { statuses, roomExtraGuests } from '../lib/pricing'
import { isRentalStay } from '../lib/rentals'
import { displayDate } from './booking-pickers'
import { RentalPicker } from './rental-picker'
import { CampLoader } from './camp-loader'
import { wholeCampCode } from '../lib/whole-camp'
import { rescheduleLimit } from '../lib/booking-dates'
import { useConfirm } from './confirm-dialog'
import { TentGlyph } from './tent-map'
import { useI18n } from './i18n'

function ReviewCostLabel({stay,children}) {
  return <span className="review-cost-label">
    <CustomerIcon name={stay ? "stay" : "gear"}/>
    <span>{children}</span>
  </span>
}

function RemoveAction({row,disabled,onRemove}) {
  const {t} = useI18n()
  return <button type="button" className="danger-text" disabled={disabled} onClick={() => onRemove(row)}>
    <CustomerIcon name="remove"/>
    <span>{t('ลบ')}</span>
  </button>
}

export function BookingReview({
  ready, loading, availabilityError, selected, nights, pricing, arrival, departure,
  guestSummary, bookingBusy, bookingError, receipt, book, select, gear, onRetry,
  settings, confirmRentals, hosts, rentalLines, combined, rentalsByLock, wholeCamp, wholeCampError, freeUnits, plotGuests, amendment = null,
}) {
  const {t,msg,money} = useI18n()
  const confirm = useConfirm()
  const rentalDialog = useRef(null)
  const [rentalDraft, setRentalDraft] = useState({})
  const itemName = code => t(gear.find(item => item.code === code)?.name || code)
  const nightsLabel = nights ? t('{n} คืน',{n:nights}) : t('– คืน')

  async function removeRow(row) {
    const attached = rentalLines.filter(line => line.host === row.code).map(line => itemName(line.code) + ' × ' + line.quantity)
    const accepted = await confirm({
      title:row.code === wholeCampCode ? t('ยกเลิกการเหมาลาน?') : t('ลบ {name} ออกจากการจอง?',{name:t(row.name)}),
      message:attached.length ? t('อุปกรณ์ที่เช่าไว้กับรายการนี้จะถูกลบด้วย') : t('รายการนี้จะถูกนำออกจากสรุปการจอง'),
      items:attached,
      confirmLabel:t('ลบรายการ'),
    })
    if (accepted) select(row.code, 0)
  }

  async function applyRentals(host, quantities) {
    const current = rentalsByLock[host.code] || {}
    const reduced = Object.entries(current).filter(([code,quantity]) => quantity > 0 && (quantities[code] || 0) < quantity)
      .map(([code,quantity]) => itemName(code) + ': ' + quantity + ' → ' + (quantities[code] || 0) + (quantities[code] ? '' : ' ' + t('(ลบออก)')))
    if (reduced.length && !(await confirm({
      title:t('ลดหรือลบอุปกรณ์เช่า?'),
      message:t('สำหรับ {name} รายการต่อไปนี้จะถูกลดจำนวนหรือลบออก',{name:t(host.name)}),
      items:reduced,
      confirmLabel:t('ยืนยันการเปลี่ยนแปลง'),
      cancelLabel:t('กลับไปแก้ไข'),
    }))) return false
    confirmRentals(host.code, quantities)
    return true
  }
  const [activeHost, setActiveHost] = useState(null)
  const [view,setView] = useState('items')
  const [fieldErrors,setFieldErrors] = useState({})
  function submit(event){
    const form=event.currentTarget, data=new FormData(form), errors={}
    if(!String(data.get('guest')||'').trim())errors.guest=t('กรุณากรอกชื่อผู้จอง')
    if(!/^\+?\d{8,15}$/.test(String(data.get('phone')||'').replace(/[ ()-]/g,'')))errors.phone=t('กรุณากรอกเบอร์โทรให้ถูกต้อง')
    setFieldErrors(errors)
    if(Object.keys(errors).length){event.preventDefault();form.elements[Object.keys(errors)[0]].focus();return}
    book(event)
  }
  const lodging = hosts
  const rentals = selected.filter(row => row.kind === 'gear' && !rentalLines.some(line => line.code === row.code))
  const hostRentals = rentalsByLock[activeHost?.code] || {}
  const options = gear.map(row => ({
    ...row,
    available: Math.max(0, Number(row.available) - (combined[row.code] || 0) + (hostRentals[row.code] || 0)),
  }))
  const total = pricing?.total ?? 0
  const personPricing = !wholeCamp && settings?.mode === 'person'
  const plotCount = lodging.filter(row => row.kind === 'plot').length
  const mixedLodging = plotCount > 0 && lodging.some(row => row.kind === 'room')
  const backProps = amendment ? {href:'/booking',onClick:event=>{event.preventDefault();amendment.onBack()}} : {href:'/'}
  const limit = settings?.reschedule_limit ?? rescheduleLimit
  const difference = amendment?.quote?.difference

  // Person pricing: the adults a plot is billed for and the per-person rate that applies, one entry per distinct rate.
  const plotLines = row => pricing?.plotBreakdown?.get(row.code)?.lines ?? []
  const plotLineLabel = (row,line) => {
    const adults = pricing.plotBreakdown.get(row.code).adults
    return <>{t(pricing.seniorsAsAdults ? 'ผู้สูงอายุ {n} คน × {price}/คน × {nights} คืน' : 'ผู้ใหญ่ {n} คน × {price}/คน × {nights} คืน',{n:adults,price:money(line.price),nights:line.nights})}
      <small className="review-cost-rule"> · {t(adults === 1 ? 'ราคาผู้ใหญ่ 1 คนต่อล็อก' : 'ราคาผู้ใหญ่ 2 คนขึ้นไปต่อล็อก')}</small></>
  }
  // Trunkbox: which guest types the extra-guest charge is for. Adults fill the places the room price covers first,
  // so the extras are the adults beyond that and then the seniors; children are never charged.
  const roomExtraTypes = row => {
    const extra = roomExtraGuests(row), seniors = Math.min(extra,row.guests.seniors), adults = extra - seniors
    return [['ผู้ใหญ่',adults],['ผู้สูงอายุ',seniors]].filter(([,count]) => count > 0)
  }
  return <section className="review-page" aria-labelledby="review-title">
    <header className="review-heading">
      <h1 id="review-title">{amendment ? t('ตรวจสอบการแก้ไข') : t('ตรวจสอบการจอง')}</h1>
      <div className="review-badges">
        <span>{arrival ? displayDate(arrival) + ' – ' + displayDate(departure) : t('วันเข้าพัก – วันออก')}</span>
        <span>{guestSummary}</span>
      </div>
    </header>

    {availabilityError && <div className="notice error actions" role="alert">
      <span>{msg(availabilityError)}</span><button type="button" className="button secondary" onClick={onRetry}>{t('ลองอีกครั้ง')}</button>
    </div>}
    {wholeCampError && <p className="notice error" role="alert">{wholeCampError} <Link {...backProps}>{t('กลับไปแก้ไข')}</Link></p>}


    <div className="review-grid">
      <section className="panel review-card stack" hidden={view !== 'items'}>
        <h2>{wholeCamp ? t('รายการเหมาลาน') : t('รายการที่จอง')}</h2>
        {loading && <CampLoader label={t('กำลังตรวจสอบรายการที่เลือก…')}/>}
        {ready && !selected.length && !receipt && !wholeCampError && <p className="muted">{t('ยังไม่มีรายการที่เลือก')} <Link {...backProps}>{t('กลับไปเลือกล็อก')}</Link></p>}

        {/* Plots and rooms are listed as two groups, each closed by its own subtotal, so a booking with both reads
            plot charges → plot subtotal → room charges → room subtotal. The group titles show only when both are booked. */}
        {['plot','room'].map(group => <Fragment key={group}>
        {mixedLodging && lodging.some(row => (row.kind === 'room') === (group === 'room')) &&
          <h3 className="review-group-title">{group === 'room' ? t('บ้านพัก') : t('ลานกางเต็นท์')}</h3>}
        {lodging.filter(row => (row.kind === 'room') === (group === 'room')).map(row => <article key={row.code} className="review-line stack">
          <div className="rental-heading">
            <span className="review-line-icon" aria-hidden="true">{row.kind === 'room' ? <CustomerIcon name="cabin"/> : <TentGlyph status="selected"/>}</span>
            <div className="review-line-title"><h3>{row.kind === 'plot' && row.code !== wholeCampCode ? row.code : t(row.name)}</h3>
              {row.detail && <p className="muted small">{t(row.detail)}</p>}</div>
            {ready && gear.length > 0 && !receipt && <button type="button" className="button secondary rental-open"
              disabled={bookingBusy} aria-label={t('+ เช่าอุปกรณ์เพิ่มสำหรับ {name}',{name:t(row.name)})} onClick={() => {
                setActiveHost(row)
                const current = rentalsByLock[row.code] || {}
                setRentalDraft(Object.fromEntries(gear.map(item => [
                  item.code, Math.min(current[item.code] || 0, Math.max(0, Number(item.available) - (combined[item.code] || 0) + (current[item.code] || 0))),
                ])))
                rentalDialog.current.showModal()
                rentalDialog.current.scrollTop = 0
              }}>{t('+ เช่าอุปกรณ์เพิ่ม')}</button>}
          </div>
          {/* Trunkbox: how many guests the room price covers and the most it takes, on a row of its own under the heading. */}
          {row.kind === 'room' && row.room_base_guests != null && <p className="muted small review-room-limits">{t('ผู้เข้าพักปกติ {base} คน · รองรับสูงสุด {max} คน',{base:row.room_base_guests,max:row.room_max_guests})}</p>}
          {/* Person pricing: one line per rate, so the guest sees how many adults the plot is billed for and at what price. */}
          {/* When the nights have different rates, each rate gets its own line above the plot total. */}
          {plotLines(row).length > 1 && plotLines(row).map(line => <div className="review-cost review-cost-detail" key={line.price}>
            <ReviewCostLabel stay>{plotLineLabel(row,line)}</ReviewCostLabel>
            <span>{money(line.price * pricing.plotBreakdown.get(row.code).adults * line.nights)}</span>
          </div>)}
          <div className="review-cost">
            <ReviewCostLabel stay>{plotLines(row).length > 1 ? t('รวมล็อกนี้') : plotLines(row).length ? plotLineLabel(row,plotLines(row)[0]) : row.code === wholeCampCode ? t('ราคาเหมาลานตามคืนที่เข้าพัก') : row.kind === 'plot'
              ? (personPricing ? t('ราคาตามจำนวนผู้ใหญ่และคืนที่เข้าพัก') : t('ราคาตามล็อกและคืนที่เข้าพัก'))
              : t('{price} / คืน',{price:money(row.price)})}{!plotLines(row).length && <> × {nightsLabel}</>}</ReviewCostLabel>
            <strong>{money(row.kind === 'plot' ? (pricing?.plotAmounts.get(row.code) ?? 0) : row.price * row.quantity * nights)}</strong>
          </div>
          {/* Trunkbox: who stays in the room, and the charge for adults and seniors beyond the guests its price covers. */}
          {row.kind === 'room' && row.guests && <>
            {roomExtraTypes(row).map(([type,count]) => <div className="review-cost review-cost-detail" key={type}>
              <ReviewCostLabel stay>{t('ผู้เข้าพักเพิ่ม {type} {n} คน × {price}/คน × {nights} คืน',{type:t(type),n:count,price:money(row.room_extra_guest_price),nights})}
                <small className="review-extra-note">{t('เฉพาะค่าเข้าพื้นที่ ไม่มีอุปกรณ์การนอน')}</small></ReviewCostLabel>
              <strong>{money(count * row.room_extra_guest_price * nights)}</strong>
            </div>)}
            {/* Children in the room are never charged; their own 0-baht line says so. */}
            {row.guests.children > 0 && <div className="review-cost review-cost-detail">
              <ReviewCostLabel stay>{t('เด็ก {n} คน',{n:row.guests.children})}</ReviewCostLabel>
              <strong>{money(0)}</strong>
            </div>}
          </>}
          {row.code === wholeCampCode && freeUnits != null && <p className="small muted">{t('ค่าไฟฟรี {n} หน่วยต่อกลุ่ม',{n:freeUnits})}</p>}
          {rentalLines.filter(line => line.host === row.code).map(line => {
            const rental = gear.find(item => item.code === line.code)
            return <div className="review-cost small" key={line.code}>
              <ReviewCostLabel stay={isRentalStay(rental)}>{t(rental.name)} × {line.quantity}</ReviewCostLabel>
              <strong>{money(rental.price * line.quantity * nights)}</strong>
            </div>
          })}
          <div className="review-line-actions">
            <Link {...backProps} aria-label={t('แก้ไข {name}',{name:t(row.name)})}>
              <CustomerIcon name="edit"/>
              <span>{t('แก้ไข')}</span>
            </Link>
            <RemoveAction row={row} disabled={bookingBusy} onRemove={removeRow}/>
          </div>
        </article>)}
        {/* Summary under the plots: guests who stay without charge get their own 0-baht lines here (they belong to the
            whole booking, not to one plot), then the plot subtotal. */}
        {group === 'plot' && personPricing && plotCount > 0 && <div className="review-lodging-summary">
          {plotGuests?.seniors > 0 && !pricing?.seniorsAsAdults && <div className="review-cost review-free-guests">
            <span>{t('ราคาผู้สูงอายุ {n} คน',{n:plotGuests.seniors})}</span><span>{money(0)}</span>
          </div>}
          {plotGuests?.children > 0 && <div className="review-cost review-free-guests">
            <span>{t('ราคาเด็ก {n} คน',{n:plotGuests.children})}</span><span>{money(0)}</span>
          </div>}
          <div className="review-cost review-lodging-subtotal">
            <span>{t('รวมค่าลานตามจำนวนคน')}</span>
            <span>{money(pricing?.plotTotal ?? 0)}</span>
          </div>
        </div>}
        {/* Seniors with no adult are billed as adults; say so where the plot charges are shown. */}
        {group === 'plot' && pricing?.seniorsAsAdults && <p className="small muted review-senior-note" role="note">* {t('กรณีผู้สูงอายุเข้าพักโดยไม่มีผู้ใหญ่ จะคิดราคาผู้สูงอายุตามราคาผู้ใหญ่')}</p>}
        {group === 'room' && mixedLodging && <div className="review-lodging-summary">
          <div className="review-cost review-lodging-subtotal"><span>{t('รวมค่าบ้านพัก')}</span><span>{money(pricing?.roomTotal ?? 0)}</span></div>
        </div>}
        </Fragment>)}

        {rentals.map(row => <article key={row.code} className="review-line stack">
          <h3>{t(row.name)} × {row.quantity}</h3>
          <div className="review-cost">
            <ReviewCostLabel stay={isRentalStay(row)}>{t('{price} / คืน',{price:money(row.price)})} × {nightsLabel}</ReviewCostLabel>
            <strong>{money(row.price * row.quantity * nights)}</strong>
          </div>
          <div className="review-line-actions"><RemoveAction row={row} disabled={bookingBusy} onRemove={removeRow}/></div>
        </article>)}

        {/* Rental subtotals (before the tent discount) sit with the plot subtotal so the total is easy to follow. */}
        {pricing?.tentTotal > 0 && <div className="review-cost review-rental-subtotal"><span>{t('รวมค่าเช่าเต็นท์')}</span><span>{money(pricing.tentTotal)}</span></div>}
        {pricing?.gearTotal > 0 && <div className="review-cost review-rental-subtotal"><span>{t('รวมค่าเช่าอุปกรณ์')}</span><span>{money(pricing.gearTotal)}</span></div>}
        {pricing?.discount > 0 && <div className="review-cost"><span>{t('ส่วนลดค่าเช่าเต็นท์')}</span><strong>−{money(pricing.discount)}</strong></div>}
        <div className="review-cost review-total"><strong>{t('ยอดรวม')}</strong><strong>{money(total)}</strong></div>
        <button type="button" className="button" onClick={() => setView('guest')}>{t('กรอกข้อมูลผู้จอง →')}</button>
      </section>

      <form className="review-form stack" onSubmit={submit} noValidate hidden={view !== 'guest'}>
        <section className="panel review-card stack">
          <h2>{t('ข้อมูลผู้จอง')}</h2>
          <label className="review-field">{t('ชื่อผู้จอง')}<input aria-invalid={!!fieldErrors.guest} aria-describedby={fieldErrors.guest ? "guest-error" : undefined} name="guest" autoComplete="name" maxLength={120} required disabled={bookingBusy || !!receipt}
            {...(amendment?{value:amendment.guest,onChange:event=>amendment.setGuest(event.target.value)}:{})}/>{fieldErrors.guest&&<small id="guest-error" className="field-error" role="alert">{fieldErrors.guest}</small>}</label>
          <label className="review-field">{t('เบอร์โทร')}<input aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} name="phone" type="tel" autoComplete="tel" maxLength={24} required disabled={bookingBusy || !!receipt}
            {...(amendment?{value:amendment.phone,readOnly:true}:{})}/>{fieldErrors.phone&&<small id="phone-error" className="field-error" role="alert">{fieldErrors.phone}</small>}</label>
        </section>
        <section className="panel review-card stack">
          <h2>{t('สรุปค่าใช้จ่าย')}</h2>
          <div className="review-breakdown">
            {plotCount > 0 && <div className="review-cost"><span>{wholeCamp ? t('ค่าเหมาลาน') : t('ค่าล็อก')}</span><span>{money(pricing?.plotTotal ?? 0)}</span></div>}
            {selected.some(row => row.kind === 'room') && <div className="review-cost"><span>{t('ค่าห้องพัก')}</span><span>{money(pricing?.roomTotal ?? 0)}</span></div>}
            {pricing?.tentTotal > 0 && <div className="review-cost"><span>{t('ค่าเช่าเต็นท์')}</span><span>{money(pricing.tentTotal)}</span></div>}
            {pricing?.gearTotal > 0 && <div className="review-cost"><span>{t('ค่าอุปกรณ์')}</span><span>{money(pricing.gearTotal)}</span></div>}
            {pricing?.discount > 0 && <div className="review-cost"><span>{t('ส่วนลดค่าเช่าเต็นท์')}</span><span>−{money(pricing.discount)}</span></div>}
          </div>
          <div className="review-cost review-total"><strong>{amendment ? t('ยอดประมาณตามราคาปัจจุบัน') : t('รวมค่าเข้าพักทั้งหมด')}</strong><strong>{money(receipt?.total ?? total)}</strong></div>
          {/* Nights in a no-reschedule period (set in admin) cannot be moved later, so the usual reschedule promise is left out. */}
          <p className="small" hidden={!amendment && !!settings?.reschedule_blackout}>{t('เลื่อนหรือแก้ไขได้รวม {n} ครั้ง โดยต้องเลื่อนล่วงหน้าอย่างน้อย {days} วันก่อนวันเข้าพักเดิม',{n:limit,days:amendment?.noticeDays??settings?.reschedule_notice_days??3})}</p>
          <button type="button" className="button secondary" onClick={()=>{setView('items');window.scrollTo({top:0,behavior:'smooth'})}}>{t('← กลับไปดูรายการที่จอง')}</button>
          {receipt ? <div className="notice" role="status"><strong>{t('บันทึกคำขอแล้ว')}</strong><br/>{t('รหัสจอง')} <code>{receipt.id}</code><br/>{t(statuses[receipt.status])}</div>
            : <button className="button" disabled={!ready || !selected.length || bookingBusy || !!wholeCampError}>
              {bookingBusy ? t('กำลังดำเนินการ…') : amendment ? t('ตรวจสอบยอดใหม่และส่วนต่าง →') : t('ยืนยันการจอง {total} →',{total:money(total)})}
            </button>}
          {amendment?.quote&&<section className="notice stack" aria-live="polite">
            <h3>{t('ยืนยันส่วนต่างก่อนบันทึก')}</h3>
            <div className="review-cost"><span>{t('ยอดเดิม')}</span><strong>{money(amendment.quote.oldTotal)}</strong></div>
            <div className="review-cost"><span>{t('ยอดใหม่ที่ตรวจสอบแล้ว')}</span><strong>{money(amendment.quote.total)}</strong></div>
            <strong>{difference>0 ? t('ชำระเพิ่ม {amount}',{amount:money(difference)}) : difference<0 ? t('รอแอดมินจัดการคืนเงิน {amount}',{amount:money(-difference)}) : t('ไม่มีส่วนต่าง')}</strong>
            <p>{t('ยอดเพิ่มให้ติดต่อแอดมินเพื่อตรวจการชำระเพิ่ม ยอดลดให้แอดมินจัดการคืนเงิน')}</p>
            <button type="button" className="button" disabled={bookingBusy} onClick={amendment.save}>{t('ยืนยันการเลื่อน (ใช้สิทธิ์ {used}/{limit} ครั้ง)',{used:Number(amendment.usedCount) + 1,limit})}</button>
          </section>}
          {bookingError && <p className="notice error" role="alert">{msg(bookingError)}</p>}
        </section>
      </form>
    </div>
    <RentalPicker dialog={rentalDialog} rows={options} draft={rentalDraft} setDraft={setRentalDraft}
      hostName={activeHost ? t(activeHost.name) : undefined} onConfirm={quantities => applyRentals(activeHost, quantities)}/>
  </section>
}
