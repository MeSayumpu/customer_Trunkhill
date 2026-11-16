
import { AdminIcon } from './admin-icon'
import {rescheduleLimit,rescheduleNotice} from '../../lib/booking-dates'
import {database} from '../../lib/db'
import {ActionForm} from '../pending-ui'
import {saveBookingPolicy,addRescheduleBlackout,deleteRescheduleBlackout} from './actions'
import {blackoutRange} from '../../lib/reschedule-blackout'
import {campOptions} from '../../lib/camp-options'
import {rescheduleNoteDefault} from '../../lib/booking-dates'
import {saveRescheduleNote} from './camp-options-actions'
export async function BookingPolicy(){
 const [[settings]]=await database().query('SELECT reschedule_notice_days,reschedule_limit FROM settings WHERE id=1')
 const notice=settings.reschedule_notice_days??rescheduleNotice
 const limit=settings.reschedule_limit??rescheduleLimit
 const saved=(await campOptions()).rescheduleNote
 const note={th:saved?.th||'',en:saved?.en||''}
 const [blackouts]=await database().query("SELECT id,label,DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date,DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date,end_date<CURRENT_DATE AS past FROM reschedule_blackouts ORDER BY start_date,id")
 return <section className="panel stack admin-content"><h2>เงื่อนไขการเลื่อนการจอง</h2>
  <ActionForm action={saveBookingPolicy} className="stack">
   <label>จำนวนครั้งที่เลื่อนได้ต่อการจอง<input name="rescheduleLimit" type="number" min="0" max="255" step="1" required defaultValue={limit}/></label>
   <p>ตั้งได้ 0–255 ครั้ง โดย 0 คือปิดรับการเลื่อน ใช้กับการจองเดิมและใหม่ ไม่ล้างจำนวนครั้งที่เคยใช้ไป</p>
   <label>จำนวนวันที่ต้องเลื่อนล่วงหน้าอย่างน้อย (วัน)<input name="noticeDays" type="number" min="0" max="365" step="1" required defaultValue={notice}/></label>
   <p>ตั้งได้ 0–365 วัน โดย 0 หมายถึงเลื่อนได้ถึงวันเข้าพักเดิม มีผลกับวันเข้าพักเดิมและวันเข้าพักใหม่</p>
   <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกเงื่อนไข</button></div>
  </ActionForm>
  <p>เลื่อนได้รวม {limit} ครั้ง ล่วงหน้าอย่างน้อย {notice} วัน ทั้งวันเข้าพักเดิมและวันเข้าพักใหม่</p>
  <p>ส่งสลิปแล้วเลื่อนได้โดยไม่ต้องรอแอดมินตรวจ ลูกค้าเปลี่ยนได้เฉพาะวันที่และล็อก จำนวนคืน ข้อมูลผู้จอง อุปกรณ์ และยอดจองคงเดิม</p>
  <p>ต้องผ่านการตรวจวันเปิดให้เข้าพัก ล็อกว่าง และสต๊อกอุปกรณ์ตลอดทุกคืน ระบบเก็บประวัติภายใต้รหัสเดิม</p>
  <h3>คำอธิบายใต้เงื่อนไขในหน้าตรวจสอบการจอง</h3>
  <p>แสดงใต้บรรทัด “ใช้สิทธิ์แล้ว … ครั้ง · เหลือ … ครั้ง” หลังลูกค้าค้นหาการจอง ขึ้นบรรทัดใหม่ได้ พิมพ์ {'{days}'} แทนจำนวนวันล่วงหน้า และ {'{n}'} แทนจำนวนครั้งที่เลื่อนได้ เว้นว่างเพื่อใช้ข้อความเดิมของระบบ</p>
  <ActionForm action={saveRescheduleNote} className="stack">
   <label>ภาษาไทย<textarea name="th" rows={3} maxLength={600} defaultValue={note.th} placeholder={rescheduleNoteDefault}/></label>
   <label>English<textarea name="en" lang="en" rows={3} maxLength={600} defaultValue={note.en} placeholder="เว้นว่างเพื่อใช้ข้อความอังกฤษเดิมของระบบ"/></label>
   <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกคำอธิบาย</button></div>
  </ActionForm>
  <h3>ช่วงวันที่ห้ามเลื่อนการจอง</h3>
  <p>เช่น Long Weekend หรือวันหยุดยาว การจองที่มีคืนเข้าพักอยู่ในช่วงนี้ ลูกค้าจะเลื่อนหรือแก้ไขเองไม่ได้ และจะเห็นข้อความแจ้งก่อนยืนยันการจอง</p>
  {blackouts.length ? <ul className="blackout-list" role="list">
   {blackouts.map(row=><li key={row.id} data-past={row.past?true:undefined}>
    <span><strong>{row.label}</strong><small>{blackoutRange(row)}{row.past?' · ผ่านไปแล้ว':''}</small></span>
    <ActionForm action={deleteRescheduleBlackout}><input type="hidden" name="id" value={row.id}/><button className="button secondary" aria-label={'ลบช่วง '+row.label}>ลบ</button></ActionForm>
   </li>)}
  </ul> : <p className="muted">ยังไม่มีช่วงวันที่ห้ามเลื่อน</p>}
  <ActionForm action={addRescheduleBlackout} className="admin-edit-form blackout-form">
   <label>ชื่อช่วง<input name="label" maxLength={120} placeholder="เช่น Long Weekend ปีใหม่" required/></label>
   <label>วันเริ่ม (คืนแรก)<input name="start" type="date" required/></label>
   <label>วันสิ้นสุด (คืนสุดท้าย)<input name="end" type="date" required/></label>
   <div className="admin-edit-footer"><button className="button"><AdminIcon name="save"/>เพิ่มช่วงห้ามเลื่อน</button></div>
  </ActionForm>
 </section>
}
