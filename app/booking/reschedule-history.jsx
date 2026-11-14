'use client'
import {displayDate} from '../booking-pickers'
import {useI18n} from '../i18n'
const state=value=>typeof value==='string'?JSON.parse(value):value
export function RescheduleHistory({history=[],embedded=false}) {
 const {t,locale}=useI18n()
 if(!history.length)return null
 const items=list=>list.map(i=>`${t(i.name)} × ${i.quantity}`).join(', ')
 return <section className={embedded?"stack":"panel stack"}>{!embedded&&<h2>{t('ประวัติการเลื่อน')}</h2>}{history.map(row=>{
  const before=state(row.before_state),after=state(row.after_state)
  return <article className="notice stack" key={row.revision}>
   <strong>{t('เลื่อนครั้งที่ {n}',{n:row.revision})}</strong>
   <small>{new Date(String(row.created_at).replace(' ','T')+'Z').toLocaleString(locale,{timeZone:'Asia/Bangkok'})}</small>
   <p>{t('เดิม:')} {displayDate(before.arrival)} – {displayDate(before.departure)} · {items(before.items)}</p>
   <p>{t('ใหม่:')} {displayDate(after.arrival)} – {displayDate(after.departure)} · {items(after.items)}</p>
  </article>
 })}</section>
}
