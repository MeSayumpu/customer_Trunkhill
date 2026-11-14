import {readFile} from 'node:fs/promises'
import {assignReference} from '../lib/booking-reference.js'
export async function customerExperienceSchema(db){
  const sql=await readFile(new URL('../db/customer-experience.sql',import.meta.url),'utf8')
  for(const statement of sql.split(';').filter(s=>s.trim()))await db.query(statement)
  for(const [column,definition] of [
    ['welcome_title',"VARCHAR(160) NOT NULL DEFAULT 'เลือกวันพัก แล้วเลือกมุมโปรดของคุณ'"],
    ['welcome_subtitle',"VARCHAR(240) NOT NULL DEFAULT 'วันเข้าพัก · จำนวนคน · ล็อกหรือห้องพัก'"],
    ['welcome_title_enabled','BOOLEAN NOT NULL DEFAULT TRUE'],
    ['welcome_subtitle_enabled','BOOLEAN NOT NULL DEFAULT TRUE'],
  ]){
    const [[exists]]=await db.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='settings' AND column_name=?",[column])
    if(!exists)await db.query(`ALTER TABLE settings ADD COLUMN ${column} ${definition}`)
  }
  const [rows]=await db.query(`SELECT b.id,b.arrival,
    (SELECT l.code FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking=b.id ORDER BY i.kind='gear',l.code LIMIT 1) AS code,
    (SELECT before_state FROM booking_reschedule_history h WHERE h.booking=b.id ORDER BY revision LIMIT 1) AS original
    FROM bookings b LEFT JOIN booking_references r ON r.booking=b.id WHERE r.booking IS NULL ORDER BY b.created_at,b.id`)
  for(const row of rows){
    let original=row.original
    if(typeof original==='string')original=JSON.parse(original)
    const raw=original?.arrival||row.arrival
    const arrival=typeof raw==='string'?raw:[raw.getFullYear(),String(raw.getMonth()+1).padStart(2,'0'),String(raw.getDate()).padStart(2,'0')].join('-')
    const code=original?.lines?.find(l=>l.kind!=='gear')?.code||row.code||'BOOKING'
    await db.beginTransaction()
    try{await assignReference(db,row.id,arrival,code);await db.commit()}catch(error){await db.rollback();throw error}
  }
}
