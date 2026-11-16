'use client'
import {displayDate} from '../booking-pickers'
import {useI18n} from '../i18n'
const state=value=>typeof value==='string'?JSON.parse(value):value
// Each reschedule lists only what changed: the dates, plots or rooms that moved, and items added, removed or re-counted.
export function RescheduleHistory({history=[],embedded=false}) {
 const {t,locale}=useI18n()
 if(!history.length)return null
 const label=item=>`${t(item.name)} × ${item.quantity}`
 return <section className={embedded?"stack":"panel stack"}>{!embedded&&<h2>{t('ประวัติการเลื่อน')}</h2>}{history.map(row=>{
  const before=state(row.before_state),after=state(row.after_state)
  const dates=value=>`${displayDate(value.arrival)} – ${displayDate(value.departure)}`
  const dateChanged=before.arrival!==after.arrival||before.departure!==after.departure
  const removed=before.items.filter(item=>!after.items.some(next=>next.code===item.code))
  const added=after.items.filter(item=>!before.items.some(previous=>previous.code===item.code))
  const recounted=after.items.flatMap(item=>{
   const previous=before.items.find(old=>old.code===item.code)
   return previous&&previous.quantity!==item.quantity?[[previous,item]]:[]
  })
  // The customer moves plots one for one, so the same number out and in reads best as "A03 → A05".
  const moved=removed.length===added.length?removed.map((item,index)=>[item,added[index]]):[]
  const unchanged=!dateChanged&&!removed.length&&!added.length&&!recounted.length
  return <article className="notice stack reschedule-entry" key={row.revision}>
   <strong>{t('เลื่อนครั้งที่ {n}',{n:row.revision})}</strong>
   <small>{new Date(String(row.created_at).replace(' ','T')+'Z').toLocaleString(locale,{timeZone:'Asia/Bangkok'})}</small>
   <dl className="reschedule-changes">
    {dateChanged&&<div><dt>{t('วันที่เข้าพัก')}</dt><dd><del>{dates(before)}</del><span aria-hidden="true"> → </span><ins>{dates(after)}</ins></dd></div>}
    {moved.map(([from,to])=><div key={from.code}><dt>{t('ย้าย')}</dt><dd><del>{label(from)}</del><span aria-hidden="true"> → </span><ins>{label(to)}</ins></dd></div>)}
    {!moved.length&&removed.length>0&&<div><dt>{t('นำออก')}</dt><dd><del>{removed.map(label).join(', ')}</del></dd></div>}
    {!moved.length&&added.length>0&&<div><dt>{t('เพิ่ม')}</dt><dd><ins>{added.map(label).join(', ')}</ins></dd></div>}
    {recounted.map(([from,to])=><div key={to.code}><dt>{t('จำนวน')}</dt><dd>{t(to.name)} <del>× {from.quantity}</del><span aria-hidden="true"> → </span><ins>× {to.quantity}</ins></dd></div>)}
   </dl>
   {unchanged&&<p>{t('ไม่มีรายการที่เปลี่ยนแปลง')}</p>}
   {!unchanged&&<small>{t('รายการอื่นคงเดิม')}</small>}
  </article>
 })}</section>
}
