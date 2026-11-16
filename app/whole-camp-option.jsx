'use client'

import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'

export function WholeCampOption({ tiers, status, available, onRetry }) {
  const {t,money} = useI18n()
  const maxGuests = tiers.at(-1)?.maxGuests
  return <section className="panel stack option-panel whole-camp-option" aria-labelledby="whole-camp-title">
    <header className="option-head">
      <span className="option-head-icon" aria-hidden="true"><CustomerIcon name="tents"/></span>
      <div><h2 id="whole-camp-title">{t('เหมาลาน')}</h2>
        <p className="small muted">{maxGuests ? t('จองลานแบบส่วนตัวสำหรับผู้เข้าพักรวม 1–{n} คน เด็กและผู้สูงอายุฟรี ต้องว่างครบทุกคืนที่เลือก',{n:maxGuests}) : t('จองลานแบบส่วนตัว ต้องว่างครบทุกคืนที่เลือก')}</p></div>
    </header>
    {status && <p className={'notice' + (available ? ' success' : ' error')} role="status"><CustomerIcon name={available ? 'check' : 'warning'}/>{status}</p>}
    {onRetry && <div><button type="button" className="button secondary" onClick={onRetry}>{t('ตรวจสอบอีกครั้ง')}</button></div>}
    {tiers.length > 0 && <div className="table-scroll">
      <table className="whole-camp-rates">
        <caption>{t('ราคาเหมาลานต่อคืนและหน่วยไฟฟรีต่อกลุ่ม')}</caption>
        <thead><tr><th scope="col">{t('ผู้ใหญ่')}</th><th scope="col">{t('จ.–พฤ.')}</th><th scope="col">{t('ศ.–อา.')}</th><th scope="col">{t('ไฟฟรี')}</th></tr></thead>
        <tbody>{tiers.map((tier,index) => <tr key={tier.maxGuests}>
          <th scope="row">{t('{from}–{to} คน',{from:index ? tiers[index - 1].maxGuests + 1 : 1,to:tier.maxGuests})}</th>
          <td>{money(tier.weekdayPrice)}</td><td>{money(tier.weekendPrice)}</td><td>{t('{n} หน่วย',{n:tier.freeUnits})}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
