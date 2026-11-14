
import { AdminIcon } from './admin-icon'
import {database} from '../../lib/db'
import {guardPhone} from '../../lib/phone-guard'
import {ActionForm,AdminSearchForm} from '../pending-ui'
import {unlockPhone} from './actions'
import {ConfirmSubmit} from '../confirm-dialog'

export async function BlockedPhones({query}) {
  const q=guardPhone(typeof query.q==='string'?query.q.slice(0,30):'')
  const [rows]=await database().execute(`SELECT * FROM booking_phone_guards WHERE ${q?'phone=?':'blocked_at IS NOT NULL'} ORDER BY blocked_at DESC,phone LIMIT 200`,q?[q]:[])
  const [events]=await database().execute(`SELECT booking,phone,created_at FROM duplicate_slip_events ${q?'WHERE phone=?':''} ORDER BY created_at DESC LIMIT 50`,q?[q]:[])
  return <section className="panel stack admin-content">
    <h2>เบอร์ที่ถูกบล็อก / ประวัติสลิปซ้ำ</h2>
    <p>บล็อกเมื่อส่งไฟล์สลิปซ้ำเกิน 3 รายการ (ครั้งที่ 4) การส่งซ้ำในรายการเดิมไม่นับเพิ่ม ปลดล็อกแล้วเริ่มนับใหม่ โดยเก็บประวัติไว้</p>
    <AdminSearchForm className="admin-filters"><input type="hidden" name="section" value="blockedPhones"/>
      <label>ค้นหาเบอร์โทร<input name="q" defaultValue={q} maxLength={30}/></label><button className="button"><AdminIcon name="search"/>ค้นหา</button>
    </AdminSearchForm>
    <p className="small muted">แสดงสูงสุด 200 เบอร์ ค้นหาเบอร์เพื่อดูประวัติเฉพาะราย</p>
    <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>เบอร์โทร</th><th>จำนวนครั้งรอบนี้</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.phone}><td>{row.phone}</td><td>{row.duplicate_count}</td><td>{row.blocked_at?'ถูกบล็อก':'จองได้'}</td><td>
        {row.blocked_at&&<ActionForm action={unlockPhone}><input type="hidden" name="phone" value={row.phone}/><input type="hidden" name="blockedAt" value={row.blocked_at}/>
          <ConfirmSubmit className="button secondary" confirm={{
            title:`ปลดล็อกเบอร์ ${row.phone}?`,
            message:'จำนวนครั้งที่ส่งสลิปซ้ำของรอบนี้จะถูกล้างเป็น 0 และเบอร์นี้จองได้อีกครั้ง ประวัติเดิมยังเก็บไว้ และรายการที่ถูกยกเลิกจะไม่กลับมา',
            items:[`ส่งสลิปซ้ำรอบนี้ ${row.duplicate_count} ครั้ง → 0`],
            confirmLabel:'ปลดล็อกและเริ่มนับใหม่', cancelLabel:'ยังไม่ปลดล็อก', tone:'warning',
          }}>ปลดล็อกและเริ่มนับใหม่</ConfirmSubmit></ActionForm>}
      </td></tr>)}
      {!rows.length&&<tr><td colSpan={4}>ไม่พบเบอร์ที่ถูกบล็อกตามเงื่อนไข</td></tr>}
    </tbody></table></div>
    <h3>รายการปฏิเสธสลิปซ้ำล่าสุด 50 รายการ</h3>
    <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>รหัสจอง</th><th>เบอร์โทร</th><th>เวลา (UTC)</th></tr></thead><tbody>
      {events.map(row=><tr key={row.booking}><td>{row.booking}</td><td>{row.phone}</td><td>{row.created_at}</td></tr>)}
      {!events.length&&<tr><td colSpan={3}>ยังไม่มีประวัติ</td></tr>}
    </tbody></table></div>
  </section>
}
