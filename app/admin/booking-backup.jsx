import { AdminIcon } from './admin-icon'
import { ActionForm } from '../pending-ui'
import { isCalendarDate } from '../../lib/booking-dates'
import { purgeScope, slipPurgeMinDays, slipPurgeWord } from './booking-backup-data'
import { purgeSlips } from './backup-actions'

const messages = {
  invalid:'เลือกวันเริ่มและวันสิ้นสุดให้ครบ และวันเริ่มต้องไม่อยู่หลังวันสิ้นสุด',
  empty:'ไม่มีการจองที่เช็กเอาต์ในช่วงวันที่เลือก',
  large:'ช่วงที่เลือกมีไฟล์รวมเกิน 4 GB กรุณาเลือกช่วงให้สั้นลงแล้วสำรองทีละช่วง',
}
const purgeMessages = {
  invalid:'เลือกวันเริ่มและวันสิ้นสุดให้ครบ และวันเริ่มต้องไม่อยู่หลังวันสิ้นสุด',
  unconfirmed:`ยังไม่ได้ลบ กรุณาติ๊กยืนยันว่าดาวน์โหลดไฟล์สำรองแล้ว และพิมพ์คำว่า ${slipPurgeWord} ให้ตรง`,
}
const size = bytes => bytes >= 1e9 ? (bytes / 1e9).toFixed(2) + ' GB' : bytes >= 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB'

// Step 1 downloads bookings and slips for a period (bookings-backup/route.js) and removes nothing.
// Step 2 frees space by removing the slip images of finished bookings in a period that has been backed up.
export async function BookingBackup({query}) {
  const value = name => isCalendarDate(query[name]) ? query[name] : ''
  const purgeFrom = value('purgeFrom'), purgeTo = value('purgeTo')
  const checking = purgeFrom && purgeTo && purgeFrom <= purgeTo
  const scope = checking ? await purgeScope(purgeFrom,purgeTo) : null
  return <>
    <section className="panel stack booking-backup">
      <header><span className="eyebrow">BACKUP · ขั้นที่ 1</span><h2>สำรองข้อมูลการจอง</h2>
        <p>ดาวน์โหลดรายการจองและสลิปการโอนของช่วงที่เลือกเป็นไฟล์ ZIP เดียว เลือกตามวันเช็กเอาต์ รวมทุกสถานะ</p></header>
      {messages[query.backup] && <p className="notice error" role="alert">{messages[query.backup]}</p>}
      {/* A plain GET form: the browser saves the ZIP while this page stays open. */}
      <form action="/admin/bookings-backup" method="get" className="admin-edit-form blackout-form">
        <label>เช็กเอาต์ตั้งแต่<input name="from" type="date" defaultValue={value('from')} required/></label>
        <label>เช็กเอาต์ถึง<input name="to" type="date" defaultValue={value('to')} required/></label>
        <div className="admin-edit-footer"><button className="button"><AdminIcon name="download"/>ดาวน์โหลดไฟล์สำรอง</button></div>
      </form>
      <p className="small muted">ในไฟล์มี bookings.csv (รายการจอง), booking-items.csv (ล็อก ห้องพัก และอุปกรณ์) และโฟลเดอร์ slips ที่ตั้งชื่อสลิปตามรหัสจอง เปิดไฟล์ CSV ด้วย Excel ได้</p>
      <p className="small muted">การสำรองไม่ลบข้อมูลใดออกจากระบบ ไฟล์มีชื่อ เบอร์โทร และสลิปของลูกค้า กรุณาเก็บในที่ปลอดภัย</p>
    </section>
    <section className="panel stack booking-backup" id="slip-purge">
      <header><span className="eyebrow">BACKUP · ขั้นที่ 2</span><h2>ลบรูปสลิปที่สำรองแล้ว</h2>
        <p>คืนพื้นที่โดยลบเฉพาะรูปสลิป รายการจอง ยอดเงิน และสถิติยังอยู่ครบ ระบบกันสลิปซ้ำยังทำงานกับสลิปที่ลบไปแล้ว</p></header>
      {query.purged !== undefined && <p className="notice" role="status">ลบรูปสลิปแล้ว {Number(query.purged) || 0} ไฟล์</p>}
      {purgeMessages[query.purge] && <p className="notice error" role="alert">{purgeMessages[query.purge]}</p>}
      <ul className="small muted">
        <li>ลบได้เฉพาะรายการที่ Check-out แล้วหรือยกเลิกแล้ว และผ่านวันเช็กเอาต์มาแล้วอย่างน้อย {slipPurgeMinDays} วัน</li>
        <li>รายการที่รอตรวจสลิป ยืนยันแล้วแต่ยังไม่ Check-out หรือยังไม่ถึงกำหนด จะไม่ถูกแตะ</li>
        <li>ลบแล้วกู้คืนจากระบบไม่ได้ ต้องเปิดดูจากไฟล์สำรองเท่านั้น</li>
      </ul>
      {/* Checking first shows exactly what would go before anything is removed. */}
      <form action="/admin#slip-purge" method="get" className="admin-edit-form blackout-form">
        <input type="hidden" name="section" value="storage"/>
        <label>เช็กเอาต์ตั้งแต่<input name="purgeFrom" type="date" defaultValue={purgeFrom} required/></label>
        <label>เช็กเอาต์ถึง<input name="purgeTo" type="date" defaultValue={purgeTo} required/></label>
        <div className="admin-edit-footer"><button className="button secondary"><AdminIcon name="search"/>ตรวจจำนวนที่จะลบ</button></div>
      </form>
      {(purgeFrom || purgeTo) && !checking && <p className="notice error" role="alert">{purgeMessages.invalid}</p>}
      {scope && <div className="notice stack">
        <p><strong>ช่วงเช็กเอาต์ {purgeFrom} ถึง {purgeTo}</strong></p>
        <p>ลบได้ <strong>{scope.eligible} ไฟล์</strong> · คืนพื้นที่ประมาณ <strong>{size(scope.bytes)}</strong>{scope.kept > 0 && <> · เก็บไว้ {scope.kept} ไฟล์เพราะยังไม่เข้าเงื่อนไข</>}</p>
        {scope.eligible > 0 ? <ActionForm action={purgeSlips} className="stack">
          <input type="hidden" name="from" value={purgeFrom}/><input type="hidden" name="to" value={purgeTo}/>
          <label className="checkbox-row"><input type="checkbox" name="downloaded" required/> ฉันดาวน์โหลดไฟล์สำรองของช่วงนี้และเปิดดูสลิปในไฟล์ได้แล้ว</label>
          <label>พิมพ์คำว่า {slipPurgeWord} เพื่อยืนยัน<input name="confirm" autoComplete="off" required placeholder={slipPurgeWord}/></label>
          <div className="actions"><button className="button danger">ลบรูปสลิป {scope.eligible} ไฟล์</button></div>
        </ActionForm> : <p>ไม่มีรูปสลิปที่ลบได้ในช่วงนี้</p>}
      </div>}
    </section>
  </>
}
