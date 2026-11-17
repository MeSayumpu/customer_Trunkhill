'use client'

import { AdminIcon } from './admin-icon'

import Link, { ActionForm } from '../pending-ui'
import { useActionState, useEffect, useRef, useState } from 'react'
import { checkinUnpaid, checkoutChargeField, checkoutChargeFields, checkoutChargeTotals, decimalUnits, defaultLockGuests, electricityCharge, electricityFormulaKey, hasUnallocatedCheckoutCharges, lockGuestCount, maxExtraSatang, maxLockGuests, maxUnitsMilli, savedCheckoutCharges } from '../../lib/checkout-pricing'
import { money } from '../../lib/pricing'
import { adminUrl } from './navigation'
import { saveCheckoutSettings } from './checkout-actions'

const baht = satang => money(satang / 100)
const unitFormat = new Intl.NumberFormat('th-TH',{maximumFractionDigits:3})
const chargeInputs = [
  {field:'units', label:'จำนวนไฟที่ใช้ (หน่วย)', short:'หน่วยไฟที่ใช้', max:'99999.999', step:'0.001', scale:1000},
  {field:'damage', label:'ค่าของชำรุด (บาท)', short:'ของชำรุด (บาท)', max:'999999.99', step:'0.01', scale:100},
  {field:'other', label:'ค่าใช้จ่ายอื่น ๆ (บาท)', short:'อื่น ๆ (บาท)', max:'999999.99', step:'0.01', scale:100},
]
const lodgingLabel = ({code,name}) => name === code ? code : code + ' · ' + name
const guestFields = [['adults','ผู้ใหญ่'],['children','เด็ก'],['seniors','ผู้สูงอายุ']]

// Shown only for a check-out saved before guests were counted per lock: the old formula that shared the booking's
// guests between its locks.
function ElectricityBreakdown({formula, usage}) {
  return <div className="small muted">
    <p>หน่วยฟรี {unitFormat.format(usage.freeUnits)} หน่วย {formula.fixedFreeUnits != null
      ? 'ต่อกลุ่มที่เหมาลาน'
      : <>({unitFormat.format(formula.freePerGuest / 1000)} หน่วยต่อคน × {formula.guests} คน ÷ {formula.locks} ล็อก)</>}</p>
    <p>คิดเงิน {unitFormat.format(usage.billableUnits)} หน่วย{formula.rate !== null && ` × ${baht(formula.rate)}/หน่วย`}</p>
  </div>
}

// total (baht) already holds the equipment added at check-in; added (satang) is that part, shown on its own line
// because it is paid now together with the check-out charges.
function CheckoutTotals({total, added = 0, guest = 0, discount = 0, electricity, damage, other}) {
  const extra = electricity + damage + other + guest - discount
  return <dl className="checkout-totals">
    <div><dt>ยอดจองเดิม</dt><dd>{baht(total * 100 - added)}</dd></div>
    {added > 0 && <div><dt>อุปกรณ์ที่เพิ่มตอน Check-in</dt><dd>{baht(added)}</dd></div>}
    <div><dt>ค่าไฟ</dt><dd>{baht(electricity)}</dd></div>
    <div><dt>ค่าของชำรุด</dt><dd>{baht(damage)}</dd></div>
    <div><dt>ค่าใช้จ่ายอื่น ๆ</dt><dd>{baht(other)}</dd></div>
    {guest > 0 && <div><dt>ค่าผู้เข้าพักเพิ่ม</dt><dd>{baht(guest)}</dd></div>}
    {discount > 0 && <div className="checkout-discount"><dt>ส่วนลด</dt><dd>−{baht(discount)}</dd></div>}
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
    (sites.length === 1 ? { ...savedCharges, guests:booking.free_guests ?? undefined } : {units:0,electricity:0,damage:0,other:0}))
  // Guests of each lock (its free electricity): what was saved, otherwise the guests billed for that lock in the booking
  // (site.guests), otherwise — where guests are not billed per lock — the booking's paying guests shared evenly.
  const [entries, setEntries] = useState(() => {
    const shared = defaultLockGuests(savedFormula.guests,sites.length)
    return original.map((line,index) => ({
      ...Object.fromEntries(chargeInputs.map(({field,scale}) => [field,String(line[field] / scale)])),
      guests:String(line.guests ?? sites[index].guests ?? shared[index]),
    }))
  })
  const [note, setNote] = useState(booking.note ?? '')
  // Guests who actually stayed and the charge for the extra ones, which the admin types in (it is not worked out).
  const [guests, setGuests] = useState(() => Object.fromEntries(guestFields.map(([key]) => [key,String(booking[key])])))
  const [guestAmount, setGuestAmount] = useState(String((booking.guest_amount ?? 0) / 100))
  const guestNumbers = guestFields.map(([key]) => /^\d{1,3}$/.test(guests[key].trim()) ? Number(guests[key]) : null)
  const guestCount = guestNumbers.includes(null) ? null : guestNumbers.reduce((sum,count) => sum + count,0)
  const guestSatang = booking.completed_at ? booking.guest_amount ?? 0 : decimalUnits(guestAmount.trim() || '0',2,maxExtraSatang)
  // Taken off the bill by the admin, for example when a charge came out too high.
  const [discount, setDiscount] = useState(String((booking.discount_amount ?? 0) / 100))
  const discountSatang = booking.completed_at ? booking.discount_amount ?? 0 : decimalUnits(discount.trim() || '0',2,maxExtraSatang)
  const guestsValid = guestCount > 0 && guestSatang !== null && discountSatang !== null
  const guestsChanged = guestFields.some(([key],index) => guestNumbers[index] !== booking[key]) || guestSatang !== (booking.guest_amount ?? 0) ||
    discountSatang !== (booking.discount_amount ?? 0)
  // A whole-camp stay has its own fixed allowance, so guests per lock do not apply to it.
  const freeEditable = savedFormula.fixedFreeUnits == null
  const [useCurrentFormula, setUseCurrentFormula] = useState(false)
  const [allocate, setAllocate] = useState(false)
  const unallocated = hasUnallocatedCheckoutCharges(booking,lodging.length)
  const keep = unallocated && !allocate
  const formulaChanged = electricityFormulaKey(savedFormula) !== electricityFormulaKey(currentFormula)
  const useCurrent = !keep && formulaChanged && useCurrentFormula
  const formula = useCurrent ? currentFormula : savedFormula
  const charges = booking.completed_at ? savedCharges : !guestsValid ? null : keep ? savedCharges : checkoutChargeTotals(entries,formula)
  const saved = Boolean(booking.version)
  const dirty = useCurrent || (unallocated && allocate) || !charges || guestsChanged || note.trim() !== (booking.note ?? '') ||
    charges.lines?.some((line,index) => (freeEditable ? [...checkoutChargeFields,'guests'] : checkoutChargeFields).some(
      field => line[field] !== original[index][field]))
  const added = checkinUnpaid(booking)
  // Everything to collect at check-out: its own charges plus equipment added at check-in.
  const charged = (charges ? charges.electricity + charges.damage + charges.other + guestSatang : 0) + added
  // A discount only lowers what is collected now; the server refuses one that is larger.
  const discountTooBig = Boolean(charges) && discountSatang > charged
  const extra = charged - (charges ? discountSatang : 0)
  const totals = charges && <CheckoutTotals total={booking.total} added={added} guest={guestSatang} discount={discountSatang} {...charges}/>
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
    {savedLodging ? <section className="checkout-item">
      <div className="checkout-charges" data-guests={lodging.some(site => savedLodging[site.code]?.guests != null) || undefined} data-static>
        <div className="checkout-charges-head" aria-hidden="true"><span>ล็อก / ห้อง</span>
          {lodging.some(site => savedLodging[site.code]?.guests != null) && <span>คน (ไฟฟรี)</span>}
          <span>หน่วยไฟที่ใช้</span><span>ค่าไฟ</span><span>ของชำรุด</span><span>อื่น ๆ</span></div>
        {lodging.map(site => {
          const line = savedLodging[site.code]
          if (!line) return null
          return <div className="checkout-charges-row" key={site.code}>
            <strong className="checkout-charges-site">{site.name}</strong>
            {lodging.some(other => savedLodging[other.code]?.guests != null) && <span><span className="checkout-cell-label">คน (ไฟฟรี)</span>{line.guests ?? '–'}</span>}
            <span><span className="checkout-cell-label">หน่วยไฟที่ใช้</span>{unitFormat.format(line.units / 1000)}</span>
            <span><span className="checkout-cell-label">ค่าไฟ</span><strong>{baht(line.electricity)}</strong></span>
            <span><span className="checkout-cell-label">ของชำรุด</span>{baht(line.damage)}</span>
            <span><span className="checkout-cell-label">อื่น ๆ</span>{baht(line.other)}</span>
          </div>
        })}
      </div>
    </section> : <>
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
        <legend>ผู้เข้าพักจริง</legend>
        {bookedGuests && <p className="checkout-booked-note"><AdminIcon name="bookings"/>{bookedGuests} <strong>(รวม {booking.booked_adults + booking.booked_children + booking.booked_seniors} คน)</strong></p>}
        <div className="checkout-inputs checkout-guest-row">
          {guestFields.map(([key,label]) => <label key={key}>{label}
            <input name={key} type="number" min="0" max="500" step="1" inputMode="numeric" required value={guests[key]}
              onChange={event => setGuests(previous => ({ ...previous, [key]:event.target.value }))}/></label>)}
          <label>ค่าผู้เข้าพักเพิ่ม (บาท)
            <input name="guestAmount" type="number" min="0" max="999999.99" step="0.01" inputMode="decimal" value={guestAmount}
              onChange={event => setGuestAmount(event.target.value)}/></label>
        </div>
        <p className="small muted">ค่าผู้เข้าพักเพิ่มกรอกเองตามที่ตกลงกับลูกค้า ระบบไม่คำนวณให้</p>
      </fieldset>
      {!keep && <fieldset className="checkout-item checkout-charge-group stack">
        <legend>ค่าใช้จ่ายรายล็อก</legend>
        {/* One row per lock, like a spreadsheet: guests (its free units), units used, the electricity worked out, extras. */}
        <div className="checkout-charges" data-guests={freeEditable || undefined}>
          <div className="checkout-charges-head" aria-hidden="true"><span>ล็อก / ห้อง</span>{freeEditable && <span>คน (ไฟฟรี)</span>}
            <span>หน่วยไฟที่ใช้</span><span>ค่าไฟ</span><span>ของชำรุด (บาท)</span><span>อื่น ๆ (บาท)</span></div>
          {sites.map((site,index) => {
            const units = decimalUnits(entries[index].units || '0',3,maxUnitsMilli)
            const setEntry = (field,value) => setEntries(previous => previous.map((entry,i) => i === index ? {...entry,[field]:value} : entry))
            const lockGuests = freeEditable ? lockGuestCount(entries[index].guests) : undefined
            const usage = units === null || lockGuests === null ? null : electricityCharge(units,formula,lockGuests)
            const amount = ({field,label,short,max,step}) => <label key={field}><span className="checkout-cell-label">{short}</span>
              <input name={checkoutChargeField(field,site.code)} type="number" min="0" max={max} step={step} inputMode="decimal"
                aria-label={label + (site.name ? ' ' + site.name : '')} value={entries[index][field]} onChange={event => setEntry(field,event.target.value)}/></label>
            return <div className="checkout-charges-row" key={site.code}>
              <strong className="checkout-charges-site">{site.name || 'ทั้งรายการ'}</strong>
              {freeEditable && <label><span className="checkout-cell-label">คน (ไฟฟรี)</span>
                <input name={checkoutChargeField('guests',site.code)} type="number" min="0" max={maxLockGuests} step="1" inputMode="numeric" required
                  aria-label={'จำนวนคนที่ได้หน่วยไฟฟรี' + (site.name ? ' ' + site.name : '')} value={entries[index].guests}
                  onChange={event => setEntry('guests',event.target.value)}/></label>}
              {amount(chargeInputs[0])}
              <div className="checkout-charges-amount"><span className="checkout-cell-label">ค่าไฟ</span>
                <strong>{usage ? baht(usage.amount) : '–'}</strong>{usage && <small>คิด {unitFormat.format(usage.billableUnits)} หน่วย</small>}</div>
              {chargeInputs.slice(1).map(amount)}
            </div>
          })}
        </div>
        <p className="small muted">{formula.fixedFreeUnits != null
          ? `หน่วยฟรี ${unitFormat.format(formula.fixedFreeUnits)} หน่วยต่อกลุ่มที่เหมาลาน`
          : `ค่าไฟ = (หน่วยที่ใช้ − คน × ${unitFormat.format(formula.freePerGuest / 1000)} หน่วย)${formula.rate !== null ? ` × ${baht(formula.rate)}/หน่วย` : ''} · “คน” เริ่มจากผู้ที่จ่ายค่าล็อกของล็อกนั้นตามการจอง แก้ได้`}</p>
      </fieldset>}
      <div className="checkout-adjust">
        <label>ส่วนลด (บาท)
          <input name="discount" type="number" min="0" max="999999.99" step="0.01" inputMode="decimal" value={discount}
            onChange={event => setDiscount(event.target.value)}/></label>
        <label>หมายเหตุ / รายการค่าใช้จ่าย<textarea name="note" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label>
      </div>
      <p className="small muted">ส่วนลดใช้ปรับยอดลง เช่น เมื่อระบบคิดเกิน · ถ้าต้องการเพิ่มยอดใช้ช่อง “อื่น ๆ” ของล็อก</p>
      {discountTooBig && <p className="notice error" role="alert">ส่วนลดมากกว่ายอดที่ต้องชำระเพิ่ม ({baht(charged)})</p>}
      {totals || <p className="muted small">ตรวจสอบจำนวนหน่วยไฟและค่าใช้จ่ายรายล็อก รวมถึงยอดรวมของแต่ละประเภท</p>}
      {saveState?.error && <p className="notice error" role="alert">{saveState.error}</p>}
      {/* Nothing changed since the last save: go straight on. Otherwise the charges are saved first, then step 2 opens. */}
      {saved && !dirty
        ? <button type="button" className="button" disabled={saving || completing} onClick={() => setWanted(2)}>ถัดไป <AdminIcon name="next"/></button>
        : <button className="button" disabled={saving || completing || !charges || discountTooBig}>{saving ? 'กำลังบันทึก…' : <>บันทึกยอด แล้วไปขั้นถัดไป <AdminIcon name="next"/></>}</button>}
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
    <p className="muted small">หน่วยฟรีของแต่ละล็อก = หน่วยไฟฟรีต่อคน × จำนวนคนของล็อกนั้น<br/>
      ค่าไฟของแต่ละล็อก = (หน่วยที่ใช้ − หน่วยฟรี) × ค่าไฟต่อหน่วย<br/>
      จำนวนคนของแต่ละล็อกกรอกตอน Check-out · อัตรานี้ใช้กับรายการที่ยังไม่ได้บันทึกอัตราค่าไฟ</p>
    <label>เบอร์มือถือพร้อมเพย์ หรือเลขบัตรประชาชน / เลขผู้เสียภาษี<input name="promptpay" inputMode="numeric" maxLength={20} value={recipient} onChange={e => setRecipient(e.target.value)}/></label>
    <p className="muted small">ใช้สร้าง QR ระบุยอดชำระเพิ่มตอน Check-out</p>
    {state?.error && <p className="notice error" role="alert">{state.error}</p>}
    <div className="actions"><button className="button" disabled={pending}><AdminIcon name="save"/>บันทึกการตั้งค่า</button></div>
  </ActionForm>
}
