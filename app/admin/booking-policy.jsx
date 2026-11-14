
import { AdminIcon } from './admin-icon'
import {rescheduleLimit,rescheduleNotice} from '../../lib/booking-dates'
import {database} from '../../lib/db'
import {ActionForm} from '../pending-ui'
import {saveBookingPolicy} from './actions'
export async function BookingPolicy(){
 const [[settings]]=await database().query('SELECT reschedule_notice_days,reschedule_limit FROM settings WHERE id=1')
 const notice=settings.reschedule_notice_days??rescheduleNotice
 const limit=settings.reschedule_limit??rescheduleLimit
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
 </section>
}
