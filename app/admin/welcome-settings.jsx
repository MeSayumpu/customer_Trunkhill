import {database} from '../../lib/db'
import {ActionForm} from '../pending-ui'
import {saveWelcome} from './actions'
export async function WelcomeSettings(){
  const [[s]]=await database().query('SELECT welcome_title,welcome_subtitle,welcome_title_enabled,welcome_subtitle_enabled FROM settings WHERE id=1')
  return <section className="panel stack admin-content"><h2>คำโปรยหน้าจอง</h2>
    <ActionForm action={saveWelcome} className="stack">
      <label><input type="checkbox" name="titleEnabled" defaultChecked={!!s.welcome_title_enabled}/> แสดงหัวข้อใหญ่</label>
      <label>หัวข้อใหญ่<input name="title" maxLength={160} defaultValue={s.welcome_title}/></label>
      <label><input type="checkbox" name="subtitleEnabled" defaultChecked={!!s.welcome_subtitle_enabled}/> แสดงข้อความรอง</label>
      <label>ข้อความรอง<input name="subtitle" maxLength={240} defaultValue={s.welcome_subtitle}/></label>
      <button className="button">บันทึกคำโปรย</button>
    </ActionForm>
  </section>
}
