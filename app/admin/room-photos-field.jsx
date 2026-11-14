'use client'

import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '../confirm-dialog'
import { roomPhotoLimit } from '../../lib/room-gallery'

const formats = ['image/jpeg','image/png','image/webp']
let nextKey = 1

// One photo field for a room: current photos and newly picked files in a single ordered list.
// Nothing is uploaded or deleted until the room form is saved; photo 1 becomes the main photo.
export function RoomPhotosField({existing = [], roomName = 'ห้องนี้'}) {
  const confirm = useConfirm()
  const upload = useRef(null)
  const [items,setItems] = useState(() => existing.map(photo => ({...photo,key:nextKey++})))
  const [error,setError] = useState('')
  const fresh = items.filter(item => item.file)
  const full = items.length >= roomPhotoLimit

  // The hidden input carries the new files (in list order) so the form uploads them on save.
  useEffect(() => {
    const files = new DataTransfer()
    for (const item of fresh) files.items.add(item.file)
    if (upload.current) upload.current.files = files.files
  },[items])
  const latest = useRef(items)
  latest.current = items
  useEffect(() => () => latest.current.forEach(item => item.file && URL.revokeObjectURL(item.src)),[])

  const order = items.map(item => item.file ? 'n:' + fresh.indexOf(item) : item.token)

  function pick(event) {
    const picked = Array.from(event.currentTarget.files)
    event.currentTarget.value = ''
    if (picked.some(file => !file.size || !(formats.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name))))) {
      setError('ใช้รูป JPG, PNG หรือ WebP')
      return
    }
    if (items.length + picked.length > roomPhotoLimit) {
      setError('เพิ่มได้อีก ' + (roomPhotoLimit - items.length) + ' รูป (สูงสุด ' + roomPhotoLimit + ' รูปต่อห้อง)')
      return
    }
    setError('')
    setItems(current => [...current, ...picked.map(file => ({key:nextKey++,file,src:URL.createObjectURL(file),name:file.name}))])
  }

  function move(index,step) {
    setItems(current => {
      const next = [...current]
      ;[next[index],next[index + step]] = [next[index + step],next[index]]
      return next
    })
  }

  async function remove(item,index) {
    const ok = await confirm(item.file ? {
      title:'เอารูปนี้ออกจากรายการที่จะอัปโหลด?',
      message:'รูปนี้ยังไม่ได้อัปโหลด จะถูกนำออกจากรายการที่เลือกไว้',
      items:[item.name], confirmLabel:'เอาออก', cancelLabel:'เก็บไว้',
    } : {
      title:'นำรูปที่ ' + (index + 1) + ' ออกจาก ' + roomName + '?',
      message:'รูปจะถูกลบออกจากระบบถาวรเมื่อกดบันทึก ลูกค้าจะไม่เห็นรูปนี้อีก และกู้คืนไม่ได้',
      items:['รูปที่ ' + (index + 1) + (index ? '' : ' (รูปหลัก)')], confirmLabel:'นำรูปออก',
    })
    if (!ok) return
    if (item.file) URL.revokeObjectURL(item.src)
    setItems(current => current.filter(entry => entry.key !== item.key))
  }

  return <div className="room-photos-field">
    <input type="hidden" name="photoOrder" value={JSON.stringify(order)}/>
    <input ref={upload} type="file" name="photos" multiple hidden tabIndex={-1} aria-hidden="true"/>
    <p className="muted small">เลือกได้หลายรูปพร้อมกัน สูงสุด {roomPhotoLimit} รูป · <strong>รูปที่ 1 คือรูปหลัก</strong> ที่ลูกค้าเห็นก่อน ใช้ ← → จัดลำดับ ระบบอัปโหลดและบันทึกเมื่อกดปุ่มบันทึกด้านล่าง</p>
    {items.length > 0 && <ol className="room-photo-grid" role="list">
      {items.map((item,index) => <li key={item.key} data-new={item.file ? true : undefined}>
        <img src={item.src} alt={'รูปที่ ' + (index + 1)} loading="lazy" decoding="async"/>
        <span className="room-photo-order">{index + 1}{index === 0 && ' · รูปหลัก'}</span>
        {item.file && <span className="room-photo-new">ใหม่</span>}
        <div className="room-photo-actions">
          <button type="button" className="button secondary" disabled={!index} aria-label={'เลื่อนรูปที่ ' + (index + 1) + ' ไปก่อนหน้า'} onClick={() => move(index,-1)}>←</button>
          <button type="button" className="button secondary" disabled={index === items.length - 1} aria-label={'เลื่อนรูปที่ ' + (index + 1) + ' ไปถัดไป'} onClick={() => move(index,1)}>→</button>
          <button type="button" className="button secondary admin-cancel" aria-label={'นำรูปที่ ' + (index + 1) + ' ออก'} onClick={() => remove(item,index)}>ลบ</button>
        </div>
      </li>)}
    </ol>}
    <label className="media-upload-picker room-photo-picker" data-disabled={full || undefined}>
      <strong>{items.length ? 'เพิ่มรูป' : 'เลือกรูปภาพ'}</strong>
      <span>JPG / PNG / WebP · {full ? 'ครบ ' + roomPhotoLimit + ' รูปแล้ว' : 'เพิ่มได้อีก ' + (roomPhotoLimit - items.length) + ' รูป'}</span>
      <input type="file" accept={formats.join(',')} multiple disabled={full} onChange={pick}/>
    </label>
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>
}
