import { cookies, headers } from 'next/headers'
import { languageCookie, pickLanguage, translate } from './i18n'

// Language for the current request (server components, route handlers and actions).
export async function requestLanguage() {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()])
  return pickLanguage(cookieStore.get(languageCookie)?.value, headerList.get('accept-language') || '')
}

export async function pageMetadata(title) {
  const lang = await requestLanguage()
  return {
    title:translate(lang,title) + ' | Trunkhill Campfield',
    description:translate(lang,'ตรวจสอบลานว่างและจองอุปกรณ์สำหรับการเข้าพักที่ Trunkhill Campfield'),
  }
}
