'use client'

import { AdminIcon } from './admin-icon'

import Link, { ActionForm } from '../pending-ui'
import { useActionState, useEffect, useRef, useState } from 'react'
import { checkinUnpaid, checkoutChargeField, checkoutChargeFields, checkoutChargeTotals, decimalUnits, electricityCharge, electricityFormulaKey, hasUnallocatedCheckoutCharges, maxExtraSatang, maxUnitsMilli, savedCheckoutCharges } from '../../lib/checkout-pricing'
import { money } from '../../lib/pricing'
import { adminUrl } from './navigation'
import { saveCheckoutSettings } from './checkout-actions'

const baht = satang => money(satang / 100)
const unitFormat = new Intl.NumberFormat('th-TH',{maximumFractionDigits:3})
const chargeInputs = [
  {field:'units', label:'จำนวนไฟที่ใช้ (หน่วย)', max:'99999.999', step:'0.001', scale:1000},
  {field:'damage', label:'ค่าของชำรุด (บาท)', max:'999999.99', step:'0.01', scale:100},
  {field:'other', label:'ค่าใช้จ่ายอื่น ๆ (บาท)', max:'999999.99', step:'0.01', scale:100},
]
const lodgingLabel = ({code,name}) => name === code ? code : code + ' · ' + name
const guestFields = [['adults','ผู้ใหญ่'],['children','เด็ก'],['seniors','ผู้สูงอายุ']]

function ElectricityBreakdown({formula, usage}) {
  return <div className="small muted">
    <p>หน่วยฟรี {unitFormat.format(usage.freeUnits)} หน่วย {formula.fixedFreeUnits != null
      ? 'ต่อกลุ่มที่เหมาลาน'
      : `(${unitFormat.format(formula.freePerGuest / 1000)} หน่วยต่อคน × ${formula.guests} คน ÷ ${formula.locks} ล็อก)`}</p>
    <p>คิดเงิน {unitFormat.format(usage.billableUnits)} หน่วย{formula.rate !== null && ` × ${baht(formula.rate)}/หน่วย`}</p>
  </div>
}

// total (baht) already holds the equipment added at check-in; added (satang) is that part, shown on its own line
// because it is paid now together with the check-out charges.
function CheckoutTotals({total, added = 0, guest = 0, electricity, damage, other}) {
  const extra = electricity + damage + other + guest
  return <dl className="checkout-totals">
    <div><dt>ยอดจองเดิม</dt><dd>{baht(total * 100 - added)}</dd></div>
    {added > 0 && <div><dt>อุปกรณ์ที่เพิ่มตอน Check-in</dt><dd>{baht(added)}</dd></div>}
    <div><dt>ค่าไฟ</dt><dd>{baht(electricity)}</dd></div>
    <div><dt>ค่าของชำรุด</dt><dd>{baht(damage)}</dd></div>
    <div><dt>ค่าใช้จ่ายอื่น ๆ</dt><dd>{baht(other)}</dd></div>
    {guest > 0 && <div><dt>ค่าผู้เข้าพักเพิ่ม</dt><dd>{baht(guest)}</dd></div>}
    <div><dt>ยอดรวมทั้งหมด</dt><dd>{baht(total * 100 + extra)}</dd></div>
    <div className="checkout-balance"><dt>ยอดที่ต้องชำระเพิ่ม</dt><dd>{baht(extra + added)}</dd></div>
  </dl>
}

export function CheckoutForm({action, booking, lodging, savedFormula, currentFormula, qr, canCharge, review}) {
  const [saveState, save, saving] = useActionState(action,null)
  const [completeState, complete, completing] = useActionState(action,null)
  const savedCharges = savedCheckoutCharges(booking)
  const savedLodging = booking.lodging_charges ? JSON.parse(booking.lodging_charges) : null
  const sites = lodging.length ? lodging : [{code:'',name:''}]
  const original = sites.map(({code}) => savedLodging?.[code] ??
    (sites.length === 1 ? savedCharges : {units:0,electricity:0,damage:0,other:0}))
  const [entries, setEntries] = useState(() => original.map(line => Object.fromEntries(
    chargeInputs.map(({field,scale}) => [field,String(line[field] / scale)]))))
  const [note, setNote] = useState(booking.note ?? '')
  // Guests who actually stayed and the charge for the extra ones, which the admin types in (it is not worked out).
  const [guests, setGuests] = useState(() => Object.fromEntries(guestFields.map(([key]) => [key,String(booking[key])])))
  const [guestAmount, setGuestAmount] = useState(String((booking.guest_amount ?? 0) / 100))
  const guestNumbers = guestFields.map(([key]) => /^\d{1,3}$/.test(guests[key].trim()) ? Number(guests[key]) : null)
  const guestCount = guestNumbers.includes(null) ? null : guestNumbers.reduce((sum,count) => sum + count,0)
  const guestSatang = booking.completed_at ? booking.guest_amount ?? 0 : decimalUnits(guestAmount.trim() || '0',2,maxExtraSatang)
  const guestsValid = guestCount > 0 && guestSatang !== null
  const guestsChanged = guestFields.some(([key],index) => guestNumbers[index] !== booking[key]) || guestSatang !== (booking.guest_amount ?? 0)
  // Free electricity follows the guest count being entered (a whole-camp stay has its own fixed allowance).
  const withGuests = base => !booking.completed_at && guestCount > 0 && base.fixedFreeUnits == null ? { ...base, guests:guestCount } : base
  const [useCurrentFormula, setUseCurrentFormula] = useState(false)
  const [allocate, setAllocate] = useState(false)
  const unallocated = hasUnallocatedCheckoutCharges(booking,lodging.length)
  const keep = unallocated && !allocate
  const formulaChanged = electricityFormulaKey(savedFormula) !== electricityFormulaKey(currentFormula)
  const useCurrent = !keep && formulaChanged && useCurrentFormula
  const formula = withGuests(useCurrent ? currentFormula : savedFormula)
  const charges = booking.completed_at ? savedCharges : !guestsValid ? null : keep ? savedCharges : checkoutChargeTotals(entries,formula)
  const saved = Boolean(booking.version)
  const dirty = useCurrent || (unallocated && allocate) || !charges || guestsChanged || note.trim() !== (booking.note ?? '') ||
    charges.lines?.some((line,index) => checkoutChargeFields.some(field => line[field] !== original[index][field]))
  const added = checkinUnpaid(booking)
  // Everything to collect at check-out: its own charges plus equipment added at check-in.
  const extra = (charges ? charges.electricity + charges.damage + charges.other + guestSatang : 0) + added
  const totals = charges && <CheckoutTotals total={booking.total} added={added} guest={guestSatang} {...charges}/>
  const bookedGuests = booking.booked_adults != null && `จองไว้ ผู้ใหญ่ ${booking.booked_adults} · เด็ก ${booking.booked_children} · ผู้สูงอายุ ${booking.booked_seniors}`
  // Two steps: 1 enter and save the charges, 2 take the extra payment and confirm. Step 2 needs the saved amounts,
  // so it opens only while nothing on step 1 is unsaved; the admin can go back to step 1 at any time before confirming.
  const [wanted, setWanted] = useState(review && saved ? 2 : 1)
  const step = wanted === 2 && saved && !dirty ? 2 : 1
  const steps = useRef(null)
  const shown = useRef(null)
  useEffect(() => {
    if (shown.current !== null ? shown.current !== step : step === 2) steps.current?.scrollIntoView({block:'start'})
    shown.current = step
  },[step])

  if (booking.completed_at) return <section className="stack checkout-body">
    <p className="notice" role="status">Check-out แล้ว{extra > 0 && ' · ยืนยันรับยอดชำระเพิ่มแล้ว'}</p>
    {savedLodging ? lodging.map(site => {
      const line = savedLodging[site.code]
      if (!line) return null
      return <section key={site.code} className="checkout-item stack">
        <h3>{lodgingLabel(site)}</h3>
        <div className="checkout-line"><span>ค่าไฟ ({unitFormat.format(line.units / 1000)} หน่วย)</span><strong>{baht(line.electricity)}</strong></div>
        <div className="checkout-line"><span>ค่าของชำรุด</span><strong>{baht(line.damage)}</strong></div>
        <div className="checkout-line"><span>ค่าใช้จ่ายอื่น ๆ</span><strong>{baht(line.other)}</strong></div>
      </section>
    }) : <>
      <p>ใช้ไฟ {unitFormat.format(savedCharges.units / 1000)} หน่วย</p>
      <ElectricityBreakdown formula={formula} usage={electricityCharge(savedCharges.units,formula)}/>
    </>}
    <p>ผู้เข้าพักจริง ผู้ใหญ่ {booking.adults} · เด็ก {booking.children} · ผู้สูงอายุ {booking.seniors}{bookedGuests && <small className="muted"> ({bookedGuests})</small>}</p>
    {booking.note && <p className="checkout-note">หมายเหตุ {booking.note}</p>}
    {totals}
  </section>
  if (!canCharge) return <section className="checkout-body">
    <p className="notice">สามารถ Check-out ได้ตั้งแต่วันเช็กอิน</p>
  </section>

  return <div className="stack checkout-body">
    <ol className="checkout-steps" ref={steps} aria-label="ขั้นตอน Check-out">
      <li aria-current={step === 1 ? 'step' : undefined} data-done={step === 2 || undefined}>
        <button type="button" disabled={step === 1 || saving || completing} onClick={() => setWanted(1)}>
          <span className="checkout-step-number">{step === 2 ? <AdminIcon name="confirmed"/> : 1}</span>
          <span>กรอกค่าใช้จ่าย</span></button></li>
      <li aria-current={step === 2 ? 'step' : undefined}>
        <span className="checkout-step-number">2</span><span>{extra > 0 ? 'รับเงินและยืนยัน' : 'ยืนยัน Check-out'}</span></li>
    </ol>
    {step === 1 && <ActionForm action={save} className="stack">
      <input type="hidden" name="version" value={booking.version ?? 0}/>
      <input type="hidden" name="formula" value={electricityFormulaKey(formula)}/>
      <input type="hidden" name="chargeMode" value={keep ? 'keep' : 'edit'}/>
      {unallocated && <div>
        <p className="small muted">รายการนี้มียอดเดิมที่บันทึกรวมไว้ {baht(savedCharges.electricity + savedCharges.damage + savedCharges.other)}</p>
        <label className="checkbox"><input type="checkbox" checked={allocate} onChange={event => setAllocate(event.target.checked)}/>
          กรอกยอดใหม่แยกตามล็อก</label>
      </div>}
      {!keep && formulaChanged && <div>
        <p className="small muted">รายการนี้ใช้สูตรค่าไฟที่บันทึกไว้ก่อนหน้า</p>
        <label className="checkbox"><input type="checkbox" name="useCurrentFormula" checked={useCurrent}
          onChange={event => setUseCurrentFormula(event.target.checked)}/>ใช้สูตรค่าไฟจากการตั้งค่าปัจจุบัน</label>
      </div>}
      <fieldset className="checkout-item checkout-charge-group stack">
        <legend>ผู้เข้าพัก</legend>
        {bookedGuests && <p className="checkout-booked-note"><AdminIcon name="bookings"/>{bookedGuests} <strong>(รวม {booking.booked_adults + booking.booked_children + booking.booked_seniors} คน)</strong></p>}
        <div className="checkout-inputs checkin-guests">
          {guestFields.map(([key,label]) => <label key={key}>{label}
            <input name={key} type="number" min="0" max="500" step="1" inputMode="numeric" required value={guests[key]}
              onChange={event => setGuests(previous => ({ ...previous, [key]:event.target.value }))}/></label>)}
        </div>
        <label>ค่าผู้เข้าพักเพิ่ม (บาท)
          <input name="guestAmount" type="number" min="0" max="999999.99" step="0.01" inputMode="decimal" value={guestAmount}
            onChange={event => setGuestAmount(event.target.value)}/></label>
        <p className="small muted">จำนวนคนใช้คิดหน่วยไฟฟรี · ค่าผู้เข้าพักเพิ่มกรอกเองตามที่ตกลงกับลูกค้า ระบบไม่คำนวณให้</p>
      </fieldset>
      {!keep && sites.map((site,index) => {
        const units = decimalUnits(entries[index].units || '0',3,maxUnitsMilli)
        const usage = units === null ? null : electricityCharge(units,formula)
        return <fieldset className="checkout-item checkout-charge-group stack" key={site.code}>
          <legend>{site.code ? 'ค่าใช้จ่าย · ' + lodgingLabel(site) : 'ค่าใช้จ่าย'}</legend>
          <div className="checkout-inputs">
            {chargeInputs.map(({field,label,max,step}) => <label key={field}>{label}
              <input name={checkoutChargeField(field,site.code)} type="number" min="0" max={max} step={step}
                inputMode="decimal" value={entries[index][field]} onChange={event => {
                  const value = event.target.value
                  setEntries(previous => previous.map((entry,i) => i === index ? {...entry,[field]:value} : entry))
                }}/>
            </label>)}
          </div>
          {usage && <>
            <ElectricityBreakdown formula={formula} usage={usage}/>
            <div className="checkout-line"><span>ค่าไฟ</span><strong>{baht(usage.amount)}</strong></div>
          </>}
        </fieldset>
      })}
      <label>หมายเหตุ / รายการค่าใช้จ่าย<textarea name="note" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label>
      {totals || <p className="muted small">ตรวจสอบจำนวนหน่วยไฟและค่าใช้จ่ายรายล็อก รวมถึงยอดรวมของแต่ละประเภท</p>}
      {saveState?.error && <p className="notice error" role="alert">{saveState.error}</p>}
      {/* Nothing changed since the last save: go straight on. Otherwise the charges are saved first, then step 2 opens. */}
      {saved && !dirty
        ? <button type="button" className="button" disabled={saving || completing} onClick={() => setWanted(2)}>ถัดไป <AdminIcon name="next"/></button>
        : <button className="button" disabled={saving || completing || !charges}>{saving ? 'กำลังบันทึก…' : <>บันทึกยอด แล้วไปขั้นถัดไป <AdminIcon name="next"/></>}</button>}
    </ActionForm>}
    {step === 2 && <section className="stack checkout-settlement">
      {totals}
      {booking.note && <p className="checkout-note">หมายเหตุ {booking.note}</p>}
      {extra > 0 && (qr ? <div className="checkout-qr">
        <strong>สแกนพร้อมเพย์เพื่อชำระเพิ่ม {baht(extra)}</strong>
        <img src={qr} width={224} height={224} alt={'QR พร้อมเพย์สำหรับยอด ' + baht(extra)}/>
        <p className="small muted">ตรวจสอบชื่อผู้รับและยอดเงินในแอปธนาคารก่อนโอน</p>
      </div> : <p className="notice">ตั้งค่าพร้อมเพย์ใน <Link href={adminUrl('checkoutSettings')}>ตั้งค่า Check-out</Link> แล้วกลับมาเปิดรายการนี้อีกครั้งเพื่อสร้าง QR</p>)}
      <ActionForm action={complete} className="stack">
        <input type="hidden" name="version" value={booking.version}/>
        <input type="hidden" name="intent" value="complete"/>
        {extra > 0 && <label className="checkbox"><input type="checkbox" name="received" required/>ตรวจสอบและได้รับยอดชำระเพิ่ม {baht(extra)} แล้ว</label>}
        {completeState?.error && <p className="notice error" role="alert">{completeState.error}</p>}
        <p className="small muted">ยืนยันแล้วจะแก้ไขยอดของรายการนี้ไม่ได้อีก</p>
        <div className="checkout-step-actions">
          <button type="button" className="button secondary" disabled={completing} onClick={() => setWanted(1)}><AdminIcon name="back"/> ย้อนกลับไปแก้ไขยอด</button>
          <button className="button" disabled={saving || completing}>{completing ? 'กำลังยืนยัน…' : 'ยืนยัน Check-out'}</button>
        </div>
      </ActionForm>
    </section>}
  </div>
}

export function CheckoutSettingsForm({rate, freePerGuest, promptpay}) {
  const [state, save, pending] = useActionState(saveCheckoutSettings,null)
  const [price, setPrice] = useState((rate / 100).toFixed(2))
  const [freeUnits, setFreeUnits] = useState(String(freePerGuest / 1000))
  const [recipient, setRecipient] = useState(promptpay ?? '')
  return <ActionForm action={save} className="panel stack admin-content">
    <h2>ค่าไฟและพร้อมเพย์สำหรับ Check-out</h2>
    <label>หน่วยไฟฟรีต่อคน<input name="freePerGuest" type="number" min="0" max="999.999" step="0.001" inputMode="decimal" required value={freeUnits} onChange={e => setFreeUnits(e.target.value)}/></label>
    <label>ค่าไฟต่อหน่วย (บาท)<input name="rate" type="number" min="0" max="999.99" step="0.01" inputMode="decimal" required value={price} onChange={e => setPrice(e.target.value)}/></label>
    <p className="muted small">หน่วยฟรี = หน่วยไฟฟรีต่อคน × จำนวนผู้เข้าพัก ÷ จำนวนล็อก<br/>
      ค่าไฟ = หน่วยที่ใช้เกินจากหน่วยฟรี × ค่าไฟต่อหน่วย<br/>
      รายการห้องพักที่ไม่มีล็อกใช้ตัวหาร 1 สูตรนี้ใช้กับรายการที่ยังไม่ได้บันทึกอัตราค่าไฟ</p>
    <label>เบอร์มือถือพร้อมเพย์ หรือเลขบัตรประชาชน / เลขผู้เสียภาษี<input name="promptpay" inputMode="numeric" maxLength={20} value={recipient} onChange={e => setRecipient(e.target.value)}/></label>
    <p className="muted small">ใช้สร้าง QR ระบุยอดชำระเพิ่มตอน Check-out</p>
    {state?.error && <p className="notice error" role="alert">{state.error}</p>}
    <div className="actions"><button className="button" disabled={pending}><AdminIcon name="save"/>บันทึกการตั้งค่า</button></div>
  </ActionForm>
}
