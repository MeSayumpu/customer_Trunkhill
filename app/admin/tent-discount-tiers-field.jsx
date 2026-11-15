'use client'

import { useState } from 'react'
import { tentDiscountFor } from '../../lib/pricing'

// Discount steps of one tent model: for a booking with this many adults, each adult gets this much off per night.
// A booking with more adults than the largest step is discounted like the largest step.
export function TentDiscountTiersField({tiers:initial, price}) {
  const [rows,setRows] = useState(() => initial.length ? initial.map(([adults,rate]) => ({adults:String(adults),rate:String(rate)})) : [{adults:'',rate:''}])
  const change = (index,field,value) => setRows(current => current.map((row,i) => i === index ? {...row,[field]:value} : row))
  const filled = rows.filter(row => Number(row.adults) > 0 && Number(row.rate) > 0)
  const tiers = filled.map(row => [Number(row.adults),Number(row.rate)]).sort((a,b) => a[0] - b[0])
  const duplicate = new Set(tiers.map(([adults]) => adults)).size !== tiers.length
  const largest = tiers.at(-1)?.[0]
  const tent = {price:Number(price) || 0, quantity:1, tent_discount_tiers:tiers}
  return <fieldset className="inventory-edit-group inventory-edit-discount tent-tiers">
    <legend>ส่วนลดเต็นท์รุ่นนี้</legend>
    <input type="hidden" name="tentDiscountTiers" value={JSON.stringify(tiers)}/>
    <p className="small muted">ลูกค้าที่จองลานและเช่าเต็นท์รุ่นนี้จะได้ส่วนลดตามจำนวนผู้ใหญ่ที่มาพัก เช่น มา 1 คน ลดคนละ 200 บาท, มา 2 คน ลดคนละ 150 บาท ถ้าไม่ต้องการให้ส่วนลด ให้ลบทุกแถว</p>
    <div className="tent-tier-list">
      {rows.map((row,index) => <div key={index} className="tent-tier-row">
        <label>ถ้ามาพักผู้ใหญ่ (คน)
          <input type="number" min="1" max="100" value={row.adults} onChange={event => change(index,'adults',event.target.value)}/>
        </label>
        <label>ลดให้คนละ (บาท/คืน)
          <input type="number" min="0" max="100000" value={row.rate} onChange={event => change(index,'rate',event.target.value)}/>
        </label>
        <button type="button" className="button secondary" aria-label="ลบแถวนี้" disabled={rows.length === 1 && !row.adults && !row.rate}
          onClick={() => setRows(current => current.length > 1 ? current.filter((_,i) => i !== index) : [{adults:'',rate:''}])}>ลบ</button>
      </div>)}
    </div>
    {rows.length < 10 && <button type="button" className="button secondary tent-tier-add" onClick={() => setRows(current => [...current,{adults:'',rate:''}])}>+ เพิ่มแถวส่วนลด</button>}
    {duplicate && <p className="notice error" role="alert">มีแถวที่จำนวนผู้ใหญ่ซ้ำกัน กรุณาแก้ให้แต่ละแถวไม่ซ้ำกัน</p>}
    {tiers.length > 0 && !duplicate && <div className="tent-tier-example">
      <strong>ลูกค้าจะได้ส่วนลดดังนี้ (เช่า 1 หลัง ต่อ 1 คืน)</strong>
      <ul>
        {Array.from({length:largest},(_,i) => i + 1).map(adults => <li key={adults}>มา {adults} คน → ลด {tentDiscountFor([tent],adults).toLocaleString('th-TH')} บาท</li>)}
        <li>มา {largest + 1} คนขึ้นไป → ลด {tentDiscountFor([tent],largest + 1).toLocaleString('th-TH')} บาท (เท่ากับมา {largest} คน)</li>
      </ul>
      <p className="small muted">ส่วนลดจะไม่มากกว่าค่าเช่าเต็นท์</p>
    </div>}
  </fieldset>
}
