'use client'

import { AdminIcon } from './admin-icon'

import { useRef, useState } from 'react'
import { wholeCampGuestLimit, wholeCampRateFields } from '../../lib/whole-camp'
import { useConfirm } from '../confirm-dialog'

export function WholeCampRateFields({tiers}) {
  const [rows,setRows] = useState(() => tiers.map((tier,id) => ({id,...tier})))
  const nextId = useRef(rows.length)
  const confirm = useConfirm()

  function addGroup() {
    const id = nextId.current++
    setRows(previous => [...previous,{id,maxGuests:''}])
  }

  function updateMax(id, maxGuests) {
    setRows(previous => previous.map(row => row.id === id ? {...row,maxGuests} : row))
  }

  return <>
    {rows.map((row,index) => {
      const previousMax = index ? Number(rows[index - 1].maxGuests) : 0
      const minGuests = previousMax + 1
      const label = Number(row.maxGuests) >= minGuests
        ? `กลุ่ม ${minGuests}–${row.maxGuests} คน` : `กลุ่มตั้งแต่ ${minGuests} คน`
      return <fieldset key={row.id} className="form-grid admin-calendar-form whole-camp-rate-fields">
        <legend>{label}</legend>
        <label>จำนวนคนสูงสุด<input name="wholeCamp-maxGuests" type="number" min={minGuests} max={wholeCampGuestLimit}
          value={row.maxGuests} onChange={event => updateMax(row.id,event.target.value)} required/></label>
        {wholeCampRateFields.map(({name,label,max}) => <label key={name}>{label}
          <input name={`wholeCamp-${name}`} type="number" min="0" max={max} defaultValue={row[name]} required/>
        </label>)}
        <button type="button" className="button secondary delete-tier" disabled={rows.length === 1}
          aria-label={'ลบ' + label} onClick={async () => {
            if (!(await confirm({
              title:`ลบ${label}?`,
              message:'กลุ่มนี้จะหายจากฟอร์มทันที และจะถูกลบจริงเมื่อกด “บันทึกราคาเหมาลาน”',
              items:[label],
              confirmLabel:'ลบกลุ่ม',
            }))) return
            setRows(previous => previous.filter(item => item.id !== row.id))
          }}><AdminIcon name="trash"/>ลบกลุ่ม</button>
      </fieldset>
    })}
    <div className="actions">
      <button type="button" className="button secondary" disabled={rows.length >= wholeCampGuestLimit} onClick={addGroup}>+ เพิ่มกลุ่ม</button>
      <button className="button"><AdminIcon name="save"/>บันทึกราคาเหมาลาน</button>
    </div>
  </>
}
