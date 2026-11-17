import {database} from './db'
import {normalizeContacts,normalizeLocation} from './camp-contacts'
import {normalizeGuestRate,normalizeGuestTypes} from './guest-types'
export const facilityCategories=[['rules','กติกา'],['bathroom','ห้องน้ำ'],['wash','จุดล้างจาน'],['waste','จุดทิ้งขยะ'],['cart','รถขนของ'],['common','อาคารส่วนกลาง + Café'],['activities','กิจกรรม'],['food','ร้านอาหาร'],['firstAid','สถานพยาบาล']]
export async function campOptions(connection=database()) {
  const [rows]=await connection.query('SELECT option_key,value_json FROM camp_options')
  // translations (lib/admin-translations.js) is read on its own and is not part of the options sent to pages.
  const {translations,...options}=Object.fromEntries(rows.map(r=>[r.option_key,typeof r.value_json==='string'?JSON.parse(r.value_json):r.value_json]))
  return {window:{value:3,unit:'months'},facilities:{},...options,contacts:normalizeContacts(options.contacts),location:normalizeLocation(options.location),guestTypes:normalizeGuestTypes(options.guestTypes),guestRate:normalizeGuestRate(options.guestRate)}
}
export async function campZones(connection=database(),activeOnly=false) {
  const [rows]=await connection.query("SELECT zone FROM zone_details"+(activeOnly?' WHERE active=1':'')+" ORDER BY zone='BOX',zone")
  return rows.map(r=>r.zone)
}
// Photo or video behind the green band at the top of customer pages; stored in facility_media under this category.
export const heroCategory='hero'
export async function heroMedia(connection=database()) {
  const [[row]]=await connection.query("SELECT value_json FROM camp_options WHERE option_key='hero'")
  const value=row&&(typeof row.value_json==='string'?JSON.parse(row.value_json):row.value_json)
  return Number.isInteger(value?.id)&&['image','video'].includes(value.kind)?{id:value.id,kind:value.kind}:null
}
