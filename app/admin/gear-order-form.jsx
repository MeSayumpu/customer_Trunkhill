'use client'

import { useRef, useState } from 'react'
import { ActionForm } from '../pending-ui'
import { AdminIcon } from './admin-icon'
import { RentalPhoto } from '../rental-picker'
import { saveGearOrder } from './actions'

const baht = value => '฿' + Number(value).toLocaleString('th-TH')

// Lets the admin arrange the rental items of one tab (tents or equipment); customers see them in this order.
// Rows move by dragging or with ↑ ↓; the preview shows the list the way the customer's rental popup lists it, before anything is saved.
export function GearOrderForm({items, tab}) {
  const [order,setOrder] = useState(items)
  const [dragging,setDragging] = useState(null)
  const preview = useRef(null)
  const place = (from,to) => setOrder(current => {
    if (from === to || to < 0 || to >= current.length) return current
    const next = [...current]
    next.splice(to,0,...next.splice(from,1))
    return next
  })
  const changed = order.some((item,index) => item.code !== items[index].code)
  const label = tab === 'tents' ? 'เต็นท์' : 'อุปกรณ์'
  const shown = order.filter(item => item.active)
  return <section className="panel gear-order">
    <h3>จัดลำดับการแสดง{label} ({items.length} รายการ)</h3>
    <p className="small muted">ลากรายการ หรือกด ↑ ↓ เพื่อเลื่อนลำดับ กดดูตัวอย่างเพื่อดูหน้าที่ลูกค้าจะเห็น แล้วจึงบันทึก</p>
    <ActionForm action={saveGearOrder} className="stack">
      <input type="hidden" name="tab" value={tab}/>
      <input type="hidden" name="codes" value={JSON.stringify(order.map(item => item.code))}/>
      <ol className="gear-order-list">
        {order.map((item,index) => <li key={item.code} draggable data-inactive={!item.active || undefined}
          data-dragging={dragging === item.code || undefined}
          onDragStart={event => { setDragging(item.code); event.dataTransfer.effectAllowed = 'move' }}
          onDragOver={event => {
            if (dragging === null) return
            event.preventDefault()
            place(order.findIndex(row => row.code === dragging),index)
          }}
          onDragEnd={() => setDragging(null)}>
          <span className="gear-order-handle" aria-hidden="true">⋮⋮</span>
          <span className="gear-order-number">{index + 1}</span>
          <span className="gear-order-name">{item.name}{!item.active && <small> · ปิดให้จอง</small>}</span>
          <button type="button" className="button secondary" aria-label={'เลื่อน ' + item.name + ' ขึ้น'} disabled={index === 0} onClick={() => place(index,index - 1)}>↑</button>
          <button type="button" className="button secondary" aria-label={'เลื่อน ' + item.name + ' ลง'} disabled={index === order.length - 1} onClick={() => place(index,index + 1)}>↓</button>
        </li>)}
      </ol>
      <div className="actions">
        <button type="button" className="button secondary" onClick={() => preview.current.showModal()}><AdminIcon name="search"/>ดูตัวอย่าง</button>
        <button className="button" disabled={!changed}><AdminIcon name="save"/>บันทึกลำดับ</button>
        {changed && <button type="button" className="button secondary" onClick={() => setOrder(items)}>คืนค่าเดิม</button>}
      </div>
      <dialog ref={preview} className="dialog admin-dialog gear-order-preview" aria-labelledby="gear-order-preview-title">
        <header className="admin-dialog-header">
          <h2 id="gear-order-preview-title">ตัวอย่างหน้าลูกค้า · {label}</h2>
          <button type="button" className="button secondary" aria-label="ปิดหน้าต่าง" onClick={() => preview.current.close()}><AdminIcon name="close"/></button>
        </header>
        <div className="stack gear-order-preview-body">
          <p className="small muted">{changed ? 'ลำดับนี้ยังไม่ได้บันทึก ลูกค้าจะเห็นตามนี้หลังกดบันทึกลำดับ' : 'ลำดับที่ลูกค้าเห็นอยู่ตอนนี้'}
            {shown.length < order.length && ' · รายการที่ปิดให้จองไม่แสดงกับลูกค้า'}</p>
          {shown.length === 0 && <p className="muted">ยังไม่มีรายการที่เปิดให้จอง</p>}
          {shown.map(item => <div key={item.code} className="gear-preview-row">
            <RentalPhoto row={item}/>
            <span className="gear-preview-name">{item.name}<small>{baht(item.price)}{tab === 'tents' && ' / คืน'}</small></span>
            <span className="gear-preview-counter" aria-hidden="true"><i>−</i><b>0</b><i>+</i></span>
          </div>)}
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => preview.current.close()}>กลับไปแก้ไข</button>
            <button className="button" disabled={!changed}><AdminIcon name="save"/>บันทึกลำดับ</button>
          </div>
        </div>
      </dialog>
    </ActionForm>
  </section>
}
