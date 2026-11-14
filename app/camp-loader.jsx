'use client'

import { useI18n } from './i18n'

export function CampLoader({label}) {
  const {t} = useI18n()
  return <div className="camp-loader" role="status">
    <span className="camp-loader-icon" aria-hidden="true"><img src="/camp-logo-transparent.webp" alt="" width="58" height="37"/></span>
    <span>{label ?? t('กำลังโหลด…')}</span>
  </div>
}
