import { database } from '../../lib/db'
import { roomGalleryLimit } from '../../lib/room-gallery'
import { ActionForm } from '../pending-ui'
import { ConfirmSubmit } from '../confirm-dialog'
import { PhotoBatchUpload } from './zone-photo-upload'
import { moveRoomPhoto, removeRoomPhoto } from './room-gallery-actions'

// Extra photos for one room, shown after the main photo in the customer's Trunkbox carousel.
export async function RoomGallery({room}) {
  const [photos] = await database().execute('SELECT id FROM inventory_gallery WHERE code=? ORDER BY sort,id',[room.code])
  const remaining = Math.max(0, roomGalleryLimit - photos.length)
  return <section className="room-gallery-admin stack" aria-labelledby="room-gallery-title">
    <div>
      <h3 id="room-gallery-title">รูปเพิ่มเติมของห้อง <small>{photos.length}/{roomGalleryLimit}</small></h3>
      <p className="muted small">ลูกค้าเห็นรูปหลัก (ช่อง “รูปภาพ” ด้านบน) เป็นรูปแรก ตามด้วยรูปเหล่านี้ตามลำดับ ใช้ ← → เพื่อจัดลำดับ</p>
    </div>
    {photos.length ? <ol className="room-gallery-grid" role="list">
      {photos.map(({id},index) => <li key={id}>
        <img src={'/api/inventory-gallery/' + id} alt={'รูปที่ ' + (index + 2) + ' ของ ' + room.name} loading="lazy" decoding="async"/>
        <span className="room-gallery-order">{index + 2}</span>
        <div className="room-gallery-actions">
          <ActionForm action={moveRoomPhoto}>
            <input type="hidden" name="code" value={room.code}/><input type="hidden" name="id" value={id}/><input type="hidden" name="step" value="-1"/>
            <button className="button secondary" disabled={!index} aria-label={'เลื่อนรูปที่ ' + (index + 2) + ' ไปก่อนหน้า'}>←</button>
          </ActionForm>
          <ActionForm action={moveRoomPhoto}>
            <input type="hidden" name="code" value={room.code}/><input type="hidden" name="id" value={id}/><input type="hidden" name="step" value="1"/>
            <button className="button secondary" disabled={index === photos.length - 1} aria-label={'เลื่อนรูปที่ ' + (index + 2) + ' ไปถัดไป'}>→</button>
          </ActionForm>
          <ActionForm action={removeRoomPhoto}>
            <input type="hidden" name="code" value={room.code}/><input type="hidden" name="id" value={id}/>
            <ConfirmSubmit className="button secondary admin-cancel" aria-label={'ลบรูปที่ ' + (index + 2)} confirm={{
              title:'ลบรูปนี้ออกจาก ' + room.name + '?',
              message:'รูปจะถูกลบออกจากระบบถาวร ลูกค้าจะไม่เห็นรูปนี้อีก และกู้คืนไม่ได้',
              items:['รูปที่ ' + (index + 2) + ' ของ ' + room.name],
              confirmLabel:'ลบรูปถาวร',
            }}>ลบ</ConfirmSubmit>
          </ActionForm>
        </div>
      </li>)}
    </ol> : <p className="feature-empty">ยังไม่มีรูปเพิ่มเติม ลูกค้าจะเห็นเฉพาะรูปหลัก</p>}
    <PhotoBatchUpload action={'/admin/inventory-gallery?code=' + encodeURIComponent(room.code)} remaining={remaining} scope="ห้องนี้" title="เพิ่มรูปห้อง"/>
  </section>
}
