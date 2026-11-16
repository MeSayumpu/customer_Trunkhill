import { AdminIcon } from './admin-icon'
import { ActionForm } from '../pending-ui'
import { campOptions } from '../../lib/camp-options'
import { trunkboxTextDefaults, trunkboxTextMax } from '../../lib/trunkbox-text'
import { saveTrunkboxText } from './camp-options-actions'

// Texts of the Trunkbox tab on the customer's booking page: the line under the heading and the price line of each room.
export async function TrunkboxTextSettings() {
  const saved = (await campOptions()).trunkboxText ?? {}
  const value = key => typeof saved[key] === 'string' ? saved[key] : ''
  return <details className="panel zone-create"><summary>ข้อความในหน้าจอง Trunkbox</summary>
    <p>เว้นว่างเพื่อใช้ข้อความเดิมของระบบ ช่อง English เว้นว่างได้ ระบบจะใช้คำแปลของข้อความไทย</p>
    <ActionForm action={saveTrunkboxText} className="stack">
      <label>คำอธิบายใต้หัวข้อ Trunkbox<input name="intro" maxLength={trunkboxTextMax} defaultValue={value('intro')} placeholder={trunkboxTextDefaults.intro}/></label>
      <label>คำอธิบายใต้หัวข้อ (English)<input name="introEn" lang="en" maxLength={trunkboxTextMax} defaultValue={value('introEn')}/></label>
      <label>บรรทัดราคาใต้ชื่อห้อง<input name="price" maxLength={trunkboxTextMax} defaultValue={value('price')} placeholder={trunkboxTextDefaults.price}/></label>
      <label>บรรทัดราคาใต้ชื่อห้อง (English)<input name="priceEn" lang="en" maxLength={trunkboxTextMax} defaultValue={value('priceEn')}/></label>
      <p>ในบรรทัดราคา พิมพ์ {'{price}'} แทนราคาห้อง {'{base}'} แทนจำนวนคนที่รวมในราคา {'{extra}'} แทนค่าผู้เข้าพักเพิ่ม และ {'{max}'} แทนจำนวนคนสูงสุด ระบบจะเติมตัวเลขของแต่ละห้องให้</p>
      <div className="actions"><button className="button"><AdminIcon name="save"/>บันทึกข้อความ</button></div>
    </ActionForm>
  </details>
}
