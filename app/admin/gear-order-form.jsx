'use client'

import { useState } from 'react'
import { ActionForm } from '../pending-ui'
import { AdminIcon } from './admin-icon'
import { saveGearOrder } from './actions'

// Lets the admin arrange the rental items of one tab (tents or equipment); customers see them in this order.
export function GearOrderForm({items, tab}) {
  const [order,setOrder] = useState(items)
  const move = (index,step) => setOrder(current => {
    const next = [...current]
    const target = index + step
    if (target < 0 || target >= next.length) return current
    ;[next[index],next[target]] = [next[target],next[index]]
    return next
  })
  const changed = order.some((item,index) => item.code !== items[index].code)
  return <details className="panel gear-order">
    <summary>จัดลำดับการแสดง{tab === 'tents' ? 'เต็นท์' : 'อุปกรณ์'} ({items.length} รายการ)</summary>
    <p className="small muted">กด ↑ ↓ เพื่อเลื่อนรายการ แล้วกดบันทึกลำดับ ลูกค้าจะเห็นรายการเรียงตามนี้ในหน้าเช่าอุปกรณ์เพิ่ม</p>
    <ActionForm action={saveGearOrder} className="stack">
      <input type="hidden" name="tab" value={tab}/>
      <input type="hidden" name="codes" value={JSON.stringify(order.map(item => item.code))}/>
      <ol className="gear-order-list">
        {order.map((item,index) => <li key={item.code} data-inactive={!item.active || undefined}>
          <span className="gear-order-number">{index + 1}</span>
          <span className="gear-order-name">{item.name}{!item.active && <small> · ปิดให้จอง</small>}</span>
          <button type="button" className="button secondary" aria-label={'เลื่อน ' + item.name + ' ขึ้น'} disabled={index === 0} onClick={() => move(index,-1)}>↑</button>
          <button type="button" className="button secondary" aria-label={'เลื่อน ' + item.name + ' ลง'} disabled={index === order.length - 1} onClick={() => move(index,1)}>↓</button>
        </li>)}
      </ol>
      <div className="actions"><button className="button" disabled={!changed}><AdminIcon name="save"/>บันทึกลำดับ</button></div>
    </ActionForm>
  </details>
}
