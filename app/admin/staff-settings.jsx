import { ActionForm } from '../pending-ui'
import { accounts, managerPasswordChangedAt, managerPasswordMin } from '../../lib/auth'
import { saveManagerPassword } from './actions'
import { AdminIcon } from './admin-icon'
import { adminSections } from './navigation'
import { managerSections } from '../../lib/auth'

const thaiDateTime = value => new Date(String(value).replace(' ','T') + 'Z')
  .toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}) + ' น.'

// The admin sets the manager's password here. The manager has no such page, and the admin's own password is not kept in the app.
export async function StaffSettings() {
  const changedAt = await managerPasswordChangedAt()
  return <section className="panel stack admin-content staff-settings">
    <h2><AdminIcon name="staff"/> Manager</h2>
    <p className="muted">Manager เข้าสู่ระบบที่หน้าเดียวกับผู้ดูแลระบบ ด้วยบัญชี <code>{accounts.manager}</code> และใช้ได้เฉพาะเมนู {managerSections.map(key => adminSections[key]).join(' · ')}</p>
    {changedAt
      ? <p className="small muted">ตั้งรหัสล่าสุดเมื่อ {thaiDateTime(changedAt)}</p>
      : <p className="notice error">ยังไม่มีบัญชี Manager ในฐานข้อมูล ตั้งรหัสด้านล่างเพื่อเริ่มใช้งาน</p>}
    <ActionForm action={saveManagerPassword} className="admin-edit-form">
      <label>รหัสผ่านใหม่ของ Manager
        <input name="password" type="password" autoComplete="new-password" required minLength={managerPasswordMin} maxLength={256}/></label>
      <label>กรอกรหัสผ่านใหม่อีกครั้ง
        <input name="confirm" type="password" autoComplete="new-password" required minLength={managerPasswordMin} maxLength={256}/></label>
      <p className="small muted">อย่างน้อย {managerPasswordMin} ตัวอักษร · เมื่อเปลี่ยนแล้ว Manager ที่เข้าสู่ระบบอยู่จะต้องเข้าใหม่ด้วยรหัสใหม่</p>
      <div className="actions"><button className="button"><AdminIcon name="save"/>เปลี่ยนรหัส Manager</button></div>
    </ActionForm>
    <p className="small muted">ผู้ดูแลระบบใช้บัญชี <code>{accounts.admin}</code> รหัสของบัญชีนี้เปลี่ยนจากหน้าจอนี้ไม่ได้</p>
  </section>
}
