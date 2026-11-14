import './customer-ui.css'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { ConfirmProvider } from './confirm-dialog'
import { I18nProvider } from './i18n'
import { requestLanguage } from '../lib/request-language'

export async function CustomerLayout({children}) {
  const lang = await requestLanguage()
  return <div className="customer-ui" lang={lang}>
    <I18nProvider lang={lang}><ConfirmProvider>{children}</ConfirmProvider></I18nProvider>
  </div>
}
