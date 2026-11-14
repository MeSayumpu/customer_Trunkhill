import {database} from '../../lib/db'
import {ActionForm} from '../pending-ui'
import {saveWelcome} from './actions'
import {translate} from '../../lib/i18n'

// Shown in the green banner at the top of the customer booking page (/), above the 1-2-3-4 steps.
export async function WelcomeSettings(){
  const [[s]]=await database().query('SELECT welcome_title,welcome_subtitle,welcome_title_en,welcome_subtitle_en,welcome_title_enabled,welcome_subtitle_enabled FROM settings WHERE id=1')
  // Placeholder = what English visitors see today when the English box is left empty.
  const fallback=text=>translate('en',text)
  return <section className="panel stack admin-content welcome-settings"><h2>คำโปรยหน้าจอง</h2>
    <p className="muted">แสดงในแถบสีเขียวด้านบนของหน้าจองลาน (ใต้ RELAX · CONNECT · ENJOY และเหนือขั้นตอน 1–4) ช่องภาษาอังกฤษเว้นว่างได้ ระบบจะใช้คำแปลอัตโนมัติถ้ามี ไม่เช่นนั้นจะแสดงข้อความภาษาไทย</p>
    <ActionForm action={saveWelcome} className="stack">
      <fieldset className="welcome-field">
        <legend><label><input type="checkbox" name="titleEnabled" defaultChecked={!!s.welcome_title_enabled}/> แสดงหัวข้อใหญ่</label></legend>
        <div className="welcome-pair">
          <label>ภาษาไทย<input name="title" maxLength={160} defaultValue={s.welcome_title}/></label>
          <label>English<input name="titleEn" lang="en" maxLength={160} defaultValue={s.welcome_title_en} placeholder={fallback(s.welcome_title)}/></label>
        </div>
      </fieldset>
      <fieldset className="welcome-field">
        <legend><label><input type="checkbox" name="subtitleEnabled" defaultChecked={!!s.welcome_subtitle_enabled}/> แสดงข้อความรอง</label></legend>
        <div className="welcome-pair">
          <label>ภาษาไทย<input name="subtitle" maxLength={240} defaultValue={s.welcome_subtitle}/></label>
          <label>English<input name="subtitleEn" lang="en" maxLength={240} defaultValue={s.welcome_subtitle_en} placeholder={fallback(s.welcome_subtitle)}/></label>
        </div>
      </fieldset>
      <button className="button">บันทึกคำโปรย</button>
    </ActionForm>
  </section>
}
