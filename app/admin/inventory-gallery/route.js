import {isAdmin} from '../../../lib/auth'
import {transaction} from '../../../lib/db'
import {codePattern} from '../../../lib/camp'
import {claimUpload,lockStorage,ensureStorage,StorageError} from '../../../lib/storage'
import {roomGalleryLimit} from '../../../lib/room-gallery'

function result(code,outcome){return new Response(null,{status:303,headers:{Location:'/admin?'+new URLSearchParams({section:'rooms',...(code?{edit:code}:{}),...outcome})}})}
export async function POST(request){
 const host=request.headers.get('host'),origin=request.headers.get('origin')
 if(!host||!['https://'+host,'http://'+host].includes(origin)||!await isAdmin())return new Response(null,{status:403})
 const code=request.nextUrl.searchParams.get('code')
 if(!code||!codePattern.test(code))return result('',{error:'invalid'})
 const files=(await request.formData()).getAll('media')
 if(!files.length)return result(code,{error:'photo'})
 try{
  const outcome=await transaction(async db=>{
   await lockStorage(db)
   const [[room]]=await db.execute("SELECT code FROM inventory WHERE code=? AND kind='room' FOR UPDATE",[code])
   if(!room)return {error:'invalid'}
   const [[{count,last}]]=await db.execute('SELECT COUNT(*) AS count,COALESCE(MAX(sort),0) AS last FROM inventory_gallery WHERE code=?',[code])
   if(Number(count)+files.length>roomGalleryLimit)return {error:'roomGalleryLimit'}
   const uploads=[];for(const file of files)uploads.push(await claimUpload(db,file,'admin','image'))
   let sort=Number(last)
   for(const file of uploads)await db.execute('INSERT INTO inventory_gallery(code,mime,content,sort) VALUES (?,?,?,?)',[code,file.mime,file.content,++sort])
   await ensureStorage(db);return {saved:'inventory'}
  })
  return result(code,outcome)
 }catch(error){if(error instanceof StorageError)return result(code,{error:'storage'});throw error}
}
