import './admin.css'
import './admin-theme.css'
import './feedback.css'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { ConfirmProvider } from '../confirm-dialog'

export default function AdminLayout({children}) {
  return <div className="admin-ui"><ConfirmProvider variant="admin">{children}</ConfirmProvider></div>
}
