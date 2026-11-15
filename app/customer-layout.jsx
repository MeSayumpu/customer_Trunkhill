import './customer-ui.css'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { ConfirmProvider } from './confirm-dialog'
import { I18nProvider } from './i18n'
import { HeroProvider } from './page-hero'
import { requestLanguage } from '../lib/request-language'
import { heroMedia } from '../lib/camp-options'

export async function CustomerLayout({children}) {
  // The banner is decoration: if the database is unreachable the page still renders with the plain green band.
  const [lang,hero] = await Promise.all([requestLanguage(),heroMedia().catch(() => null)])
  return <div className="customer-ui" lang={lang}>
    <I18nProvider lang={lang}><ConfirmProvider><HeroProvider media={hero}>{children}</HeroProvider></ConfirmProvider></I18nProvider>
  </div>
}
