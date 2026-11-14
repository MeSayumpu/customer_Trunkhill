import {randomUUID,createHash} from 'node:crypto'
import {readdir,stat} from 'node:fs/promises'
import path from 'node:path'
import {database,transaction} from './db'
import {uploadMime} from './payment-rules'

export const CHUNK_BYTES=1024*1024
const prefix='@storage:'
const sources=[['inventory_photos','photo','mime'],['plot_map_background','content','mime'],['plot_map_versions','content','mime'],['payment_config','qr','mime'],['zone_media','content','mime'],['facility_media','content','mime'],['booking_payments','slip','mime']]
export class StorageError extends Error {constructor(message,status=413){super(message);this.status=status}}
export const storageId=value=>{if(Buffer.isBuffer(value)&&value.length!==45)return null;const text=Buffer.isBuffer(value)?value.toString():value;return typeof text==='string'&&/^@storage:[a-f0-9-]{36}$/.test(text)?text.slice(prefix.length):null}
export const storageMarker=id=>Buffer.from(prefix+id)
export async function lockStorage(db){await db.query('SELECT id FROM storage_quota WHERE id=1 FOR UPDATE')}
let measurement,measuredAt=0
async function directoryBytes(root){let total=0;let entries;try{entries=await readdir(root,{withFileTypes:true})}catch{return 0}for(const entry of entries){if(entry.isSymbolicLink())continue;const file=path.join(root,entry.name);if(entry.isDirectory())total+=await directoryBytes(file);else if(entry.isFile())total+=(await stat(file)).size}return total}
export async function measureSystem(){
 if(measurement&&Date.now()-measuredAt<60000)return measurement
 measuredAt=Date.now()
 measurement=(async()=>{let bytes=0;for(const dir of ['app','lib','public','db','scripts','node_modules',process.env.NEXT_OUTPUT_DIR||'.next'])bytes+=await directoryBytes(path.resolve(dir));for(const name of ['package.json','package-lock.json','next.config.mjs']){try{bytes+=(await stat(name)).size}catch{}}await database().execute('UPDATE storage_quota SET system_bytes=?,measured_at=UTC_TIMESTAMP() WHERE id=1',[bytes]);return bytes})()
 try{return await measurement}catch(error){measurement=null;throw error}
}
async function references(db){
 const refs=new Set();let legacy=0,images=0,videos=0,other=0
 for(const [table,col,mime] of sources){
  const [rows]=await db.query(`SELECT LEFT(${col},45) AS marker,OCTET_LENGTH(${col}) AS bytes,${mime} AS mime FROM ${table} WHERE ${col} IS NOT NULL`)
  for(const row of rows){const id=Number(row.bytes)===45?storageId(row.marker):null;if(id){refs.add(id);continue}const n=Number(row.bytes);legacy+=n;if(row.mime?.startsWith('video/'))videos+=n;else if(row.mime?.startsWith('image/'))images+=n;else other+=n}
 }
 return {refs,legacy,images,videos,other}
}
export async function storageUsage(db=database(),clean=false){
 const ref=await references(db)
 const [assets]=await db.query('SELECT *,expires_at<UTC_TIMESTAMP() AS expired FROM storage_assets')
 let media=ref.legacy,reserved=0,actual=ref.legacy,images=ref.images,videos=ref.videos,other=ref.other
 for(const asset of assets){const linked=ref.refs.has(asset.id)
  if(!linked&&(asset.claimed||asset.expired)){if(clean)await db.execute('DELETE FROM storage_assets WHERE id=?',[asset.id]);else reserved+=Number(asset.bytes);continue}
  actual+=Number(asset.received)
  if(linked){media+=Number(asset.bytes);if(asset.mime?.startsWith('video/'))videos+=Number(asset.bytes);else if(asset.mime?.startsWith('image/'))images+=Number(asset.bytes);else other+=Number(asset.bytes)}else reserved+=Number(asset.bytes)
 }
 const [[quota]]=await db.query('SELECT * FROM storage_quota WHERE id=1')
 const [[allocation]]=await db.query('SELECT COALESCE(SUM(data_length+index_length),0) AS bytes FROM information_schema.tables WHERE table_schema=DATABASE()')
 const system=Number(quota.system_bytes)+Math.max(0,Number(allocation.bytes)-actual)
 const used=system+media+reserved,limit=Number(quota.limit_bytes)
 return {system,media,reserved,images,videos,other,used,limit,free:Math.max(0,limit-used),measuredAt:quota.measured_at}
}
export async function ensureStorage(db){const usage=await storageUsage(db,true);if(usage.used>usage.limit)throw new StorageError('พื้นที่จัดเก็บรวม 10 GB ไม่เพียงพอ ไม่สามารถอัปโหลดเพิ่มได้ กรุณาติดต่อผู้ดูแลระบบ');return usage}
export async function beginUpload(owner,bytes){
 if(!Number.isSafeInteger(bytes)||bytes<1)throw new StorageError('ไฟล์ไม่ถูกต้อง',400)
 await measureSystem()
 return transaction(async db=>{await lockStorage(db);const usage=await ensureStorage(db);if(bytes>usage.free)throw new StorageError('พื้นที่จัดเก็บรวม 10 GB ไม่เพียงพอสำหรับไฟล์นี้ กรุณาติดต่อผู้ดูแลระบบ');const id=randomUUID();await db.execute('INSERT INTO storage_assets(id,owner,bytes,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))',[id,owner,bytes]);await ensureStorage(db);return {id,chunkBytes:CHUNK_BYTES}})
}
export async function uploadChunk(id,owner,part,content){
 if(!Number.isSafeInteger(part)||part<0||!content.length||content.length>CHUNK_BYTES)throw new StorageError('ข้อมูลชิ้นไฟล์ไม่ถูกต้อง',400)
 return transaction(async db=>{await lockStorage(db);const [[asset]]=await db.execute('SELECT *,expires_at>UTC_TIMESTAMP() AS live FROM storage_assets WHERE id=? AND owner=? FOR UPDATE',[id,owner]);if(!asset||!asset.live||asset.claimed||asset.file_hash)throw new StorageError('รายการอัปโหลดหมดอายุ',409)
 const offset=part*CHUNK_BYTES
 if(offset<Number(asset.received)){const [[old]]=await db.execute('SELECT content FROM storage_chunks WHERE asset=? AND part=?',[id,part]);if(old?.content.equals(content))return;throw new StorageError('ชิ้นไฟล์ซ้ำไม่ตรงกัน',409)}
 if(offset!==Number(asset.received)||offset+content.length>Number(asset.bytes)||(content.length!==CHUNK_BYTES&&offset+content.length!==Number(asset.bytes)))throw new StorageError('ลำดับไฟล์ไม่ถูกต้อง',409)
 await db.execute('INSERT INTO storage_chunks(asset,part,content) VALUES (?,?,?)',[id,part,content]);await db.execute('UPDATE storage_assets SET received=received+?,expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR) WHERE id=?',[content.length,id])
 })
}
export async function finishUpload(id,owner){
 const [[asset]]=await database().execute('SELECT * FROM storage_assets WHERE id=? AND owner=? AND expires_at>UTC_TIMESTAMP()',[id,owner]);if(!asset||Number(asset.received)!==Number(asset.bytes))throw new StorageError('ไฟล์ยังอัปโหลดไม่ครบ',409)
 const hash=createHash('sha256');let mime
 for(let part=0;part*CHUNK_BYTES<Number(asset.bytes);part++){const [[row]]=await database().execute('SELECT content FROM storage_chunks WHERE asset=? AND part=?',[id,part]);if(!row)throw new StorageError('ไฟล์ไม่ครบ',409);if(part===0){mime=uploadMime(row.content,true)||(row.content.toString('ascii',4,8)==='ftyp'?'video/mp4':row.content.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&row.content.subarray(0,128).includes('webm')?'video/webm':null)}hash.update(row.content)}
 if(!mime)throw new StorageError('รองรับ JPG, PNG, WebP, PDF, MP4 และ WebM เท่านั้น',400)
 await database().execute('UPDATE storage_assets SET mime=?,file_hash=? WHERE id=? AND owner=?',[mime,hash.digest('hex'),id,owner]);return {value:prefix+id}
}
export async function discardUpload(id,owner){return transaction(async db=>{await lockStorage(db);await db.execute('DELETE FROM storage_assets WHERE id=? AND owner=? AND claimed=0',[id,owner])})}
export async function claimUpload(db,value,owner,kind='image'){
 const id=storageId(value);if(!id)throw new StorageError('กรุณาเลือกไฟล์แล้วอัปโหลดใหม่',400)
 await lockStorage(db)
 const [[asset]]=await db.execute('SELECT *,expires_at>UTC_TIMESTAMP() AS live FROM storage_assets WHERE id=? AND owner=? FOR UPDATE',[id,owner])
 if(!asset||!asset.file_hash||(!asset.claimed&&!asset.live)||!(kind==='slip'?['image/jpeg','image/png','image/webp','application/pdf'].includes(asset.mime):asset.mime.startsWith(kind+'/')))throw new StorageError('ไฟล์ไม่ถูกต้องหรือหมดอายุ กรุณาเลือกใหม่',400)
 await db.execute('UPDATE storage_assets SET claimed=1 WHERE id=?',[id])
 return {content:storageMarker(id),mime:asset.mime,fileHash:asset.file_hash}
}
export async function mediaResponse(request,content,headers={}){
 const id=storageId(content);let bytes,read
 if(id){const [[asset]]=await database().execute('SELECT bytes FROM storage_assets WHERE id=? AND claimed=1',[id]);if(!asset)return new Response(null,{status:404});bytes=Number(asset.bytes);read=async(start,end)=>{const part=Math.floor(start/CHUNK_BYTES);const [[row]]=await database().execute('SELECT content FROM storage_chunks WHERE asset=? AND part=?',[id,part]);if(!row)throw Error('Missing media chunk');return row.content.subarray(start%CHUNK_BYTES,Math.min(row.content.length,end-part*CHUNK_BYTES+1))}}
 else{bytes=content?.length||0;read=async(start,end)=>content.subarray(start,Math.min(end+1,start+CHUNK_BYTES))}
 let start=0,end=bytes-1,status=200
 const range=request?.headers.get('range')
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes}`}});start=match[1]?Number(match[1]):Math.max(0,bytes-Number(match[2]));end=match[1]&&match[2]?Math.min(bytes-1,Number(match[2])):bytes-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes}`}});status=206}
 const responseHeaders={...headers,'Accept-Ranges':'bytes','Content-Length':String(Math.max(0,end-start+1)),'X-Content-Type-Options':'nosniff'}
 if(status===206)responseHeaders['Content-Range']=`bytes ${start}-${end}/${bytes}`
 let offset=start
 const stream=new ReadableStream({async pull(controller){try{if(offset>end){controller.close();return}const chunk=await read(offset,end);offset+=chunk.length;controller.enqueue(chunk)}catch(error){controller.error(error)}}})
 return new Response(stream,{status,headers:responseHeaders})
}
