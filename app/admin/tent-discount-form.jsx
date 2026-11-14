'use client'

import { AdminIcon } from './admin-icon'

import { useRef, useState } from 'react'
import { ActionForm } from '../pending-ui'
import { saveTentDiscount } from './actions'

export function TentDiscountForm({ models }) {
  const dialog = useRef(null)
  const [values, setValues] = useState({ discount:'', guestLimit:'' })
  const [selected, setSelected] = useState([])
  const allSelected = models.length > 0 && models.every(model => selected.includes(model.code))

  function chooseModels(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setValues({ discount:data.get('tentDiscount'), guestLimit:data.get('guestLimit') })
    setSelected([])
    dialog.current.showModal()
  }

  return <div className="stack">
    <form onSubmit={chooseModels} className="stack">
      <h2>ส่วนลดเมื่อจองลานและเช่าเต็นท์</h2>
      <div className="form-grid">
        <label>ส่วนลด (บาท/ผู้ใหญ่/คืน)<input name="tentDiscount" type="number" min="0" max="100000" required/></label>
        <label>จำนวนผู้ใหญ่สูงสุดต่อการจองของแต่ละรุ่น<input name="guestLimit" type="number" min="0" max="100" required/></label>
        <div className="actions"><button className="button" disabled={!models.length}><AdminIcon name="save"/>บันทึกส่วนลด</button></div>
      </div>
    </form>
    <dialog ref={dialog} className="dialog admin-dialog" aria-labelledby="tent-discount-title">
      <header className="admin-dialog-header">
        <h2 id="tent-discount-title">เลือกเต็นท์ที่จะใช้ส่วนลด</h2>
        <button type="button" className="button secondary" aria-label="ปิดหน้าต่าง" onClick={() => dialog.current.close()}>×</button>
      </header>
      <ActionForm action={saveTentDiscount} className="admin-edit-form" onSubmit={() => dialog.current.close()}>
        <input type="hidden" name="tentDiscount" value={values.discount}/>
        <input type="hidden" name="guestLimit" value={values.guestLimit}/>
        <div className="actions" style={{gridColumn:'1/-1'}}>
          <p>ลด {values.discount} บาทต่อผู้ใหญ่ต่อคืน สูงสุด {values.guestLimit} คนต่อรุ่น</p>
          <button type="button" className="button secondary" disabled={!models.length}
            onClick={() => setSelected(allSelected ? [] : models.map(model => model.code))}>
            {allSelected ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
          </button>
        </div>
        {models.map(model => <label className="checkbox" key={model.code}>
          <input type="checkbox" name="tentCode" value={model.code} checked={selected.includes(model.code)}
            onChange={event => {
              const checked = event.target.checked
              setSelected(previous => checked ? [...previous,model.code] : previous.filter(code => code !== model.code))
            }}/>
          {model.name}
        </label>)}
        <div className="admin-edit-footer">
          <button type="button" className="button secondary" onClick={() => dialog.current.close()}>ยกเลิก</button>
          <button className="button" disabled={!selected.length}>ยืนยันส่วนลด</button>
        </div>
      </ActionForm>
    </dialog>
  </div>
}
