import {heroMedia} from '../../lib/camp-options'
import {ActionForm} from '../pending-ui'
import {ConfirmSubmit} from '../confirm-dialog'
import {MediaUpload} from './media-upload'
import {AdminIcon} from './admin-icon'
import {saveHeroMedia,removeHeroMedia} from './camp-options-actions'

// Photo or video behind the green band at the top of every customer page (/, /review, /payment, /booking).
export async function HeroMediaSettings(){
  const media=await heroMedia()
  const src=media&&'/api/facility-media/'+media.id
  return <section className="panel stack admin-content hero-media-settings"><h2>ภาพหรือวิดีโอแถบด้านบน</h2>
    <p className="muted">แถบสีเขียวเข้มด้านบนแสดงในทุกหน้าของลูกค้า (จองลาน · สรุปการจอง · ชำระเงิน · ตรวจสอบการจอง) อัปโหลดรูปหรือวิดีโอ 1 ไฟล์เพื่อใช้เป็นพื้นหลังได้ ระบบจะใส่ฟิลเตอร์สีเขียวเข้มไล่จากเข้มไปอ่อนทับให้อัตโนมัติ วิดีโอจะเล่นวนแบบไม่มีเสียง ถ้าไม่อัปโหลดจะใช้พื้นสีเขียวเข้มตามเดิม</p>
    <div className="hero-media-preview" aria-label="ตัวอย่างแถบด้านบน">
      {media&&(media.kind==='video'?<video src={src} autoPlay muted loop playsInline preload="metadata"/>:<img src={src} alt="" decoding="async"/>)}
      <span>{media?(media.kind==='video'?'วิดีโอปัจจุบัน':'รูปปัจจุบัน')+' · ตัวอย่างพร้อมฟิลเตอร์':'ยังไม่มีไฟล์ · ใช้พื้นสีเขียวเข้ม'}</span>
    </div>
    <ActionForm action={saveHeroMedia} className="stack">
      <MediaUpload name="media" video="any" required/>
      <small className="muted">แนะนำภาพแนวนอนกว้างอย่างน้อย 1600px · วิดีโอสั้น 10–20 วินาที ขนาดไม่เกิน ~15 MB เพื่อให้โหลดเร็วบนมือถือ</small>
      <div className="actions"><button className="button"><AdminIcon name="save"/>{media?'แทนที่ด้วยไฟล์ใหม่':'อัปโหลดและใช้งาน'}</button></div>
    </ActionForm>
    {media&&<ActionForm action={removeHeroMedia}>
      <ConfirmSubmit className="button secondary admin-cancel" confirm={{
        title:'นำ'+(media.kind==='video'?'วิดีโอ':'รูป')+'แถบด้านบนออก?',
        message:'ไฟล์จะถูกลบออกจากระบบถาวร หน้าของลูกค้าจะกลับไปใช้พื้นสีเขียวเข้ม',
        confirmLabel:'ลบไฟล์ถาวร',
      }}>นำ{media.kind==='video'?'วิดีโอ':'รูป'}ออก ใช้พื้นสีเขียว</ConfirmSubmit>
    </ActionForm>}
  </section>
}
