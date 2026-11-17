'use server'
import {redirect} from 'next/navigation'
import {isAdmin} from '../../lib/auth'
import {database,transaction} from '../../lib/db'
import {saveAdminTranslations} from '../../lib/admin-translations'
import {campOptions} from '../../lib/camp-options'
import {revalidatePath} from 'next/cache'
import {facilityCategories,heroCategory} from '../../lib/camp-options'
import {guestRateLineMax,guestRateLinesMax,guestTypeKeys,guestTypeTextMax,normalizeGuestRate} from '../../lib/guest-types'
import {contactChannels,parseCoordinates,validContact,validLink} from '../../lib/camp-contacts'
import {trunkboxTextMax} from '../../lib/trunkbox-text'
import {claimUpload,ensureStorage,lockStorage,storageId,StorageError} from '../../lib/storage'
async function guard(){if(!await isAdmin())redirect('/admin')}
async function save(key,value){await database().execute('INSERT INTO camp_options(option_key,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)',[key,JSON.stringify(value)])}
const facilityKeys=facilityCategories.map(([key])=>key)
const maxFacilityText=10000
const maxFacilityImages=20
export async function saveBookingWindow(data){
  await guard();const value=Number(data.get('value')),unit=data.get('unit')
  if(!Number.isInteger(value)||value<1||!['days','months'].includes(unit)||value>(unit==='months'?36:1095))redirect('/admin?section=settings&group=rates&error=invalid')
  await save('window',{value,unit});redirect('/admin?section=settings&group=rates&saved=settings')
}
// Texts under each guest type in the customer's guest picker (age line, and the note for the red * after "ฟรี").
export async function saveGuestTypes(data){
  await guard()
  const field=name=>String(data.get(name)||'').trim()
  const values=Object.fromEntries(guestTypeKeys.map(key=>[key,{detail:field(key+'Detail'),detailEn:field(key+'DetailEn'),note:field(key+'Note'),noteEn:field(key+'NoteEn')}]))
  if(Object.values(values).some(row=>Object.values(row).some(text=>text.length>guestTypeTextMax)))redirect('/admin?section=settings&group=rates&error=invalid')
  await save('guestTypes',values);revalidatePath('/');redirect('/admin?section=settings&group=rates&saved=settings')
}
// Admin's own lines for the "อัตราค่าเข้าพัก" box of the guest picker, and whether the system's rate text stays.
export async function saveGuestRate(data){
  await guard()
  let lines
  try{lines=JSON.parse(String(data.get('lines')||'[]'))}catch{lines=null}
  if(!Array.isArray(lines)||lines.length>guestRateLinesMax||lines.some(row=>typeof row?.th!=='string'||typeof row?.en!=='string'||!row.th.trim()||row.th.length>guestRateLineMax||row.en.length>guestRateLineMax))redirect('/admin?section=settings&group=rates&error=invalid')
  await save('guestRate',normalizeGuestRate({auto:data.get('auto')==='on',lines}));revalidatePath('/');redirect('/admin?section=settings&group=rates&saved=settings')
}
// Description under the reschedule terms on the customer's booking lookup page; blank Thai text = the built-in wording.
export async function saveRescheduleNote(data){
  await guard()
  const th=String(data.get('th')||'').trim(),en=String(data.get('en')||'').trim()
  if(th.length>600||en.length>600)redirect('/admin?section=settings&group=policy&error=invalid')
  await save('rescheduleNote',{th,en});redirect('/admin?section=settings&group=policy&saved=settings')
}
// Texts of the Trunkbox tab on the booking page; blank = the built-in wording.
export async function saveTrunkboxText(data){
  await guard()
  const values=Object.fromEntries(['intro','introEn','price','priceEn'].map(key=>[key,String(data.get(key)||'').trim()]))
  if(Object.values(values).some(text=>text.length>trunkboxTextMax))redirect('/admin?section=rooms&error=invalid')
  await save('trunkboxText',values);revalidatePath('/');redirect('/admin?section=rooms&saved=settings')
}
export async function saveFacilities(data){
  await guard();const values=Object.fromEntries(facilityKeys.map(key=>[key,String(data.get(key)||'').trim()]))
  if(Object.values(values).some(v=>v.length>maxFacilityText))redirect('/admin?section=settings&group=facilities&error=invalid')
  // Each category's English page is kept against its Thai text; the entry of the text it replaces is dropped.
  const {facilities:before}=await campOptions()
  await save('facilities',values)
  await saveAdminTranslations(facilityKeys.map(key=>[values[key],String(data.get(key+'En')||'').slice(0,maxFacilityText),before[key]||'']))
  revalidatePath('/');redirect('/admin?section=settings&group=facilities&saved=settings')
}
// Uploads one image (already sent in chunks by prepareUploads) for a facilities category; returns its id for the editor.
export async function addFacilityImage(data){
  await guard()
  const category=String(data.get('category')||'')
  if(!facilityKeys.includes(category))return {error:'หมวดไม่ถูกต้อง'}
  try{
    return await transaction(async db=>{
      await lockStorage(db)
      const [[{count}]]=await db.execute('SELECT COUNT(*) AS count FROM facility_media WHERE category=?',[category])
      if(Number(count)>=maxFacilityImages)return {error:`แนบรูปได้สูงสุด ${maxFacilityImages} รูปต่อหมวด กรุณาลบรูปที่ไม่ใช้ก่อน`}
      const file=await claimUpload(db,data.get('media'),'admin','image')
      const [result]=await db.execute('INSERT INTO facility_media(category,mime,content) VALUES (?,?,?)',[category,file.mime,file.content])
      await ensureStorage(db)
      return {id:Number(result.insertId)}
    })
  }catch(error){
    if(error instanceof StorageError)return {error:error.message}
    throw error
  }
}
export async function removeFacilityImage(id){
  await guard()
  if(!Number.isInteger(id)||id<1)return {error:'ไม่พบรูปนี้'}
  await database().execute('DELETE FROM facility_media WHERE id=?',[id])
  return {ok:true}
}
export async function saveContacts(data){
  await guard()
  const values=Object.fromEntries(contactChannels.map(({key})=>[key,String(data.get(key)||'').trim()]))
  const invalid=contactChannels.filter(({key})=>!validContact(key,values[key]))
  if(invalid.length)redirect('/admin?'+new URLSearchParams({section:'settings',group:'contacts',error:'contacts',fields:invalid.map(c=>c.key).join(',')}))
  await save('contacts',values);revalidatePath('/');redirect('/admin?section=settings&group=contacts&saved=settings')
}
export async function saveLocation(data){
  await guard()
  const address=String(data.get('address')||'').trim().slice(0,300)
  const raw=String(data.get('coords')||'').trim(),mapUrl=String(data.get('mapUrl')||'').trim()
  const point=raw?parseCoordinates(raw):null
  const invalid=[...(raw&&!point?['coords']:[]),...(mapUrl.length>500||!validLink(mapUrl)?['mapUrl']:[])]
  if(invalid.length)redirect('/admin?'+new URLSearchParams({section:'settings',group:'contacts',error:'location',fields:invalid.join(',')}))
  await save('location',{address,coords:point?point.lat+', '+point.lng:'',mapUrl})
  await saveAdminTranslations([[address,String(data.get('addressEn')||'').slice(0,300)]]);revalidatePath('/');redirect('/admin?section=settings&group=contacts&saved=settings')
}
export async function addZone(data){
  await guard();const zone=String(data.get('zone')||'').trim().toUpperCase()
  if(!/^[A-Z][A-Z0-9-]{0,11}$/.test(zone)||['BOX','GEAR'].includes(zone))redirect('/admin?section=plots&error=invalid')
  await database().execute("INSERT IGNORE INTO zone_details(zone,description,rules) VALUES (?,'','')",[zone])
  redirect('/admin?section=plots&zone='+encodeURIComponent(zone)+'&saved=inventory')
}
export async function setZoneActive(zone,active){
  await guard()
  if(typeof zone!=='string'||!/^[A-Z][A-Z0-9-]{0,11}$/.test(zone)||['BOX','GEAR'].includes(zone)||typeof active!=='boolean')return {error:'ไม่สามารถเปลี่ยนสถานะโซนนี้ได้'}
  const result=await transaction(async connection=>{
    await connection.query('SELECT id FROM settings WHERE id=1 FOR UPDATE')
    const [[current]]=await connection.execute('SELECT zone FROM zone_details WHERE zone=? FOR UPDATE',[zone])
    if(!current)return {error:'ไม่พบโซนนี้ กรุณารีเฟรชหน้า'}
    await connection.execute('UPDATE zone_details SET active=? WHERE zone=?',[active,zone])
    return {ok:true}
  })
  if(result.ok){revalidatePath('/admin');revalidatePath('/');revalidatePath('/booking')}
  return result
}
// Banner behind the green band on customer pages: one photo or one video; a new upload replaces the old file.
const heroUrl=params=>'/admin?'+new URLSearchParams({section:'settings',group:'welcome',...params})
export async function saveHeroMedia(data){
  await guard()
  const value=data.get('media')
  let saved=false
  try{
    saved=await transaction(async db=>{
      await lockStorage(db)
      const [[asset]]=await db.execute('SELECT mime FROM storage_assets WHERE id=?',[storageId(value)])
      const kind=asset?.mime?.startsWith('video/')?'video':'image'
      const file=await claimUpload(db,value,'admin',kind)
      await db.execute('DELETE FROM facility_media WHERE category=?',[heroCategory])
      const [result]=await db.execute('INSERT INTO facility_media(category,mime,content) VALUES (?,?,?)',[heroCategory,file.mime,file.content])
      await db.execute("INSERT INTO camp_options(option_key,value_json) VALUES ('hero',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",[JSON.stringify({id:Number(result.insertId),kind})])
      await ensureStorage(db)
      return true
    })
  }catch(error){
    if(!(error instanceof StorageError))throw error
  }
  if(saved)for(const path of ['/','/review','/payment','/booking'])revalidatePath(path)
  redirect(heroUrl(saved?{saved:'settings'}:{error:'storage'}))
}
export async function removeHeroMedia(){
  await guard()
  await transaction(async db=>{
    await db.execute("DELETE FROM camp_options WHERE option_key='hero'")
    await db.execute('DELETE FROM facility_media WHERE category=?',[heroCategory])
  })
  for(const path of ['/','/review','/payment','/booking'])revalidatePath(path)
  redirect(heroUrl({saved:'settings'}))
}
