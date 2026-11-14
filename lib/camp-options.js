import {database} from './db'
import {normalizeContacts,normalizeLocation} from './camp-contacts'
export const facilityCategories=[['rules','กติกา'],['bathroom','ห้องน้ำ'],['wash','จุดล้างจาน'],['waste','จุดทิ้งขยะ'],['common','อาคารส่วนกลาง + Café'],['activities','กิจกรรม'],['food','ร้านอาหาร']]
export async function campOptions(connection=database()) {
  const [rows]=await connection.query('SELECT option_key,value_json FROM camp_options')
  const options=Object.fromEntries(rows.map(r=>[r.option_key,typeof r.value_json==='string'?JSON.parse(r.value_json):r.value_json]))
  return {window:{value:3,unit:'months'},facilities:{},...options,contacts:normalizeContacts(options.contacts),location:normalizeLocation(options.location)}
}
export async function campZones(connection=database(),activeOnly=false) {
  const [rows]=await connection.query("SELECT zone FROM zone_details"+(activeOnly?' WHERE active=1':'')+" ORDER BY zone='BOX',zone")
  return rows.map(r=>r.zone)
}
