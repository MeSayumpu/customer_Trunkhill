import {createHash} from 'node:crypto'
import {isAdmin} from '../../../lib/auth'
import {database} from '../../../lib/db'
import {translateMessage} from '../../../lib/i18n'
import {requestLanguage} from '../../../lib/request-language'
import {beginUpload,uploadChunk,finishUpload,discardUpload,CHUNK_BYTES,StorageError} from '../../../lib/storage'
export const runtime='nodejs'
async function owner(request){
 const origin=request.headers.get('origin'),host=request.headers.get('host')
 if(!host||![`http://${host}`,`https://${host}`].includes(origin))throw new StorageError('ไม่อนุญาต',403)
 const booking=request.nextUrl.searchParams.get('booking')
 if(!booking){if(await isAdmin())return 'admin';throw new StorageError('กรุณาเข้าสู่ระบบ',403)}
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
 if(!token)throw new StorageError('ไม่อนุญาต',403)
 const hash=createHash('sha256').update(token).digest('hex')
 const [[row]]=await database().execute("SELECT p.booking FROM booking_payments p JOIN bookings b ON b.id=p.booking WHERE p.booking=? AND p.token_hash=? AND p.expires_at>UTC_TIMESTAMP() AND p.submitted_at IS NULL AND b.status='pending'",[booking,hash])
 if(!row)throw new StorageError('รายการชำระเงินหมดอายุหรือส่งสลิปแล้ว',409)
 return booking+':'+hash
}
async function handle(request,work){try{return Response.json(await work(await owner(request)),{headers:{'Cache-Control':'no-store'}})}catch(error){const lang=await requestLanguage().catch(()=>'th');if(error instanceof StorageError)return Response.json({error:translateMessage(lang,error.message)},{status:error.status});console.error('Upload failed',error.code||error.name);return Response.json({error:translateMessage(lang,'อัปโหลดไม่สำเร็จ กรุณาลองใหม่')},{status:500})}}
export function POST(request){return handle(request,async key=>{const data=await request.json();return data.id?finishUpload(data.id,key):beginUpload(key,data.bytes)})}
export function PUT(request){return handle(request,async key=>{const reader=request.body?.getReader();if(!reader)throw new StorageError('ไม่มีไฟล์',400);let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>CHUNK_BYTES){await reader.cancel();throw new StorageError('ชิ้นไฟล์ใหญ่เกินขนาดการส่ง กรุณาลองใหม่',400)}chunks.push(value)}await uploadChunk(request.nextUrl.searchParams.get('id'),key,Number(request.nextUrl.searchParams.get('part')),Buffer.concat(chunks));return {ok:true}})}
export function DELETE(request){return handle(request,async key=>{await discardUpload(request.nextUrl.searchParams.get('id'),key);return {ok:true}})}
