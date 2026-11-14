import {isAdmin} from '../../../lib/auth'
import {transaction} from '../../../lib/db'
import {campZones} from '../../../lib/camp-options'
import {claimUpload,lockStorage,ensureStorage,StorageError} from '../../../lib/storage'
function result(zone,outcome){return new Response(null,{status:303,headers:{Location:'/admin?'+new URLSearchParams({section:'zoneMedia',zone,...outcome})}})}
export async function POST(request){
 const host=request.headers.get('host'),origin=request.headers.get('origin')
 if(!host||!['https://'+host,'http://'+host].includes(origin)||!await isAdmin())return new Response(null,{status:403})
 const zone=request.nextUrl.searchParams.get('zone')
 if(!(await campZones()).includes(zone))return result('',{error:'invalid'})
 const data=await request.formData(),files=data.getAll('media'),kind=data.get('kind')
 if(!['image','video'].includes(kind)||!files.length||kind==='video'&&files.length!==1)return result(zone,{error:'zoneMedia'})
 try{
 const saved=await transaction(async db=>{
  await lockStorage(db)
  await db.execute('SELECT zone FROM zone_details WHERE zone=? FOR UPDATE',[zone])
  if(kind==='image'){const [[{count}]]=await db.execute("SELECT COUNT(*) AS count FROM zone_media WHERE zone=? AND kind='image'",[zone]);if(Number(count)+files.length>8)return false}
  const uploads=[];for(const file of files)uploads.push(await claimUpload(db,file,'admin',kind))
  if(kind==='video')await db.execute("DELETE FROM zone_media WHERE zone=? AND kind='video'",[zone])
  for(const file of uploads)await db.execute('INSERT INTO zone_media(zone,kind,mime,caption,content) VALUES (?,?,?,?,?)',[zone,kind,file.mime,'',file.content])
  await ensureStorage(db);return true
 })
 return result(zone,saved?{saved:'zoneMedia'}:{error:'zoneLimit'})
 }catch(error){if(error instanceof StorageError)return result(zone,{error:'storage'});throw error}
}
