'use client'

import { useActionState, useState } from 'react'
import Link, { ActionForm } from '../pending-ui'
import { money } from '../../lib/pricing'
import { AdminIcon } from './admin-icon'

const guestFields = [['adults','ผู้ใหญ่'],['children','เด็ก'],['seniors','ผู้สูงอายุ']]

// Check-in form: actual guests, extra rental equipment (paid with the check-out bill), a note.
// The same form stays usable after check-in, until check-out is confirmed, for equipment the guests ask for later.
export function CheckinForm({action, booking, gear, nights, added, canCheckin, checkoutUrl, noteMax, guestMax, itemMax}) {
  const [state, save, saving] = useActionState(action,null)
  const [guests, setGuests] = useState(() => Object.fromEntries(guestFields.map(([key]) => [key,String(booking[key])])))
  const [picked, setPicked] = useState({})
  const [note, setNote] = useState(booking.checkin_note ?? '')
  const checkedIn = Boolean(booking.checked_in_at)
  const extra = gear.reduce((sum,item) => sum + item.price * nights * (picked[item.code] || 0),0)
  const change = (code,step,limit) => setPicked(previous => ({ ...previous, [code]:Math.max(0,Math.min(limit,(previous[code] || 0) + step)) }))

  if (booking.checked_out) return <section className="stack checkout-body">
    <p className="notice" role="status">Check-out แล้ว · รายการนี้ปิดแล้ว</p>
    <p>ผู้เข้าพักจริง ผู้ใหญ่ {booking.adults} · เด็ก {booking.children} · ผู้สูงอายุ {booking.seniors}</p>
    {booking.checkin_note && <p className="checkout-note">หมายเหตุ {booking.checkin_note}</p>}
  </section>
  if (!canCheckin) return <section className="checkout-body">
    <p className="notice">Check-in ได้ตั้งแต่วันเช็กอิน</p>
  </section>

  return <div className="stack checkout-body">
    {checkedIn && <div className="notice checkin-done" role="status"><span><AdminIcon name="confirmed"/> Check-in แล้ว แก้ไขหรือเพิ่มอุปกรณ์ได้จนกว่าจะ Check-out</span>
      <Link className="button" href={checkoutUrl}>ไป Check-out <AdminIcon name="next"/></Link></div>}
    <ActionForm action={save} className="stack">
      <input type="hidden" name="seen" value={added.length}/>
      <fieldset className="checkout-item checkout-charge-group stack">
        <legend>ผู้เข้าพักจริง</legend>
        <div className="checkout-inputs checkin-guests">
          {guestFields.map(([key,label]) => <label key={key}>{label}
            <input name={key} type="number" min="0" max={guestMax} step="1" inputMode="numeric" required value={guests[key]}
              onChange={event => setGuests(previous => ({ ...previous, [key]:event.target.value }))}/></label>)}
        </div>
        <p className="small muted">ใช้คิดหน่วยไฟฟรีตอน Check-out · ไม่เปลี่ยนยอดค่าจอง</p>
      </fieldset>
      <fieldset className="checkout-item checkout-charge-group stack">
        <legend>เพิ่มอุปกรณ์ให้เช่า</legend>
        <p className="small muted">ราคาตามรายการ × {nights} คืน · เก็บเงินพร้อมบิล Check-out</p>
        {gear.length ? <ul className="checkin-gear">{gear.map(item => {
          const quantity = picked[item.code] || 0, limit = Math.min(item.available,itemMax)
          return <li key={item.code} data-picked={quantity > 0 || undefined}>
            <div><strong>{item.name}</strong><small>{money(item.price)}/คืน · {item.available > 0 ? `ว่าง ${item.available}` : 'ไม่ว่างในคืนที่พัก'}</small></div>
            <div className="checkin-stepper">
              <button type="button" className="button secondary" aria-label={'ลด ' + item.name} disabled={!quantity} onClick={() => change(item.code,-1,limit)}>−</button>
              <output aria-live="polite">{quantity}</output>
              <button type="button" className="button secondary" aria-label={'เพิ่ม ' + item.name} disabled={quantity >= limit} onClick={() => change(item.code,1,limit)}>+</button>
              <input type="hidden" name={'add:' + item.code} value={quantity}/>
            </div>
          </li>
        })}</ul> : <p className="muted">ยังไม่มีอุปกรณ์ให้เช่าที่เปิดใช้งาน</p>}
        <div className="checkout-line checkout-item-total"><strong>ยอดอุปกรณ์ที่เพิ่มครั้งนี้</strong><strong>{money(extra)}</strong></div>
      </fieldset>
      {added.length > 0 && <section className="checkout-item stack">
        <h3>อุปกรณ์ที่เพิ่มไว้แล้ว</h3>
        {added.map((item,index) => <div className="checkout-line" key={index}><span>{item.name} × {item.quantity} <small>({money(item.unit_price)} × {item.nights} คืน)</small></span><strong>{money(item.amount)}</strong></div>)}
        <div className="checkout-line checkout-item-total"><strong>รวมรอชำระตอน Check-out</strong><strong>{money(booking.added_amount)}</strong></div>
      </section>}
      <label>หมายเหตุ Check-in<textarea name="note" rows={2} maxLength={noteMax} value={note} onChange={event => setNote(event.target.value)}
        placeholder="เช่น ทะเบียนรถ เวลามาถึง"/></label>
      {state?.error && <p className="notice error" role="alert">{state.error}</p>}
      <button className="button" disabled={saving}>{saving ? 'กำลังบันทึก…' : checkedIn ? 'บันทึกการแก้ไข' : 'ยืนยัน Check-in'}</button>
    </ActionForm>
  </div>
}
