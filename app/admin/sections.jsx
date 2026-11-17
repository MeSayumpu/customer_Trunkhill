import {campZones} from '../../lib/camp-options'
import {addZone} from './camp-options-actions'
import {ZoneStatusList} from './zone-status-list'
import {TrunkboxTextSettings} from './trunkbox-text-settings'
import { MediaUpload } from './media-upload'

import { AdminIcon } from './admin-icon'
import Link, { ActionForm, AdminSearchForm } from '../pending-ui'
import { database } from '../../lib/db'
import { adminTranslations } from '../../lib/admin-translations'
import { EnglishField } from './english-field'
import { money } from '../../lib/pricing'
import { wholeCampCode, wholeCampName, wholeCampTiers } from '../../lib/whole-camp'
import { WholeCampRateFields } from './whole-camp-rate-fields'
import { saveInventory, savePaymentConfig, saveSettings, saveSlipCheck, saveWholeCampRates } from './actions'
import { TentDiscountForm } from './tent-discount-form'
import { isTent } from '../../lib/rentals'
import { adminSections, adminUrl, inventoryKinds } from './navigation'
import { AdminDialog } from './admin-dialog'
import { RoomPhotosField } from './room-photos-field'
import { PlotFeaturesField } from './plot-features-field'
import { GearOrderForm } from './gear-order-form'
import { TentDiscountTiersField } from './tent-discount-tiers-field'
import { tentDiscountTiers } from '../../lib/pricing'
import { normalizeZoneFeatures, plotFeatureSelection } from '../../lib/zone-features'

const pageSize = 30
const baseZones = { room:['BOX'], gear:['GEAR'] }
const inventoryCursor = /^[A-Z0-9][A-Z0-9-]{0,23}$/

function searchText(query) {
  return typeof query.q === 'string' ? query.q.trim().slice(0,120) : ''
}

function prefix(value) {
  return value.replace(/[!%_]/g, '!$&') + '%'
}

function cursor(query, pattern) {
  if (typeof query.before === 'string' && pattern.test(query.before)) return { value:query.before, backwards:true }
  if (typeof query.after === 'string' && pattern.test(query.after)) return { value:query.after, backwards:false }
  return { value:'', backwards:false }
}

function pageRows(rows, position) {
  const hasMore = rows.length > pageSize
  const visible = rows.slice(0,pageSize)
  if (position.backwards) visible.reverse()
  return {
    visible,
    previous: position.backwards ? hasMore : !!position.value,
    next: position.backwards ? !!position.value : hasMore,
  }
}

function Pagination({ section, filters, page, rowCursor }) {
  const { visible, previous, next } = page
  if (!previous && !next) return null
  return <nav className="admin-pagination actions" aria-label="แบ่งหน้ารายการ">
    {previous && <Link className="button secondary" href={visible.length
      ? adminUrl(section,{...filters,before:rowCursor(visible[0])}) : adminUrl(section,filters)}>← หน้าก่อนหน้า</Link>}
    {next && visible.length > 0 && <Link className="button secondary" href={adminUrl(section,{...filters,after:rowCursor(visible.at(-1))})}>หน้าถัดไป →</Link>}
  </nav>
}

async function InventoryForm({ row = {}, kind, q, zone, tab, closeUrl, position }) {
  const english = await adminTranslations()
  const zones={...baseZones,plot:(await campZones()).filter(z=>z!=='BOX')}
  const tent = row.code ? isTent({...row,kind}) : kind === 'gear' && tab === 'tents'
  // Room photos in customer order: main photo first, then the extra photos.
  const [gallery] = kind === 'room' && row.code ? await database().execute('SELECT id FROM inventory_gallery WHERE code=? ORDER BY sort,id',[row.code]) : [[]]
  const roomPhotos = [
    ...(row.has_photo > 0 ? [{token:'cover',src:'/admin/inventory-photo/' + encodeURIComponent(row.code) + '?v=' + Date.now()}] : []),
    ...gallery.map(({id}) => ({token:'g:' + id,src:'/api/inventory-gallery/' + id})),
  ]
  const [featureRows] = kind !== 'gear' ? await database().query('SELECT zone,features FROM zone_details') : [[]]
  const zoneFeatures = Object.fromEntries(featureRows.map(item => [item.zone,normalizeZoneFeatures(item.features)]))
  return <ActionForm action={saveInventory} className="admin-edit-form inventory-edit-form">
    <input type="hidden" name="original" value={row.code || ''}/>
    <input type="hidden" name="kind" value={kind}/>
    <input type="hidden" name="q" value={q}/><input type="hidden" name="filterZone" value={zone}/>
    {tab && <input type="hidden" name="tab" value={tab}/>}
    {/* The list page being edited, so saving returns to it instead of the first page. */}
    {position?.value && <input type="hidden" name={position.backwards ? 'before' : 'after'} value={position.value}/>}
    <fieldset className="inventory-edit-group">
      <legend>ข้อมูลรายการ</legend>
      <div className="text-pair"><label>ชื่อ<input name="name" defaultValue={row.name} required maxLength={120}/></label>
        <EnglishField name="nameEn" label="ชื่อ (English)" value={english[row.name]} maxLength={120}/></div>
      <div className="text-pair"><label>รายละเอียด<input name="detail" defaultValue={row.detail} maxLength={240}/></label>
        <EnglishField name="detailEn" label="รายละเอียด (English)" value={english[row.detail]} maxLength={240}/></div>
      <label>รหัส<input name="code" defaultValue={row.code} readOnly={!!row.code} maxLength={24} required /></label>
      <label>{kind === "gear" ? "ประเภท" : "โซน"}{kind === "gear" ? <><input type="hidden" name="zone" value="GEAR"/><select name="rentalType" defaultValue={tent?"tents":"equipment"}><option value="tents">เต็นท์/ทาร์ป</option><option value="equipment">อุปกรณ์</option></select></> : <select name="zone" defaultValue={row.zone || zone || zones[kind][0]}>{zones[kind].map(value => <option key={value}>{value}</option>)}</select>}</label>
    </fieldset>
    <fieldset className="inventory-edit-group">
      <legend>ราคาและการจอง</legend>
      <label>ราคา (บาท/คืน)<input name="price" type="number" min="0" max="100000" defaultValue={row.price ?? 0} required/></label>
      {kind === 'gear' && <label>จำนวน<input name="stock" type="number" min="0" max="1000" defaultValue={row.stock ?? 1} required/></label>}
      <label className="checkbox"><input type="checkbox" name="active" defaultChecked={row.active ?? true}/> เปิดให้จอง</label>
    </fieldset>
    {kind !== 'gear' && <PlotFeaturesField zones={zoneFeatures} room={kind === 'room'}
      zone={kind === 'room' ? 'BOX' : row.zone || zone || zones.plot[0]} originalZone={row.zone}
      selection={plotFeatureSelection(row.plot_features)} mediaUrl={adminUrl('zoneMedia',kind === 'room' ? {zone:'BOX'} : {})}/>}
    {kind === 'room' && <fieldset className="inventory-edit-group room-guests">
      <legend>จำนวนผู้เข้าพักและค่าคนเพิ่ม</legend>
      <p className="small muted">นับเฉพาะผู้ใหญ่และผู้สูงอายุ เด็กเข้าพักฟรีและไม่นับรวม ราคาห้องด้านบนรวมผู้เข้าพักปกติแล้ว</p>
      <label>จำนวนผู้เข้าพักปกติ (คน)<input name="roomBaseGuests" type="number" min="1" max="20" defaultValue={row.room_base_guests ?? 2} required/></label>
      <label>รองรับสูงสุด (คน)<input name="roomMaxGuests" type="number" min="1" max="20" defaultValue={row.room_max_guests ?? 4} required/></label>
      <label>คนที่เกินจากผู้เข้าพักปกติ คิดเพิ่มคนละ (บาท/คืน)<input name="roomExtraGuestPrice" type="number" min="0" max="100000" defaultValue={row.room_extra_guest_price ?? 150} required/></label>
    </fieldset>}
    {tent && <TentDiscountTiersField tiers={tentDiscountTiers(row)} price={row.price ?? 0}/>}
    {kind === 'room' && <fieldset className="inventory-edit-group inventory-edit-photo">
      <legend>รูปภาพห้อง</legend>
      <RoomPhotosField existing={roomPhotos} roomName={row.name || 'ห้องนี้'}/>
    </fieldset>}
    {kind === 'gear' && <fieldset className="inventory-edit-group inventory-edit-photo">
      <legend>รูปภาพ</legend>
      <MediaUpload current={row.has_photo > 0 ? '/admin/inventory-photo/' + row.code : undefined}/>
    </fieldset>}
    <div className="admin-edit-footer">
      <Link href={closeUrl} scroll={false} className="button secondary">ยกเลิก</Link>
      <button className="button">{row.code ? 'บันทึก' : 'เพิ่มรายการ'}</button>
    </div>
  </ActionForm>
}

export async function InventoryList({ section, query }) {
  const zones={...baseZones,plot:(await campZones()).filter(z=>z!=='BOX')}
  const kind = inventoryKinds[section]
  const q = searchText(query)
  const zone = zones[kind].includes(query.zone) ? query.zone : ''
  let tab = ''
  if (kind === 'gear') {
    // Tents/tarps are the first tab, so the page opens on them; an edit link without a tab opens the item's own tab.
    tab = ['equipment','tents'].includes(query.tab) ? query.tab : 'tents'
    if (!['equipment','tents'].includes(query.tab) && typeof query.edit === 'string' && inventoryCursor.test(query.edit)) {
      const [[item]] = await database().execute('SELECT kind,is_tent FROM inventory WHERE code=?',[query.edit])
      if (item) tab = isTent(item) ? 'tents' : 'equipment'
    }
  }
  const position = cursor(query,inventoryCursor)
  const clauses = ['kind = ?', 'code <> ?']
  const values = [kind, wholeCampCode]
  if (tab) {
    clauses.push('is_tent = ?')
    values.push(tab === 'tents')
  }
  if (zone) {
    clauses.push('zone = ?')
    values.push(zone)
  }
  if (q) {
    clauses.push("(code LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!')")
    values.push(prefix(q),prefix(q))
  }
  if (position.value) {
    clauses.push(position.backwards ? 'code < ?' : 'code > ?')
    values.push(position.value)
  }
  const [rows] = await database().execute(
    `SELECT code,zone,name,detail,price,stock,active,is_tent,tent_discount_per_guest,tent_discount_guest_limit,tent_discount_tiers,room_base_guests,room_max_guests,room_extra_guest_price,plot_features,
       EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=inventory.code) AS has_photo
     FROM inventory WHERE ${clauses.join(' AND ')}
     ORDER BY code ${position.backwards ? 'DESC' : 'ASC'} LIMIT ?`,[...values,pageSize+1])
  const page = pageRows(rows,position)
  const filters = {q,zone,tab}
  const current = { ...filters, [position.backwards ? 'before' : 'after']:position.value }
  const closeUrl = adminUrl(section,current)
  const editing = page.visible.find(row => row.code === query.edit)
  const adding = query.add === '1'
  const tableLabel = tab === 'tents' ? 'เต็นท์/ทาร์ป' : adminSections[section]
  const [orderRows] = kind === 'gear' ? await database().execute(
    'SELECT i.code,i.name,i.active,i.price,i.kind,EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=i.code) AS has_photo FROM inventory i WHERE i.kind=? AND i.is_tent=? ORDER BY i.sort_order,i.code',['gear',tab === 'tents']) : [[]]
  const [zoneRows] = kind === 'plot' ? await database().query("SELECT z.zone,z.active,(SELECT COUNT(*) FROM inventory i WHERE i.zone=z.zone) AS total FROM zone_details z WHERE z.zone NOT IN ('BOX','GEAR') ORDER BY z.zone") : [[]]
  return <section className="panel stack admin-content">
    {kind === "plot" && <details className="panel zone-create"><summary>จัดการโซน / เพิ่มโซน / เปิด–ปิดการใช้งาน</summary><p>เพิ่มโซน เช่น E แล้วเลือกโซนนี้ตอนเพิ่มล็อก จากนั้นจัดวางล็อกในหน้าจัดการผังลาน</p><ActionForm action={addZone} className="actions"><label>รหัสโซน<input name="zone" placeholder="E" pattern="[A-Za-z][A-Za-z0-9-]{0,11}" maxLength={12} required/></label><button className="button">เพิ่มโซน</button></ActionForm><ZoneStatusList zones={zoneRows}/></details>}
    {kind === 'room' && <TrunkboxTextSettings/>}
    {tab && <nav className="admin-filter-tabs" aria-label="ประเภทอุปกรณ์ให้เช่า">
      {[['tents','เต็นท์/ทาร์ป'],['equipment','อุปกรณ์']].map(([type,label]) =>
        <Link key={type} href={adminUrl(section,{q,tab:type})} aria-current={tab === type ? 'page' : undefined}>{label}</Link>)}
    </nav>}
    {tab === 'tents' && <TentDiscountSettings/>}
    {kind === 'gear' && orderRows.length > 1 && <GearOrderForm key={tab + orderRows.map(row => row.code).join()} items={orderRows} tab={tab}/>}
    <AdminSearchForm key={adminUrl(section,filters)} className="admin-filters">
      <input type="hidden" name="section" value={section}/>
      {tab && <input type="hidden" name="tab" value={tab}/>}
      <label>ค้นหาจากรหัสหรือชื่อ<input name="q" defaultValue={q} maxLength={120} placeholder="พิมพ์รหัสหรือชื่อขึ้นต้น"/></label>
      {kind === 'plot' && <label>โซน<select name="zone" defaultValue={zone}><option value="">ทุกโซน</option>{zones.plot.map(value => <option key={value}>{value}</option>)}</select></label>}
      <button className="button"><AdminIcon name="search"/>ค้นหา</button>
      {(q || zone) && <Link className="button secondary" href={adminUrl(section,{tab})}>ล้างตัวกรอง</Link>}
    </AdminSearchForm>
    <div className="admin-table-toolbar"><span className="muted small">แสดง {page.visible.length} รายการในหน้านี้</span>
      <Link href={adminUrl(section,{...current,add:'1'})} scroll={false} className="button">+ เพิ่มรายการ</Link>
    </div>
    <div className="admin-table-scroll" tabIndex={0} aria-label={'ตาราง' + tableLabel}><table className="admin-table">
      <thead><tr>{['จัดการ','รหัส','ชื่อรายการ',kind === 'gear' ? 'ประเภท' : 'โซน','ราคา / คืน','จำนวน','สถานะ',...(kind === 'plot' ? [] : ['รูป'])].map(label =>
        <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{page.visible.map(row => <tr key={row.code}>
        <td><Link href={adminUrl(section,{...current,edit:row.code})} scroll={false} className="button secondary">แก้ไข</Link></td>
        <td><code>{row.code}</code></td><td><strong>{row.name}</strong>{row.detail && <><br/><small>{row.detail}</small></>}</td>
        <td>{kind === "gear" ? (isTent(row) ? "เต็นท์/ทาร์ป" : "อุปกรณ์") : row.zone}</td><td className="admin-amount">{money(row.price)}</td><td>{row.stock}</td>
        <td><span className={'admin-status ' + (row.active ? 'confirmed' : 'cancelled')}>{row.active ? 'เปิดจอง' : 'ปิดจอง'}</span></td>
        {kind !== 'plot' && <td>{row.has_photo > 0 ? <img className="admin-thumb" src={'/admin/inventory-photo/' + row.code}
          alt={'รูป ' + row.name} width="48" height="36" loading="lazy"/> : <span className="muted">—</span>}</td>}
      </tr>)}
      {!page.visible.length && <tr><td colSpan={kind === 'plot' ? 7 : 8} className="admin-empty-cell">ไม่พบรายการ</td></tr>}
      </tbody>
    </table></div>
    <Pagination section={section} filters={filters} page={page} rowCursor={row => row.code}/>
    {(adding || editing) && <AdminDialog title={editing ? 'แก้ไข ' + editing.name : 'เพิ่มรายการ' } closeUrl={closeUrl}>
      <InventoryForm row={editing} {...{kind,q,zone,tab,closeUrl,position}}/>
    </AdminDialog>}
  </section>
}

async function TentDiscountSettings() {
  const [models] = await database().query("SELECT code,name FROM inventory WHERE kind='gear' AND is_tent=TRUE ORDER BY name,code")
  return <TentDiscountForm models={models}/>
}

export async function PricingSettings() {
  const [[settings]] = await database().query('SELECT * FROM settings WHERE id=1')
  const tiers = wholeCampTiers(settings.whole_camp_rates)
  return <><section className="panel stack admin-content"><h2>ตั้งราคาลาน</h2><ActionForm action={saveSettings} className="stack">
    <label>วิธีคิดราคา<select name="mode" defaultValue={settings.mode}><option value="person">ตามคน</option><option value="plot">ตามล็อก</option></select></label>
    <details className="admin-calendar-periods" open>
      <summary><strong>ราคาพื้นฐานและราคาวันหยุด</strong></summary>
      <div className="stack">
        <div className="form-grid">
          <label>วันปกติ ผู้ใหญ่ 1 คนต่อล็อก (บาท/คืน)<input name="soloPrice" type="number" min="0" max="100000" defaultValue={settings.solo_person_price} required/></label>
          <label>วันปกติ ผู้ใหญ่ 2 คนขึ้นไปต่อล็อก (บาท/คน/คืน)<input name="price" type="number" min="0" max="100000" defaultValue={settings.person_price} required/></label>
        </div>
        <h3>ราคาวันหยุด</h3>
        <p className="small muted">ใช้กับวันหยุดพิเศษในปฏิทิน และใช้กับเสาร์–อาทิตย์เมื่อไม่มีราคาตามวันสำหรับจำนวนคนนั้น</p>
        <div className="form-grid">
          <label>ผู้ใหญ่ 1 คนต่อล็อก (บาท/คืน)<input name="holidaySoloPrice" type="number" min="0" max="100000" defaultValue={settings.holiday_solo_price ?? ''}/></label>
          <label>ผู้ใหญ่ 2 คนขึ้นไปต่อล็อก (บาท/คน/คืน)<input name="holidayPrice" type="number" min="0" max="100000" defaultValue={settings.holiday_person_price ?? ''}/></label>
          <label>ราคาโหมดตามล็อก (บาท/ล็อก/คืน)<input name="holidayPlotPrice" type="number" min="0" max="100000" defaultValue={settings.holiday_plot_price ?? ''}/></label>
        </div>
      </div>
    </details>
    <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกราคา</button>
      <Link className="button secondary" href={adminUrl('gear',{tab:'tents'})}>ตั้งส่วนลดเต็นท์</Link>
      </div>
  </ActionForm></section>
  <section className="panel stack admin-content" aria-labelledby="whole-camp-rates-title">
    <h2 id="whole-camp-rates-title">ตั้งราคาเหมาลาน</h2>
    <p className="small muted">แต่ละกลุ่มเริ่มต่อจากกลุ่มก่อนหน้า จำนวนคนสูงสุดของกลุ่มสุดท้ายคือจำนวนที่รับจองได้</p>
    <ActionForm action={saveWholeCampRates} className="stack">
      <WholeCampRateFields key={JSON.stringify(tiers)} tiers={tiers}/>
    </ActionForm>
  </section></>
}

export async function PaymentSettings() {
  const [[config]] = await database().query('SELECT recipient,bank_name,bank_account FROM payment_config WHERE id=1')
  const english = await adminTranslations()
  const [[{slip_duplicate_check:slipCheck}]] = await database().query('SELECT slip_duplicate_check FROM settings WHERE id=1')
  return <section className="panel stack admin-content">
    <h2>รับชำระค่าจอง</h2>
    <p>แนบ QR สำหรับรับเงินของแคมป์ และระบุชื่อผู้รับที่ลูกค้าจะเห็นในหน้าชำระเงิน</p>
    {config && <img loading="lazy" decoding="async" src="/api/payment/qr" alt="QR รับเงินปัจจุบัน" width="180" height="180"/>}
    <ActionForm action={savePaymentConfig} className="admin-edit-form">
      <div className="text-pair"><label>ชื่อผู้รับเงิน<input name="recipient" defaultValue={config?.recipient} maxLength={120} required/></label>
        <EnglishField name="recipientEn" label="ชื่อผู้รับเงิน (English)" value={english[config?.recipient]} maxLength={120}/></div>
      <div className="text-pair"><label>ธนาคารสำหรับโอนด้วยเลขบัญชี<input name="bankName" defaultValue={config?.bank_name || ''} maxLength={120} placeholder="เช่น ธนาคารไทยพาณิชย์"/></label>
        <EnglishField name="bankNameEn" label="ธนาคาร (English)" value={english[config?.bank_name]} maxLength={120}/></div>
      <label>เลขบัญชีธนาคาร<input name="bankAccount" defaultValue={config?.bank_account || ''} inputMode="numeric" maxLength={20}/><small>กรอกคู่กับชื่อธนาคาร ใช้บัญชีชื่อผู้รับเดียวกับด้านบน ข้อมูลนี้จะแสดงให้ลูกค้าโอนเมื่อสแกน QR ไม่ได้ (ไม่ใช่เลขพร้อมเพย์)</small></label>
      <label>รูป QR รับเงิน<input name="qr" type="file" accept="image/jpeg,image/png,image/webp" required={!config}/>
        <small>JPG, PNG หรือ WebP</small></label>
      <div className="admin-edit-footer"><button className="button"><AdminIcon name="save"/>บันทึก QR รับเงิน</button></div>
    </ActionForm>
    <h3>ตรวจสลิปซ้ำ</h3>
    <p>เมื่อเปิด ระบบจะยกเลิกการจองที่แนบสลิปซ้ำกับรายการอื่น และระงับเบอร์โทรที่ส่งสลิปซ้ำเกิน 3 ครั้ง ปิดได้ชั่วคราวระหว่างทดสอบระบบ เพื่อใช้สลิปเดิมซ้ำได้</p>
    {!slipCheck && <p className="notice error" role="status">ปิดการตรวจสลิปซ้ำอยู่ ลูกค้าใช้สลิปเดิมจองซ้ำได้ อย่าลืมเปิดกลับก่อนใช้งานจริง</p>}
    <ActionForm action={saveSlipCheck} className="admin-edit-form">
      <label className="checkbox"><input type="checkbox" name="slipDuplicateCheck" defaultChecked={!!slipCheck}/> เปิดการตรวจสลิปซ้ำ</label>
      <div className="admin-edit-footer"><button className="button"><AdminIcon name="save"/>บันทึกการตรวจสลิป</button></div>
    </ActionForm>
  </section>
}

