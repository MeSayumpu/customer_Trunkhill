import { CampLoader } from './camp-loader'
import { LoadingRescue } from './loading-rescue'
import { translate } from '../lib/i18n'
import { requestLanguage } from '../lib/request-language'

export default async function Loading() {
  const lang = await requestLanguage()
  return <div className="camp-home camp-loading-screen" lang={lang}><CampLoader label={translate(lang,'กำลังโหลด…')}/>
    <LoadingRescue note={translate(lang,'หน้านี้ใช้เวลาโหลดนานกว่าปกติ')} label={translate(lang,'โหลดใหม่')}/></div>
}
