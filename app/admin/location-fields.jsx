'use client'

import { useState } from 'react'
import { locationLinks, parseCoordinates } from '../../lib/camp-contacts'

// Address + coordinates with a live Google Maps preview of what customers will see.
export function LocationFields({initial,invalid = []}) {
  const [address,setAddress] = useState(initial.address)
  const [coords,setCoords] = useState(initial.coords)
  const [mapUrl,setMapUrl] = useState(initial.mapUrl)
  const point = parseCoordinates(coords)
  const links = locationLinks({address,coords:point ? point.lat + ', ' + point.lng : '',mapUrl})
  const badCoords = coords.trim() && !point
  return <div className="location-editor">
    <div className="location-fields">
      <label>ที่อยู่ / คำอธิบายเส้นทาง<textarea name="address" rows="3" maxLength={300} value={address} onChange={event => setAddress(event.target.value)}
        placeholder="เช่น 99 หมู่ 5 ต.หมูสี อ.ปากช่อง จ.นครราชสีมา 30130"/></label>
      <label data-invalid={badCoords || invalid.includes('coords') || undefined}>พิกัดบนแผนที่
        <input name="coords" value={coords} maxLength={500} onChange={event => setCoords(event.target.value)} placeholder="14.123456, 101.123456"
          aria-invalid={badCoords || invalid.includes('coords') || undefined}/>
        <small>{badCoords ? 'ยังอ่านพิกัดไม่ได้ ใช้รูปแบบ ละติจูด, ลองจิจูด' : point ? `อ่านพิกัดได้: ${point.lat}, ${point.lng}`
          : 'ใน Google Maps คลิกขวาที่ตำแหน่งลาน แล้วกดตัวเลขพิกัดเพื่อคัดลอกมาวาง (หรือวางลิงก์ Google Maps แบบเต็มก็ได้)'}</small>
      </label>
      <label data-invalid={invalid.includes('mapUrl') || undefined}>ลิงก์ Google Maps สำหรับปุ่มเปิดแผนที่ <small>(ไม่บังคับ)</small>
        <input name="mapUrl" type="url" inputMode="url" maxLength={500} value={mapUrl} onChange={event => setMapUrl(event.target.value)}
          placeholder="https://maps.app.goo.gl/…" aria-invalid={invalid.includes('mapUrl') || undefined}/>
        <small>เว้นว่างได้ ระบบจะสร้างลิงก์จากพิกัดให้</small>
      </label>
    </div>
    <div className="location-preview">
      <span className="rich-editor-label">พรีวิวแผนที่ที่ลูกค้าเห็น</span>
      {links ? <iframe title="พรีวิวแผนที่ที่ตั้งแคมป์" src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
        : <p className="feature-empty">กรอกพิกัดหรือที่อยู่เพื่อแสดงแผนที่ ถ้าเว้นว่างทั้งหมด ลูกค้าจะไม่เห็นส่วนที่ตั้ง</p>}
    </div>
  </div>
}
