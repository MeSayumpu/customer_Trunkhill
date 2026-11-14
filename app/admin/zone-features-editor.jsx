'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faChevronUp, faPen } from '@fortawesome/free-solid-svg-icons'
import { ActionForm } from '../pending-ui'
import { useConfirm } from '../confirm-dialog'
import { AdminIcon } from './admin-icon'
import { saveZoneFeatures } from './zone-media-actions'
import { zoneFeatureGroups, zoneFeatureIcon, zoneFeatureIcons, zoneFeatureLimit } from '../../lib/zone-features'

// Ready-made types so a new zone is quick to fill; types used in other zones are added to this list.
const presets = {
  highlights:[
    ['area','พื้นที่ล็อกกว้าง','ประมาณ 6 × 8 ม.','Spacious plots','About 6 × 8 m'],['shade','ร่มไม้ตลอดวัน','','Shade all day',''],
    ['view','วิวภูเขา','','Mountain views',''],['plug','มีปลั๊กไฟทุกล็อก','','Power at every plot',''],
    ['car','รถจอดข้างเต็นท์ได้','','Park next to your tent',''],['quiet','โซนเงียบสงบ','','Quiet zone',''],
    ['kids','เหมาะกับครอบครัว','','Family friendly',''],
  ],
  facilities:[
    ['restroom','ห้องน้ำ','ใกล้โซน','Restrooms','Close by'],['shower','ห้องอาบน้ำ','','Showers',''],['sink','จุดล้างจาน','','Dishwashing',''],
    ['parking','ที่จอดรถ','','Parking',''],['store','ร้านค้า','','Shop',''],['coffee','คาเฟ่ / กาแฟ','','Café',''],
    ['trash','จุดทิ้งขยะ','','Waste point',''],['wifi','Wi-Fi','','Wi-Fi',''],
  ],
}
const blank = () => ({icon:'',label:'',labelEn:'',note:'',noteEn:''})
let nextKey = 1
const withKeys = items => items.map(item => ({...item,key:nextKey++}))

function IconPicker({value,onPick,onClose}) {
  const dialog = useRef(null)
  const [query,setQuery] = useState('')
  const text = query.trim().toLowerCase()
  const matches = zoneFeatureIcons.filter(([key,,name]) => !text || name.toLowerCase().includes(text) || key.toLowerCase().includes(text))
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal() },[])
  return <dialog ref={dialog} className="dialog admin-booking-confirm feature-icon-dialog" aria-labelledby="feature-icon-title" onClose={onClose}>
    <div className="booking-confirm-heading">
      <h2 id="feature-icon-title">เลือกไอคอน</h2>
      <button type="button" className="button secondary" aria-label="ปิดหน้าต่างเลือกไอคอน" onClick={() => dialog.current?.close()}><AdminIcon name="close"/></button>
    </div>
    <input type="search" placeholder="ค้นหา เช่น ห้องน้ำ ปลั๊ก วิว" value={query} onChange={event => setQuery(event.target.value)} aria-label="ค้นหาไอคอน"/>
    <div className="feature-icon-grid" role="listbox" aria-label="ไอคอน">
      {matches.map(([key,icon,name]) => <button key={key} type="button" role="option" aria-selected={value === key} title={name}
        onClick={() => { onPick(key); dialog.current?.close() }}>
        <FontAwesomeIcon icon={icon} aria-hidden="true"/><span>{name}</span>
      </button>)}
      {!matches.length && <p className="feature-empty">ไม่พบไอคอนที่ค้นหา</p>}
    </div>
  </dialog>
}

const incomplete = item => !item.icon || !item.label.trim()

// One compact line per item; only the item being edited opens its fields, so long lists stay readable.
function FeatureRow({item,index,count,open,onToggle,onChange,onMove,onRemove,onPickIcon}) {
  const bad = incomplete(item)
  const english = item.labelEn.trim() || item.noteEn.trim()
  return <li className="feature-row" data-open={open || undefined} data-invalid={bad || undefined}>
    <div className="feature-row-line">
      <button type="button" className="feature-icon-button" aria-label={item.icon ? 'เปลี่ยนไอคอน ' + (item.label || '') : 'เลือกไอคอน'} aria-haspopup="dialog"
        onClick={onPickIcon}>{item.icon ? <FontAwesomeIcon icon={zoneFeatureIcon(item.icon)} aria-hidden="true"/> : <span>ไอคอน</span>}</button>
      <button type="button" className="feature-row-summary" aria-expanded={open} onClick={onToggle}>
        <strong>{item.label.trim() || <em>ยังไม่ตั้งชื่อ</em>}</strong>
        {item.note.trim() && <small>{item.note}</small>}
        <span className="feature-row-tags">
          {english && <span className="feature-tag" title={[item.labelEn,item.noteEn].filter(Boolean).join(' · ')}>EN</span>}
          {bad && <span className="feature-tag feature-tag-bad">ยังไม่ครบ</span>}
        </span>
      </button>
      <div className="feature-row-actions">
        <button type="button" className="feature-tool" aria-label="เลื่อนขึ้น" title="เลื่อนขึ้น" disabled={!index} onClick={() => onMove(-1)}><FontAwesomeIcon icon={faChevronUp}/></button>
        <button type="button" className="feature-tool" aria-label="เลื่อนลง" title="เลื่อนลง" disabled={index === count - 1} onClick={() => onMove(1)}><FontAwesomeIcon icon={faChevronDown}/></button>
        <button type="button" className="feature-tool" aria-label={(open ? 'ปิดการแก้ไข ' : 'แก้ไข ') + (item.label || '')} title={open ? 'เสร็จ' : 'แก้ไข'} aria-expanded={open} onClick={onToggle}>
          <FontAwesomeIcon icon={open ? faCheck : faPen}/></button>
        <button type="button" className="feature-tool feature-remove" aria-label={'นำ ' + (item.label.trim() || 'รายการนี้') + ' ออก'} title="นำออก" onClick={onRemove}><AdminIcon name="trash"/></button>
      </div>
    </div>
    {open && <div className="feature-row-fields">
      <label>ชื่อรายการ (ไทย)<input value={item.label} maxLength={60} placeholder="เช่น ใกล้ห้องน้ำ" autoFocus={!item.label}
        onChange={event => onChange({label:event.target.value})}/></label>
      <label>รายละเอียดสั้น (ไทย)<input value={item.note} maxLength={80} placeholder="ไม่บังคับ เช่น เดิน 1 นาที" onChange={event => onChange({note:event.target.value})}/></label>
      <label>Name (English)<input value={item.labelEn} maxLength={60} lang="en" placeholder="Optional, e.g. Near restrooms" onChange={event => onChange({labelEn:event.target.value})}/></label>
      <label>Detail (English)<input value={item.noteEn} maxLength={80} lang="en" placeholder="Optional, e.g. 1-minute walk" onChange={event => onChange({noteEn:event.target.value})}/></label>
    </div>}
  </li>
}

function FeatureGroup({title,items,setItems,suggestions,zoneLabel}) {
  const confirm = useConfirm()
  const [picker,setPicker] = useState(null)
  const [openKey,setOpenKey] = useState(null)
  const full = items.length >= zoneFeatureLimit
  const used = new Set(items.map(item => item.label.trim()))
  const quick = suggestions.filter(([,label]) => !used.has(label))
  const update = (key,patch) => setItems(items.map(item => item.key === key ? {...item,...patch} : item))
  const move = (index,step) => {
    const next = [...items]
    ;[next[index],next[index + step]] = [next[index + step],next[index]]
    setItems(next)
  }
  function add(item) {
    const key = nextKey++
    setItems([...items,{...blank(),...item,key}])
    if (!item) { setOpenKey(key); setPicker(key) }
  }
  async function remove(item) {
    const name = item.label.trim()
    if ((name || item.icon) && !(await confirm({
      title:'นำ “' + (name || 'รายการที่ยังไม่ตั้งชื่อ') + '” ออกจาก' + title + '?',
      message:'รายการนี้จะหายจากหน้าต่างดูรูปของ' + zoneLabel + ' หลังกดบันทึกจุดเด่น',
      items:[(name || 'รายการที่ยังไม่ตั้งชื่อ') + (item.note.trim() ? ' · ' + item.note.trim() : '')],
      confirmLabel:'นำรายการออก', cancelLabel:'เก็บไว้',
    }))) return
    setItems(items.filter(entry => entry.key !== item.key))
  }
  return <section className="feature-group" aria-label={title}>
    <header className="feature-group-head">
      <h3>{title}</h3><small>{items.length}/{zoneFeatureLimit}</small>
      <button type="button" className="button secondary feature-add-button" disabled={full} onClick={() => add()}><AdminIcon name="add"/>เพิ่มประเภทใหม่</button>
    </header>
    {items.length ? <ol className="feature-rows" role="list">
      {items.map((item,index) => <FeatureRow key={item.key} item={item} index={index} count={items.length}
        open={openKey === item.key} onToggle={() => setOpenKey(current => current === item.key ? null : item.key)}
        onChange={patch => update(item.key,patch)} onMove={step => move(index,step)} onRemove={() => remove(item)}
        onPickIcon={() => setPicker(item.key)}/>)}
    </ol> : <p className="feature-empty">ยังไม่มีรายการ ลูกค้าจะไม่เห็นหัวข้อนี้</p>}
    {quick.length > 0 && <details className="feature-quick">
      <summary>เพิ่มเร็วจากประเภทที่มีอยู่ <small>({quick.length})</small></summary>
      <div className="feature-presets">
        {quick.map(([icon,label,note,labelEn = '',noteEn = '']) => <button key={icon + label} type="button" disabled={full}
          onClick={() => add({icon,label,note,labelEn,noteEn})}>
          <FontAwesomeIcon icon={zoneFeatureIcon(icon)} aria-hidden="true"/>{label}<span aria-hidden="true">+</span>
        </button>)}
      </div>
    </details>}
    {picker && <IconPicker value={items.find(item => item.key === picker)?.icon} onClose={() => setPicker(null)}
      onPick={icon => update(picker,{icon})}/>}
  </section>
}

export function ZoneFeaturesEditor({zone,zoneLabel,initial,others}) {
  const [groups,setGroups] = useState(() => Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,withKeys(initial[group] ?? [])])))
  const saved = useMemo(() => JSON.stringify(initial),[initial])
  const value = Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,groups[group].map(({key,...item}) => item)]))
  const json = JSON.stringify(value)
  const invalid = Object.values(value).some(items => items.some(incomplete))
  return <ActionForm action={saveZoneFeatures} className="admin-edit-form zone-features-editor">
    <input type="hidden" name="zone" value={zone}/>
    <input type="hidden" name="features" value={json}/>
    <div className="zone-features-head">
      <h2>จุดเด่นและสิ่งอำนวยความสะดวก</h2>
      <p>แสดงข้างรูปในหน้าต่าง “ดูรูปแต่ละโซน” ของลูกค้า กดที่รายการหรือ <FontAwesomeIcon icon={faPen}/> เพื่อแก้ไข กดไอคอนเพื่อเปลี่ยนไอคอน ลำดับในรายการคือลำดับที่ลูกค้าเห็น</p>
    </div>
    <div className="zone-features-grid">
      {zoneFeatureGroups.map(([group,title]) => {
        const unique = [...new Map([...presets[group],...(others[group] ?? [])].map(entry => [entry[1],entry])).values()]
        return <FeatureGroup key={group} title={title} items={groups[group]} zoneLabel={zoneLabel}
          suggestions={unique} setItems={items => setGroups(current => ({...current,[group]:items}))}/>
      })}
    </div>
    <div className="admin-edit-footer feature-save-bar">
      {invalid ? <span className="feature-status feature-invalid" role="alert">ทุกรายการต้องมีไอคอนและชื่อ</span>
        : json !== saved && <span className="feature-status" role="status">มีการแก้ไขที่ยังไม่บันทึก</span>}
      <button className="button" disabled={invalid}><AdminIcon name="save"/>บันทึกจุดเด่น</button>
    </div>
  </ActionForm>
}
