import { BookingWindowSettings,ContactsSettings,FacilitiesSettings } from './camp-options-settings'
import Link from '../pending-ui'
import { adminUrl } from './navigation'
import { PricingSettings, PaymentSettings } from './sections'
import { CampCalendar } from './camp-calendar'
import { CheckoutSettings } from './checkout'
import { BookingPolicy } from './booking-policy'
import { PricePriority } from './price-priority'
import { AdminIcon } from './admin-icon'
import { WelcomeSettings } from './welcome-settings'

const groups = [
  ['facilities','ข้อมูลทั่วไปและสิ่งอำนวยความสะดวก','ข้อความจัดรูปแบบ · แนบรูป · พรีวิว'],
  ['contacts','ช่องทางติดต่อและที่ตั้ง','Tel · LINE · Facebook · TikTok · ฯลฯ · แผนที่'],
  ['welcome','คำโปรยหน้าจอง','ข้อความหัวข้อ · ข้อความรอง · เปิด–ปิด'],
  ['rates','ราคาและปฏิทิน','ราคาลาน · วันเปิด–ปิด · ฤดูกาล'],
  ['payment','การรับเงินและค่าไฟ','QR ค่าจอง · บัญชีธนาคาร · Check-out'],
  ['policy','การเลื่อนการจอง','จำนวนครั้ง · จำนวนวันล่วงหน้า'],
]

export function CampSettings({query}) {
  const group = groups.some(([key]) => key === query.group) ? query.group : 'rates'
  return <div className="stack camp-settings">
    <header className="settings-heading"><span className="eyebrow">จัดการแคมป์ในที่เดียว</span>
      <h2>ตั้งค่าแคมป์</h2><p className="muted">เลือกหมวดที่ต้องการแก้ไข แล้วกดบันทึกในส่วนนั้น</p>
    </header>
    <nav className="settings-categories" aria-label="หมวดการตั้งค่า">
      {groups.map(([key,title,description],index) => <Link key={key} href={adminUrl('settings',{group:key})}
        aria-current={group === key ? 'page' : undefined}>
        <span className="settings-category-number"><AdminIcon name={key}/></span>
        <span><strong>{title}</strong><small>{description}</small></span>
      </Link>)}
    </nav>
    {group === 'rates' && <>
      <PricePriority/>
      <div className="notice settings-guide"><strong>เริ่มจากราคาพื้นฐาน แล้วกำหนดวันพิเศษในปฏิทิน</strong>
        <p>วันปิดรับจองจะจองไม่ได้ ส่วนราคาฤดูกาลใช้เฉพาะช่วงวันที่กำหนด ดูราคาที่มีผลจริงได้จากวันที่ในปฏิทิน</p>
        <div className="actions"><a href="#base-rates">ราคาพื้นฐานและเหมาลาน ↓</a><a href="#camp-calendar">ปฏิทินและฤดูกาล ↓</a></div>
      </div>
      <div id="base-rates" className="stack settings-anchor"><PricingSettings/></div>
      <BookingWindowSettings/><section id="camp-calendar" className="stack settings-anchor"><header><h2>ปฏิทินเปิด–ปิดและฤดูกาล</h2>
        <p className="muted">เลือกวันเพื่อดูราคา หรือเพิ่มช่วงปิดรับจอง วันหยุด และราคาฤดูกาล</p></header>
        <CampCalendar query={query}/></section>
    </>}
    {group === 'payment' && <>
      <div className="notice settings-guide"><strong>รับเงิน 2 ขั้นตอน</strong>
        <p>ค่าจองใช้รูป QR หรือเลขบัญชีที่ลูกค้าเห็นตอนจอง ส่วนยอดเพิ่มตอน Check-out ใช้พร้อมเพย์สร้าง QR ตามยอดที่เรียกเก็บ</p>
      </div>
      <div className="settings-payment-grid"><PaymentSettings/><CheckoutSettings/></div>
    </>}
    {group === 'policy' && <BookingPolicy/>}
    {group === 'facilities' && <FacilitiesSettings/>}
    {group === 'contacts' && <ContactsSettings query={query}/>}
    {group === 'welcome' && <WelcomeSettings/>}
  </div>
}
