'use client'

import { useRef, useState } from 'react'
import { RichText } from '../rich-text'
import { prepareUploads } from '../upload-files'
import { useConfirm } from '../confirm-dialog'
import { AdminIcon } from './admin-icon'
import { addFacilityImage, removeFacilityImage } from './camp-options-actions'

// Toolbar actions: [label, title, kind, before, after/placeholder]
const tools = [
  ['B','ตัวหนา','wrap','**','**'],
  ['I','ตัวเอียง','wrap','*','*'],
  ['U','ขีดเส้นใต้','wrap','__','__'],
  ['S','ขีดฆ่า','wrap','~~','~~'],
  ['ไฮไลต์','ไฮไลต์ข้อความ','wrap','==','=='],
  ['H1','หัวข้อ','line','# '],
  ['H2','หัวข้อรอง','line','## '],
  ['• รายการ','รายการแบบจุด','line','- '],
  ['1. ลำดับ','รายการแบบตัวเลข','line','1. '],
  ['หมายเหตุ','กล่องหมายเหตุ','line','> '],
  ['เส้นคั่น','เส้นคั่น','block','---'],
]

export function RichTextEditor({name, label, defaultValue = '', category, images: initialImages = [], maxLength = 10000}) {
  const confirm = useConfirm()
  const area = useRef(null)
  const fileInput = useRef(null)
  const [value,setValue] = useState(defaultValue)
  const [images,setImages] = useState(initialImages)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')

  function edit(next, selectionStart, selectionEnd = selectionStart) {
    setValue(next)
    requestAnimationFrame(() => {
      const element = area.current
      if (!element) return
      element.focus()
      element.setSelectionRange(selectionStart, selectionEnd)
    })
  }

  function apply([, , kind, before, after]) {
    const element = area.current
    const start = element.selectionStart, end = element.selectionEnd
    if (kind === 'wrap') {
      const selected = value.slice(start, end) || 'ข้อความ'
      edit(value.slice(0, start) + before + selected + after + value.slice(end), start + before.length, start + before.length + selected.length)
    } else if (kind === 'line') {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEnd = value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end)
      const lines = value.slice(lineStart, lineEnd).split('\n').map(line => line.startsWith(before) ? line.slice(before.length) : before + line)
      const block = lines.join('\n')
      edit(value.slice(0, lineStart) + block + value.slice(lineEnd), lineStart, lineStart + block.length)
    } else {
      insertBlock(before)
    }
  }

  function insertBlock(text) {
    const element = area.current
    const start = element ? element.selectionStart : value.length
    const prefix = start && value[start - 1] !== '\n' ? '\n' : ''
    const insert = prefix + text + '\n'
    edit(value.slice(0, start) + insert + value.slice(start), start + insert.length)
  }

  function addLink() {
    const element = area.current
    const start = element.selectionStart, end = element.selectionEnd
    const href = window.prompt('ใส่ลิงก์ (https://… หรือ tel:…)', 'https://')
    if (!href) return
    const text = value.slice(start, end) || 'ข้อความลิงก์'
    const insert = `[${text}](${href.trim()})`
    edit(value.slice(0, start) + insert + value.slice(end), start + 1, start + 1 + text.length)
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('ใช้รูป JPG, PNG หรือ WebP'); return }
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('category', category)
      form.append('media', file)
      await prepareUploads(form)
      const result = await addFacilityImage(form)
      if (result?.error) throw new Error(result.error)
      setImages(previous => [...previous, {id:result.id}])
      insertBlock(`![${file.name.replace(/\.[^.]+$/, '').replace(/[\[\]()]/g, ' ')}](facility:${result.id})`)
    } catch (uploadError) {
      setError(uploadError.message || 'อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(id) {
    const used = value.includes(`(facility:${id})`)
    const accepted = await confirm({
      title:'ลบรูปนี้ถาวร?',
      message:used ? 'รูปจะถูกลบออกจากระบบและออกจากข้อความในหมวดนี้ อย่าลืมกดบันทึกข้อมูลทั่วไปหลังลบ' : 'รูปจะถูกลบออกจากระบบและกู้คืนไม่ได้',
      items:['รูปที่แนบ #' + id],
      confirmLabel:'ลบรูป',
    })
    if (!accepted) return
    setBusy(true); setError('')
    try {
      const result = await removeFacilityImage(id)
      if (result?.error) throw new Error(result.error)
      setImages(previous => previous.filter(image => image.id !== id))
      setValue(previous => previous.split('\n').filter(line => !line.includes(`(facility:${id})`)).join('\n'))
    } catch (removeError) {
      setError(removeError.message || 'ลบรูปไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return <div className="rich-editor">
    <div className="rich-editor-write">
      <label className="rich-editor-label" htmlFor={'rich-' + name}>{label}</label>
      <div className="rich-editor-toolbar" role="toolbar" aria-label={'จัดรูปแบบ ' + label}>
        {tools.map(tool => <button key={tool[0]} type="button" title={tool[1]} aria-label={tool[1]} onClick={() => apply(tool)}
          className={'rich-tool rich-tool-' + tool[0].toLowerCase()}>{tool[0]}</button>)}
        <button type="button" className="rich-tool" title="ใส่ลิงก์" onClick={addLink}>ลิงก์</button>
        <button type="button" className="rich-tool rich-tool-image" title="แนบรูป" disabled={busy} onClick={() => fileInput.current.click()}>
          <AdminIcon name="zoneMedia"/>{busy ? 'กำลังอัปโหลด…' : 'แนบรูป'}
        </button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload}/>
      </div>
      <textarea id={'rich-' + name} ref={area} name={name} rows="12" maxLength={maxLength} value={value} onChange={event => setValue(event.target.value)}/>
      <small className="rich-editor-count">{value.length.toLocaleString('th-TH')} / {maxLength.toLocaleString('th-TH')} ตัวอักษร</small>
      {error && <p className="notice error" role="alert">{error}</p>}
      {images.length > 0 && <div className="rich-editor-images" aria-label="รูปที่แนบในหมวดนี้">
        {images.map(image => <figure key={image.id}>
          <img src={'/api/facility-media/' + image.id} alt="" loading="lazy"/>
          <figcaption>
            <button type="button" className="text-button" onClick={() => insertBlock(`![รูป](facility:${image.id})`)}>แทรก</button>
            <button type="button" className="text-button rich-remove" disabled={busy} onClick={() => removeImage(image.id)}>ลบ</button>
          </figcaption>
        </figure>)}
      </div>}
    </div>
    <div className="rich-editor-preview" aria-live="polite">
      <span className="rich-editor-label">พรีวิว (ลูกค้าจะเห็นแบบนี้)</span>
      <div className="rich-editor-preview-body">
        <RichText source={value} empty={<p className="muted">ยังไม่มีข้อความ ลูกค้าจะเห็นข้อความให้ติดต่อแคมป์</p>}/>
      </div>
    </div>
  </div>
}

// english: {category: the English page}. Each category has a Thai and an English editor; both stay in the form (one
// hidden), so switching language or category never loses what was typed and one save sends everything.
export function FacilitiesEditor({categories, facilities, english = {}, images}) {
  const [active,setActive] = useState(categories[0][0])
  const [language,setLanguage] = useState('th')
  return <div className="stack">
    <div className="rich-editor-tabs" role="tablist" aria-label="หมวดข้อมูลทั่วไป">
      {categories.map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={active === key}
        data-filled={facilities[key] ? true : undefined} onClick={() => setActive(key)}>{label}</button>)}
    </div>
    <div className="rich-editor-language" role="group" aria-label="ภาษาของข้อความ">
      <button type="button" aria-pressed={language === 'th'} onClick={() => setLanguage('th')}>ภาษาไทย</button>
      <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
      <small>{language === 'en' ? 'ข้อความที่ลูกค้าเห็นเมื่อเลือกภาษาอังกฤษ · เว้นว่างได้ ระบบจะแสดงข้อความไทย' : 'ข้อความหลัก · สลับไป English เพื่อใส่คำแปลของหมวดนี้'}</small>
    </div>
    {categories.map(([key,label]) => {
      const categoryImages = images.filter(image => image.category === key)
      return <div key={key} hidden={active !== key}>
        <div hidden={language !== 'th'}><RichTextEditor name={key} label={label} category={key} defaultValue={facilities[key] || ''} images={categoryImages}/></div>
        <div hidden={language !== 'en'} lang="en"><RichTextEditor name={key + 'En'} label={label + ' (English)'} category={key} defaultValue={english[key] || ''} images={categoryImages}/></div>
      </div>
    })}
  </div>
}
