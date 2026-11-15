'use server'
import {redirect} from 'next/navigation'
import {isAdmin} from '../../lib/auth'
import {database,transaction} from '../../lib/db'
import {revalidatePath} from 'next/cache'
import {facilityCategories,heroCategory} from '../../lib/camp-options'
import {contactChannels,parseCoordinates,validContact,validLink} from '../../lib/camp-contacts'
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
export async function saveFacilities(data){
  await guard();const values=Object.fromEntries(facilityKeys.map(key=>[key,String(data.get(key)||'').trim()]))
  if(Object.values(values).some(v=>v.length>maxFacilityText))redirect('/admin?section=settings&group=facilities&error=invalid')
  await save('facilities',values);revalidatePath('/');redirect('/admin?section=settings&group=facilities&saved=settings')
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
  await save('location',{address,coords:point?point.lat+', '+point.lng:'',mapUrl});revalidatePath('/');redirect('/admin?section=settings&group=contacts&saved=settings')
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
