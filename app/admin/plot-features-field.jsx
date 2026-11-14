'use client'

import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from '../pending-ui'
import { zoneFeatureGroups, zoneFeatureIcon } from '../../lib/zone-features'

// Checkboxes for which of the zone's highlights and facilities this plot (or Trunkbox room) has.
// The list follows the zone picked in the same form; a plot that has never been customised starts with everything ticked.
export function PlotFeaturesField({zones, zone:initialZone, originalZone, selection, mediaUrl, room = false}) {
  const root = useRef(null)
  const [zone,setZone] = useState(initialZone)
  useEffect(() => {
    const select = root.current?.closest('form')?.querySelector('select[name=zone]')
    if (!select) return
    const update = () => setZone(select.value)
    update()
    select.addEventListener('change',update)
    return () => select.removeEventListener('change',update)
  },[])
  const place = room ? ' Trunkbox ' : 'โซน ' + zone + ' '
  const thing = room ? 'ห้อง' : 'ล็อก'
  const features = zones[zone]
  const saved = zone === originalZone ? selection : null
  const total = features ? zoneFeatureGroups.reduce((sum,[group]) => sum + features[group].length,0) : 0
  return <fieldset ref={root} className="inventory-edit-group plot-features-field" key={zone}>
    <legend>จุดเด่นและสิ่งอำนวยความสะดวกของ{room ? 'ห้อง' : 'ล็อก'}นี้</legend>
    <input type="hidden" name="plotFeaturesForm" value="1"/>
    {total === 0 ? <p className="small muted">{place} ยังไม่มีรายการ เพิ่มได้ที่ <Link href={mediaUrl}>รายละเอียดโซน</Link> แล้วกลับมาเลือกให้{thing}นี้</p> : <>
      <p className="small muted">ติ๊กรายการของ{place}ที่{thing}นี้มี ลูกค้าจะเห็นเฉพาะรายการที่ติ๊ก</p>
      {zoneFeatureGroups.map(([group,title]) => features[group].length > 0 && <div key={group} className="plot-features-group">
        <strong>{room ? title.replace('ของโซน','ของ Trunkbox') : title}</strong>
        <ul role="list">
          {features[group].map(item => <li key={item.label}><label className="checkbox">
            <input type="checkbox" name="plotFeature" value={group + ':' + item.label}
              defaultChecked={!saved || saved[group].includes(item.label)}/>
            <FontAwesomeIcon icon={zoneFeatureIcon(item.icon)} fixedWidth/>
            <span>{item.label}{item.note && <small> · {item.note}</small>}</span>
          </label></li>)}
        </ul>
      </div>)}
    </>}
  </fieldset>
}
