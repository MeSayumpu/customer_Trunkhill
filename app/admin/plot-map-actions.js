'use server'
import {randomUUID} from 'node:crypto'
import {revalidatePath} from 'next/cache'
import {isAdmin} from '../../lib/auth'
import {transaction} from '../../lib/db'
import {readMapShape} from '../../lib/plot-map'
import {uploadMime} from '../../lib/payment-rules'
import {wholeCampCode} from '../../lib/whole-camp'
import {claimUpload,lockStorage,ensureStorage,storageId,StorageError} from '../../lib/storage'

export async function savePlotMap(form) {
  if(!(await isAdmin()))return {error:'กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง'}
  const operation=form.get('operation'),base=form.get('base')||null
  if(!['draft','publish'].includes(operation))return {error:'เลือก Draft หรือ Publish'}
  const raw=form.get('elements')
  if(typeof raw!=='string'||raw.length>1_000_000)return {error:'ข้อมูลผังไม่ถูกต้อง'}
  let elements
  try {elements=JSON.parse(raw)} catch {return {error:'ข้อมูลผังไม่ถูกต้อง'}}
  if(!elements||Array.isArray(elements)||typeof elements!=='object')return {error:'ข้อมูลผังไม่ถูกต้อง'}
  for(const [code,shape] of Object.entries(elements)) {
    if(!/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(code)||code===wholeCampCode||shape!==null&&(shape.type!=='polygon'||!readMapShape(JSON.stringify(shape))))return {error:'ตรวจสอบขอบเขตของ '+code+' ต้องมีอย่างน้อย 3 จุดและมีพื้นที่'}
  }
  const file=form.get('image')
  let uploaded=null
  if(storageId(file))uploaded=file
  try {
  const result=await transaction(async db=>{
    await lockStorage(db)
    if(uploaded)uploaded=await claimUpload(db,uploaded,'admin')
    const [[state]]=await db.query('SELECT * FROM plot_map_state WHERE id=1 FOR UPDATE')
    if((state.draft_revision||null)!==base)return {error:'มีผู้แก้ไขผังนี้แล้ว กรุณารีเฟรชก่อนแก้ต่อเพื่อไม่เขียนทับข้อมูลล่าสุด'}
    const [inventory]=await db.execute("SELECT code FROM inventory WHERE kind IN ('plot','room') AND code<>?",[wholeCampCode])
    const valid=new Set(inventory.map(r=>r.code))
    if(Object.keys(elements).some(code=>!valid.has(code)))return {error:'มีล็อกที่ไม่อยู่ในระบบ กรุณารีเฟรชหน้า'}
    let image=uploaded
    if(!image) {
      if(base) {const [[saved]]=await db.execute('SELECT mime,content FROM plot_map_versions WHERE revision=?',[base]);image=saved}
      else {const [[legacy]]=await db.query('SELECT mime,content FROM plot_map_background WHERE id=1');image=legacy}
    }
    const revision=randomUUID()
    await db.execute('INSERT INTO plot_map_versions (revision,elements,mime,content,published_at) VALUES (?,?,?,?,IF(?=1,CURRENT_TIMESTAMP,NULL))',[revision,JSON.stringify(elements),image?.mime||null,image?.content||null,operation==='publish'?1:0])
    await db.execute('UPDATE plot_map_state SET draft_revision=?,published_revision=IF(?=1,?,published_revision) WHERE id=1',[revision,operation==='publish'?1:0,revision])
    await ensureStorage(db)
    return {revision,published:operation==='publish',custom:!!image?.mime}
  })
  if(!result.error) {revalidatePath('/admin');if(result.published){revalidatePath('/');revalidatePath('/booking')}}
  return result
  }catch(error){if(error instanceof StorageError)return {error:error.message};throw error}
}
