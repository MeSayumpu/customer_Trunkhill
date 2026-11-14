import { MediaUpload } from './media-upload'

import { AdminIcon } from './admin-icon'
import Link, { ActionForm, UploadForm } from '../pending-ui'
import { database } from '../../lib/db'
import {campZones} from '../../lib/camp-options'
import { adminUrl } from './navigation'
import { removeZoneMedia, saveZoneText } from './zone-media-actions'
import { ZonePhotoUpload } from './zone-photo-upload'
import { getZoneDetails } from '../../lib/zone-details'
import { ConfirmSubmit } from '../confirm-dialog'
import { ZoneFeaturesEditor } from './zone-features-editor'
import { normalizeZoneFeatures } from '../../lib/zone-features'

export async function ZoneMediaSettings({query}) {
  // Trunkbox photos and details are managed per room (ห้องพัก → แก้ไข); its zone entry is not shown to customers.
  const zones=(await campZones()).filter(code => code !== 'BOX')
  const zone = zones.includes(query.zone) ? query.zone : zones[0] ?? 'A'
  const details = await getZoneDetails(zone)
  const [media] = await database().execute('SELECT id,kind FROM zone_media WHERE zone=? ORDER BY id',[zone])
  const video = media.find(item => item.kind === 'video')
  const photos = media.filter(item => item.kind === 'image')
  // Types already used in other zones become one-click suggestions here.
  const [rows] = await database().execute('SELECT zone,features FROM zone_details WHERE zone<>? AND features IS NOT NULL',[zone])
  const others = {}
  for (const row of rows) for (const [group,items] of Object.entries(normalizeZoneFeatures(row.features)))
    for (const item of items) (others[group] ??= []).push([item.icon,item.label,item.note,item.labelEn,item.noteEn])
  const zoneLabel = zone === 'BOX' ? 'Trunkbox' : 'โซน ' + zone
  return <section className="panel stack admin-content">
    <nav className="admin-filter-tabs" aria-label="เลือกโซนสำหรับจัดการสื่อ">
      {zones.map(code => <Link key={code} href={adminUrl('zoneMedia',{zone:code})}
        aria-current={code === zone ? 'page' : undefined}>{code === 'BOX' ? 'Trunkbox' : 'Zone ' + code}</Link>)}
    </nav>
    <p className="muted small">รูปและรายละเอียดของ Trunkbox จัดการได้ที่ <Link href={adminUrl('rooms')}>ห้องพัก</Link> → แก้ไขแต่ละห้อง</p>
    <ActionForm action={saveZoneText} className="admin-edit-form" key={zone}>
      <input type="hidden" name="zone" value={zone}/>
      <label>รายละเอียดโซน<textarea name="description" rows="4" maxLength={2000} defaultValue={details?.description}/></label>
      <label>กฎการเข้าพัก<textarea name="rules" rows="4" maxLength={2000} defaultValue={details?.rules}/></label>
      <label className="zone-caption-field">คำบรรยายภาพบรรยากาศ
        <textarea name="galleryCaption" rows="5" maxLength={3000} defaultValue={details?.gallery_caption}/>
        <small>ใช้ข้อความเดียวสำหรับทั้งโซน วางลิงก์ Facebook หรือ TikTok ในข้อความได้</small>
      </label>
      <div className="admin-edit-footer"><button className="button"><AdminIcon name="save"/>บันทึกรายละเอียด</button></div>
    </ActionForm>
    <ZoneFeaturesEditor key={'features' + zone} zone={zone} zoneLabel={zoneLabel} initial={details?.features ?? {highlights:[],facilities:[]}} others={others}/>
    <div className="zone-admin-uploads">
        <UploadForm key={'video' + zone} action={'/admin/zone-media?zone=' + zone} method="post" encType="multipart/form-data" className="panel stack"
          confirm={video ? {
            title:`แทนที่วิดีโอของ${zone === 'BOX' ? ' Trunkbox' : 'โซน ' + zone}?`,
            message:'วิดีโอเดิมจะถูกลบออกถาวรและแทนที่ด้วยไฟล์ใหม่',
            items:['วิดีโอปัจจุบันของโซนนี้'],
            confirmLabel:'ลบของเดิมและอัปโหลด', cancelLabel:'เก็บวิดีโอเดิม',
          } : undefined}>
          <h2>วิดีโอ</h2>
          <input type="hidden" name="kind" value="video"/>
          <MediaUpload name="media" video required/>
          <button className="button">{video ? 'เปลี่ยนวิดีโอ' : 'เพิ่มวิดีโอ'}</button>
        </UploadForm>
        <ZonePhotoUpload key={zone} zone={zone} remaining={Math.max(0,8 - photos.length)}/>
    </div>
    <div className="zone-admin-media">
      {media.map(item => <article key={item.id} className="panel stack">
        {item.kind === 'video' ? <video controls preload="none" src={'/api/zone-media/' + item.id}/> :
          <img loading="lazy" decoding="async" src={'/api/zone-media/' + item.id} alt="รูปบรรยากาศ"/>}
        <ActionForm action={removeZoneMedia}>
          <input type="hidden" name="zone" value={zone}/><input type="hidden" name="id" value={item.id}/>
          <ConfirmSubmit className="button secondary admin-cancel" confirm={{
            title:`นำ${item.kind === 'video' ? 'วิดีโอ' : 'รูป'}นี้ออกจากโซน ${zone === 'BOX' ? 'Trunkbox' : zone}?`,
            message:'ไฟล์จะถูกลบออกจากระบบถาวร ลูกค้าจะไม่เห็นในหน้ารายละเอียดโซนอีก และกู้คืนไม่ได้',
            items:[(item.kind === 'video' ? 'วิดีโอ' : 'รูปบรรยากาศ') + ' #' + item.id],
            confirmLabel:'ลบไฟล์ถาวร',
          }}>นำ{item.kind === 'video' ? 'วิดีโอ' : 'รูป'}ออก</ConfirmSubmit>
        </ActionForm>
      </article>)}
    </div>
  </section>
}
