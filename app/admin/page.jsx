import Link, { ActionForm } from '../pending-ui'
import { isAdmin } from '../../lib/auth'
import { login, logout } from './actions'
import { InventoryList } from './sections'
import { BookingList } from './booking-list'
import { bookingFilters } from './booking-list-data'
import { AdminIcon } from './admin-icon'
import { adminSections, adminMenuGroups, adminUrl, settingsAliases } from './navigation'
import { redirect } from 'next/navigation'
import { CampSettings } from './camp-settings'
import { AdminWorkspace } from './admin-workspace'
import { ZoneMediaSettings } from './zone-media-settings'
import { PlotMapSettings } from './plot-map-settings'
import { CheckoutList } from './checkout'
import { Dashboard } from './dashboard'
import { BlockedPhones } from './blocked-phones'
import {StoragePanel} from './storage-panel'

export const dynamic = 'force-dynamic'

export default async function Admin({ searchParams }) {
  const query = await searchParams
  if (!(await isAdmin())) return <main className="container admin-login">
    <Link href="/">← กลับหน้าจอง</Link>
    <ActionForm action={login} className="panel stack">
      <span className="eyebrow">TRUNKHILL / ADMIN</span><h1>เข้าสู่ระบบผู้ดูแล</h1>
      {query.error && <p className="notice error" role="alert">เข้าสู่ระบบไม่สำเร็จ</p>}
      <label>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
      <button className="button">เข้าสู่ระบบ</button>
    </ActionForm>
  </main>

  if (typeof query.section === 'string' && Object.hasOwn(settingsAliases,query.section)) {
    const {section:legacy,...params} = query
    redirect(adminUrl(legacy,params))
  }
  const section = typeof query.section === 'string' && Object.hasOwn(adminSections,query.section) ? query.section : 'dashboard'
  return <AdminWorkspace title={adminSections[section]} section={section}
    topActions={section==='bookings' ? <a className="button secondary booking-export" href={'/admin/bookings-export?'+new URLSearchParams(bookingFilters(query))}><AdminIcon name="download"/>ส่งออก CSV</a> : null} sidebar={<>
      <div className="admin-brand"><img src="/camp-logo-transparent.webp" alt="" width="48" height="48"/><div>
        <strong>Trunkhill</strong><small>จัดการแคมป์</small></div></div>
      <nav className="admin-menu" aria-label="เมนูผู้ดูแล">
        <Link href={adminUrl('dashboard')} aria-current={section === 'dashboard' ? 'page' : undefined}><AdminIcon name="dashboard"/>{adminSections.dashboard}</Link>
        {adminMenuGroups.map(group => <section className="admin-menu-group" key={group.id} aria-labelledby={'menu-' + group.id}>
          <h2 id={'menu-' + group.id}>{group.label}</h2>
          <div className="admin-menu-links">{group.sections.map(key =>
            <Link key={key} href={adminUrl(key)} aria-current={section === key ? 'page' : undefined}><AdminIcon name={key}/>{adminSections[key]}</Link>)}</div>
        </section>)}
      </nav>
      <div className="admin-sidebar-footer"><Link href="/">← หน้าจอง</Link>
        <ActionForm action={logout}><button className="text-button">ออกจากระบบ</button></ActionForm></div>
    </>}>
      <div className="stack admin-content admin-main-content">
        {section!=='storage'&&<StoragePanel compact/>}
        {query.saved && <p className="notice" role="status">บันทึกแล้ว</p>}
        {query.error && <p className="notice error" role="alert">{query.error === 'storage' ? 'บันทึกไฟล์ไม่ได้ พื้นที่จัดเก็บไม่เพียงพอหรือไฟล์อัปโหลดหมดอายุ กรุณาตรวจพื้นที่จัดเก็บแล้วเลือกไฟล์ใหม่' : query.error === 'zoneMedia'
          ? 'ตรวจสอบประเภทไฟล์ รองรับรูป JPG, PNG, WebP และวิดีโอ MP4, WebM'
          : query.error === 'zoneFeatures' ? 'ตรวจจุดเด่นและสิ่งอำนวยความสะดวก: ทุกรายการต้องมีไอคอนและชื่อ ไม่เกิน 12 รายการต่อกลุ่ม'
          : query.error === 'roomPhotoLimit' ? 'รูปห้องได้สูงสุด 12 รูป กรุณาเลือกไฟล์ให้น้อยลงหรือนำรูปเดิมออก'
          : query.error === 'zoneLimit' ? 'จำนวนรูปเกิน 8 รูปต่อโซน กรุณาเลือกไฟล์ให้น้อยลงหรือนำรูปเดิมออก'
          : query.error === 'photo'
          ? 'ใช้รูป JPG, PNG หรือ WebP'
          : query.error === 'stock' ? 'จำนวนใหม่ต่ำกว่ายอดจองที่ยังใช้งานอยู่'
          : query.error === 'seasonOverlap' ? 'ช่วงราคาฤดูกาลซ้อนกับช่วงที่มีอยู่ กรุณาปรับวันที่'
          : query.error === 'contacts' ? 'บันทึกช่องทางติดต่อไม่สำเร็จ'
          : query.error === 'location' ? 'บันทึกที่ตั้งไม่สำเร็จ ตรวจพิกัด (เช่น 14.123456, 101.123456) และลิงก์แผนที่ต้องขึ้นต้นด้วย https://'
          : query.error === 'wholeCampRates' ? 'กรอกจำนวนคนสูงสุดให้เพิ่มขึ้นทุกกลุ่ม และระบุราคากับหน่วยไฟฟรีเป็นจำนวนเต็ม'
          : 'ตรวจสอบข้อมูลที่ระบุอีกครั้ง'}</p>}
        {section === 'storage' ? <StoragePanel/> : section === 'dashboard' ? <Dashboard query={query}/> :
          section === 'bookings' ? <BookingList query={query}/> :
          section === 'blockedPhones' ? <BlockedPhones query={query}/> :
          section === 'settings' ? <CampSettings query={query}/> :
          section === 'checkout' ? <CheckoutList query={query}/> :
          section === 'zoneMedia' ? <ZoneMediaSettings query={query}/> :
          section === 'plotMap' ? <PlotMapSettings query={query}/> : <InventoryList section={section} query={query}/>}
      </div>
  </AdminWorkspace>
}
