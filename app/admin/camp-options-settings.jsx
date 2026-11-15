import {campOptions,facilityCategories} from '../../lib/camp-options'
import {contactChannels} from '../../lib/camp-contacts'
import {database} from '../../lib/db'
import {ActionForm} from '../pending-ui'
import {SocialIcon} from '../social-icon'
import {saveBookingWindow,saveContacts,saveFacilities,saveGuestRate,saveGuestTypes,saveLocation} from './camp-options-actions'
import {GuestRateLinesField} from './guest-rate-lines-field'
import {guestTypeTextMax} from '../../lib/guest-types'
import {LocationFields} from './location-fields'
import {FacilitiesEditor} from './rich-text-editor'
import {AdminIcon} from './admin-icon'
const guestTypeLabels=[['adults','ผู้ใหญ่'],['children','เด็ก'],['seniors','ผู้สูงอายุ']]
export async function GuestTypeSettings(){
  const {guestTypes,guestRate}=await campOptions()
  return <section className="panel stack"><h2>คำอธิบายประเภทผู้เข้าพัก</h2>
    <p>ข้อความที่ลูกค้าเห็นใต้ชื่อแต่ละประเภทในหน้าเลือกจำนวนผู้เข้าพัก หมายเหตุจะแสดงคู่กับเครื่องหมาย <strong style={{color:'#c62828'}}>*</strong> หลังคำว่า “ฟรี” เว้นว่างได้ถ้าไม่ต้องการแสดง ช่องภาษาอังกฤษถ้าเว้นว่างจะใช้คำแปลของระบบ</p>
    <ActionForm action={saveGuestTypes} className="stack">
      {guestTypeLabels.map(([key,label])=><fieldset key={key} className="guest-type-fields"><legend>{label}</legend>
        <label>คำอธิบาย (เงื่อนไขอายุ)<input name={key+'Detail'} maxLength={guestTypeTextMax} defaultValue={guestTypes[key].detail}/></label>
        <label>คำอธิบาย (English)<input name={key+'DetailEn'} maxLength={guestTypeTextMax} defaultValue={guestTypes[key].detailEn}/></label>
        <label>หมายเหตุ * (แสดงเมื่อขึ้นคำว่า ฟรี)<input name={key+'Note'} maxLength={guestTypeTextMax} defaultValue={guestTypes[key].note} placeholder={key==='adults'?'ผู้ใหญ่ไม่มีคำว่า ฟรี':'เช่น ผู้ติดตาม'} disabled={key==='adults'}/></label>
        <label>หมายเหตุ * (English)<input name={key+'NoteEn'} maxLength={guestTypeTextMax} defaultValue={guestTypes[key].noteEn} disabled={key==='adults'}/></label>
      </fieldset>)}
      <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกคำอธิบาย</button></div>
    </ActionForm>
    <h3>คำอธิบายในกล่อง “อัตราค่าเข้าพัก”</h3>
    <p>ข้อความที่ลูกค้าเห็นในกล่องอัตราค่าเข้าพักของหน้าเลือกจำนวนผู้เข้าพัก (การจองล็อก) เพิ่ม แก้ไข หรือลบได้ทีละบรรทัด สูงสุด 10 บรรทัด</p>
    <ActionForm action={saveGuestRate} className="stack">
      <GuestRateLinesField lines={guestRate.lines}/>
      <label className="check-row"><input type="checkbox" name="auto" defaultChecked={guestRate.auto}/> แสดงอัตราราคาที่ระบบคำนวณจากราคาที่ตั้งไว้ด้วย (เช่น “1 คนต่อล็อก 200 บาท / คืน”)</label>
      <p className="small muted">ถ้าไม่ติ๊ก ลูกค้าจะเห็นเฉพาะข้อความที่เขียนไว้ด้านบน ถ้าไม่ได้เขียนไว้เลย ระบบจะแสดงอัตราราคาอัตโนมัติตามเดิม</p>
      <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกคำอธิบายอัตราค่าเข้าพัก</button></div>
    </ActionForm></section>
}
export async function BookingWindowSettings(){
  const {window}=await campOptions()
  return <section className="panel stack"><h2>ตั้งค่าวันจองล่วงหน้า</h2><p>เลือกวันเข้าพักได้ตั้งแต่วันนี้ถึงวันสุดท้ายของระยะที่กำหนด วันออกเลือกได้ไม่เกินวันถัดจากวันสุดท้าย</p>
    <ActionForm action={saveBookingWindow} className="form-grid"><label>ระยะจองล่วงหน้า<input name="value" type="number" min="1" max="1095" required defaultValue={window.value}/></label><label>หน่วย<select name="unit" defaultValue={window.unit}><option value="months">เดือน (สูงสุด 36 เดือน)</option><option value="days">วัน (สูงสุด 1,095 วัน)</option></select></label><button className="button">บันทึกระยะจองล่วงหน้า</button></ActionForm></section>
}
export async function FacilitiesSettings(){
  const {facilities}=await campOptions()
  const [images]=await database().query('SELECT id,category FROM facility_media ORDER BY id')
  return <section className="panel stack facilities-settings"><h2>ข้อมูลทั่วไปและสิ่งอำนวยความสะดวก</h2>
    <p>แสดงในหน้าจองลาน หมวดที่เว้นว่างจะแสดงข้อความให้ติดต่อแคมป์ ใช้แถบเครื่องมือจัดรูปแบบข้อความหรือแนบรูป แล้วดูผลที่ช่องพรีวิวด้านข้าง</p>
    <details className="notice rich-editor-help"><summary>วิธีจัดรูปแบบด้วยการพิมพ์</summary>
      <p><code>**ตัวหนา**</code> · <code>*ตัวเอียง*</code> · <code>__ขีดเส้นใต้__</code> · <code>~~ขีดฆ่า~~</code> · <code>==ไฮไลต์==</code> · <code>[ข้อความ](https://ลิงก์)</code></p>
      <p>ขึ้นบรรทัดด้วย <code># หัวข้อ</code>, <code>## หัวข้อรอง</code>, <code>- รายการ</code>, <code>1. รายการ</code>, <code>&gt; หมายเหตุ</code> หรือ <code>---</code> สำหรับเส้นคั่น เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่</p>
    </details>
    <ActionForm action={saveFacilities} className="stack">
      <FacilitiesEditor categories={facilityCategories} facilities={facilities} images={images.map(({id,category})=>({id:Number(id),category}))}/>
      <button className="button"><AdminIcon name="save"/>บันทึกข้อมูลทั่วไป</button>
    </ActionForm>
  </section>
}
export async function ContactsSettings({query}){
  const {contacts,location}=await campOptions()
  const fields=String(query?.fields||'').split(',').filter(Boolean)
  const invalid=new Set(query?.error==='contacts'?fields:[])
  return <><section className="panel stack contact-settings"><h2>ช่องทางติดต่อที่พัก</h2>
    <p>แสดงในปุ่ม “ข้อมูลการติดต่อ” มุมขวาบน เมนูข้อมูลแคมป์ และท้ายหน้า ลูกค้ากดเพื่อคัดลอกเบอร์/ID หรือเปิดลิงก์ได้ ช่องที่เว้นว่างจะไม่แสดง</p>
    {invalid.size>0&&<p className="notice error" role="alert">ตรวจสอบช่องที่ไฮไลต์: เบอร์โทรใช้ตัวเลข + และ - ได้ ลิงก์ต้องขึ้นต้นด้วย https:// และ LINE ใช้ ID (เช่น @trunkhill) หรือลิงก์</p>}
    <ActionForm action={saveContacts} className="stack">
      <div className="contact-fields">
        {contactChannels.map(({key,name,label,placeholder,type})=><label key={key} className="contact-field" data-invalid={invalid.has(key)||undefined}>
          <SocialIcon channel={key} size={40}/>
          <span className="contact-field-name"><strong>{name}</strong><small>{label}</small></span>
          <input name={key} type={type||'url'} inputMode={type==='tel'?'tel':type==='text'?'text':'url'} maxLength={300} placeholder={placeholder} defaultValue={contacts[key]||''}
            aria-invalid={invalid.has(key)||undefined} aria-label={label}/>
        </label>)}
      </div>
      <button className="button"><AdminIcon name="save"/>บันทึกช่องทางติดต่อ</button>
    </ActionForm>
  </section>
  <section className="panel stack contact-settings" id="camp-location"><h2>ที่ตั้งแคมป์ (แผนที่)</h2>
    <p>แสดงแผนที่ ปุ่มเปิด Google Maps และปุ่มนำทาง ในหน้าต่าง “ข้อมูลการติดต่อ” และ “ข้อมูลแคมป์”</p>
    <ActionForm action={saveLocation} className="stack">
      <LocationFields initial={location} invalid={query?.error==='location'?fields:[]}/>
      <button className="button"><AdminIcon name="save"/>บันทึกที่ตั้ง</button>
    </ActionForm>
  </section></>
}
