import './customer-ui.css'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { ConfirmProvider } from './confirm-dialog'
import { I18nProvider } from './i18n'
import { HeroProvider } from './page-hero'
import { requestLanguage } from '../lib/request-language'
import { heroMedia } from '../lib/camp-options'
import { adminTranslations } from '../lib/admin-translations'

export async function CustomerLayout({children}) {
  // The banner is decoration: if the database is unreachable the page still renders with the plain green band.
  const [lang,hero] = await Promise.all([requestLanguage(),heroMedia().catch(() => null)])
  // Only English pages need the admin's English texts; if they cannot be read the page still shows the Thai ones.
  const extra = lang === 'en' ? await adminTranslations().catch(() => null) : null
  return <div className="customer-ui" lang={lang}>
    <I18nProvider lang={lang} extra={extra}><ConfirmProvider><HeroProvider media={hero}>{children}</HeroProvider></ConfirmProvider></I18nProvider>
  </div>
}
