'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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

function FeatureGroup({title,items,setItems,suggestions,zoneLabel}) {
  const confirm = useConfirm()
  const [picker,setPicker] = useState(null)
  const full = items.length >= zoneFeatureLimit
  const used = new Set(items.map(item => item.label.trim()))
  const update = (key,patch) => setItems(items.map(item => item.key === key ? {...item,...patch} : item))
  const move = (index,step) => {
    const next = [...items]
    ;[next[index],next[index + step]] = [next[index + step],next[index]]
    setItems(next)
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
  return <fieldset className="feature-group">
    <legend>{title}<small>{items.length}/{zoneFeatureLimit}</small></legend>
    {items.length ? <ol className="feature-rows" role="list">
      {items.map((item,index) => <li key={item.key} className="feature-row" data-invalid={!item.icon || !item.label.trim() ? true : undefined}>
        <button type="button" className="feature-icon-button" aria-label={item.icon ? 'เปลี่ยนไอคอน' : 'เลือกไอคอน'} aria-haspopup="dialog"
          onClick={() => setPicker(item.key)}>{item.icon ? <FontAwesomeIcon icon={zoneFeatureIcon(item.icon)} aria-hidden="true"/> : <span>เลือก<br/>ไอคอน</span>}</button>
        <div className="feature-row-fields">
          <label>ชื่อรายการ<input value={item.label} maxLength={60} placeholder="เช่น ใกล้ห้องน้ำ" onChange={event => update(item.key,{label:event.target.value})}/></label>
          <label>รายละเอียดสั้น<input value={item.note} maxLength={80} placeholder="ไม่บังคับ เช่น เดิน 1 นาที" onChange={event => update(item.key,{note:event.target.value})}/></label>
          <details className="feature-row-english" open={item.labelEn || item.noteEn ? true : undefined}>
            <summary>ภาษาอังกฤษ (ไม่บังคับ)</summary>
            <label>Name<input value={item.labelEn} maxLength={60} lang="en" placeholder="e.g. Near restrooms" onChange={event => update(item.key,{labelEn:event.target.value})}/></label>
            <label>Detail<input value={item.noteEn} maxLength={80} lang="en" placeholder="e.g. 1-minute walk" onChange={event => update(item.key,{noteEn:event.target.value})}/></label>
          </details>
        </div>
        <div className="feature-row-actions">
          <button type="button" className="rich-tool" aria-label="เลื่อนขึ้น" disabled={!index} onClick={() => move(index,-1)}>↑</button>
          <button type="button" className="rich-tool" aria-label="เลื่อนลง" disabled={index === items.length - 1} onClick={() => move(index,1)}>↓</button>
          <button type="button" className="rich-tool feature-remove" aria-label={'นำ ' + (item.label.trim() || 'รายการนี้') + ' ออก'} onClick={() => remove(item)}><AdminIcon name="trash"/></button>
        </div>
      </li>)}
    </ol> : <p className="feature-empty">ยังไม่มีรายการ ลูกค้าจะไม่เห็นหัวข้อนี้</p>}
    <div className="feature-add">
      <button type="button" className="button secondary" disabled={full} onClick={() => setItems([...items,{...blank(),key:nextKey++}])}><AdminIcon name="add"/>เพิ่มประเภทใหม่</button>
      <div className="feature-presets" aria-label="เพิ่มจากประเภทที่มี">
        {suggestions.filter(([,label]) => !used.has(label)).map(([icon,label,note,labelEn = '',noteEn = '']) => <button key={icon + label} type="button" disabled={full}
          onClick={() => setItems([...items,{...blank(),icon,label,note,labelEn,noteEn,key:nextKey++}])}>
          <FontAwesomeIcon icon={zoneFeatureIcon(icon)} aria-hidden="true"/>{label}<span aria-hidden="true">+</span>
        </button>)}
      </div>
    </div>
    {picker && <IconPicker value={items.find(item => item.key === picker)?.icon} onClose={() => setPicker(null)}
      onPick={icon => update(picker,{icon})}/>}
  </fieldset>
}

export function ZoneFeaturesEditor({zone,zoneLabel,initial,others}) {
  const [groups,setGroups] = useState(() => Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,withKeys(initial[group] ?? [])])))
  const saved = useMemo(() => JSON.stringify(initial),[initial])
  const value = Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,groups[group].map(({key,...item}) => item)]))
  const json = JSON.stringify(value)
  const invalid = Object.values(value).some(items => items.some(item => !item.icon || !item.label.trim()))
  return <ActionForm action={saveZoneFeatures} className="admin-edit-form zone-features-editor">
    <input type="hidden" name="zone" value={zone}/>
    <input type="hidden" name="features" value={json}/>
    <div className="zone-features-head">
      <h2>จุดเด่นและสิ่งอำนวยความสะดวก</h2>
      <p>แสดงข้างรูปในหน้าต่าง “ดูรูปแต่ละโซน” ของลูกค้า กด “เพิ่มประเภทใหม่” เพื่อเลือกไอคอนและตั้งชื่อเอง หรือกดประเภทที่มีอยู่ด้านล่างเพื่อเพิ่มเร็ว</p>
    </div>
    <div className="zone-features-grid">
      {zoneFeatureGroups.map(([group,title]) => {
        const unique = [...new Map([...presets[group],...(others[group] ?? [])].map(entry => [entry[1],entry])).values()]
        return <FeatureGroup key={group} title={title} items={groups[group]} zoneLabel={zoneLabel}
          suggestions={unique} setItems={items => setGroups(current => ({...current,[group]:items}))}/>
      })}
    </div>
    <div className="admin-edit-footer">
      {invalid ? <span className="feature-status feature-invalid" role="alert">ทุกรายการต้องมีไอคอนและชื่อ</span>
        : json !== saved && <span className="feature-status" role="status">มีการแก้ไขที่ยังไม่บันทึก</span>}
      <button className="button" disabled={invalid}><AdminIcon name="save"/>บันทึกจุดเด่น</button>
    </div>
  </ActionForm>
}
