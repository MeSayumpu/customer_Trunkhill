'use client'

import { useState } from 'react'
import { guestRateLineMax, guestRateLinesMax } from '../../lib/guest-types'

const blank = {th:'',en:''}

// Lines the admin writes for the "อัตราค่าเข้าพัก" box of the customer's guest picker: add, edit, remove.
// Sent as JSON in the hidden field; empty rows are dropped.
export function GuestRateLinesField({lines:initial}) {
  const [rows,setRows] = useState(() => initial.length ? initial : [blank])
  const change = (index,field,value) => setRows(current => current.map((row,i) => i === index ? {...row,[field]:value} : row))
  const lines = rows.map(row => ({th:row.th.trim(),en:row.en.trim()})).filter(row => row.th)
  return <div className="stack">
    <input type="hidden" name="lines" value={JSON.stringify(lines)}/>
    <div className="tent-tier-list">
      {rows.map((row,index) => <div key={index} className="tent-tier-row guest-rate-line-row">
        <label>คำอธิบาย บรรทัดที่ {index + 1}
          <input maxLength={guestRateLineMax} value={row.th} placeholder="เช่น ผู้สูงอายุมาโดยไม่มีผู้ใหญ่ คิดราคาเท่าผู้ใหญ่" onChange={event => change(index,'th',event.target.value)}/>
        </label>
        <label>English (เว้นว่างได้)
          <input maxLength={guestRateLineMax} value={row.en} onChange={event => change(index,'en',event.target.value)}/>
        </label>
        <button type="button" className="button secondary" aria-label={'ลบบรรทัดที่ ' + (index + 1)} disabled={rows.length === 1 && !row.th && !row.en}
          onClick={() => setRows(current => current.length > 1 ? current.filter((_,i) => i !== index) : [blank])}>ลบ</button>
      </div>)}
    </div>
    {rows.length < guestRateLinesMax && <button type="button" className="button secondary tent-tier-add" onClick={() => setRows(current => [...current,blank])}>+ เพิ่มบรรทัด</button>}
    {rows.some(row => !row.th.trim() && row.en.trim()) && <p className="notice error" role="alert">บรรทัดที่มีแต่ภาษาอังกฤษจะไม่ถูกบันทึก กรุณาใส่ข้อความภาษาไทยด้วย</p>}
  </div>
}
