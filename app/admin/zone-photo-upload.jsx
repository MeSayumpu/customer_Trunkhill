'use client'

import { useEffect, useState } from 'react'
import { UploadForm } from '../pending-ui'
import { useConfirm } from '../confirm-dialog'

const formats = ['image/jpeg','image/png','image/webp']
const fileKey = file => JSON.stringify([file.name,file.size,file.lastModified])

function PhotoPreview({file,onRemove}) {
  const [url,setUrl] = useState('')
  useEffect(() => {
    const preview = URL.createObjectURL(file)
    setUrl(preview)
    return () => URL.revokeObjectURL(preview)
  },[file])

  return <li className="zone-photo-preview">
    {url && <img loading="lazy" decoding="async" src={url} alt={'ตัวอย่าง ' + file.name}/>}
    <div><small title={file.name}>{file.name}</small>
      <button type="button" className="button secondary" aria-label={'เอา ' + file.name + ' ออก'} onClick={onRemove}>เอาออก</button>
    </div>
  </li>
}

export function ZonePhotoUpload({zone,remaining}) {
  return <PhotoBatchUpload action={'/admin/zone-media?zone=' + zone} remaining={remaining} scope="โซนนี้" kind/>
}

// Multi-photo picker with previews; used for zone photos and room galleries.
export function PhotoBatchUpload({action,remaining,scope,title = 'รูปภาพ',kind = false}) {
  const confirm = useConfirm()
  const [files,setFiles] = useState([])
  const [error,setError] = useState('')

  function selectPhotos(event) {
    const picked = Array.from(event.currentTarget.files)
    event.currentTarget.value = ''
    const merged = new Map(files.map(file => [fileKey(file),file]))
    for (const file of picked) merged.set(fileKey(file),file)
    if (picked.some(file => !file.size ||
      !(formats.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name))))) {
      setError('ใช้รูป JPG, PNG หรือ WebP')
      return
    }
    if (merged.size > remaining) {
      setError('เลือกได้อีก ' + (remaining - files.length) + ' รูป กรุณาเลือกชุดใหม่หรือนำรูปที่เลือกไว้ออกก่อน')
      return
    }
    setFiles([...merged.values()])
    setError('')
  }

  function submit(event) {
    if (!files.length || files.length > remaining) {
      event.preventDefault()
      return
    }
    const upload = new DataTransfer()
    for (const file of files) upload.items.add(file)
    event.currentTarget.elements.media.files = upload.files
  }

  return <UploadForm action={action} method="post" encType="multipart/form-data"
    className="panel stack photo-batch-upload" onSubmit={submit}>
    <h2>{title}</h2>
    {kind && <input type="hidden" name="kind" value="image"/>}
    <label>{files.length ? 'เลือกรูปเพิ่ม' : 'เลือกรูปได้หลายไฟล์'}
      <input name="media" type="file" accept={formats.join(',')} multiple disabled={!remaining} onChange={selectPhotos}/>
      <small>JPG, PNG หรือ WebP · {scope}เพิ่มได้อีก {remaining} รูป</small>
    </label>
    {error && <p className="notice error" role="alert">{error}</p>}
    {files.length > 0 && <div className="stack">
      <strong aria-live="polite">ภาพตัวอย่างก่อนอัปโหลด ({files.length} รูป)</strong>
      <ul className="zone-photo-previews">
        {files.map(file => <PhotoPreview key={fileKey(file)} file={file} onRemove={async () => {
          if (!(await confirm({title:'เอารูปนี้ออกจากรายการอัปโหลด?',message:'รูปนี้ยังไม่ได้อัปโหลด จะถูกนำออกจากรายการที่เลือกไว้',items:[file.name],confirmLabel:'เอาออก',cancelLabel:'เก็บไว้'}))) return
          setFiles(previous => previous.filter(item => item !== file))
          setError('')
        }}/>)}
      </ul>
    </div>}
    <button className="button" disabled={!files.length || files.length > remaining}>
      {files.length ? 'เพิ่มรูปภาพ ' + files.length + ' รูป' : 'เพิ่มรูปภาพ'}
    </button>
  </UploadForm>
}
