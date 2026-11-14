import { CampError } from './camp'
import {StorageError} from './storage'
import { translateMessage } from './i18n'
import { requestLanguage } from './request-language'

async function errorResponse(message, status) {
  const lang = await requestLanguage().catch(() => 'th')
  return Response.json({ error: translateMessage(lang, message) }, { status })
}

export async function api(work) {
  try {
    return Response.json(await work(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CampError || error instanceof StorageError) return errorResponse(error.message, error.status)
    if (error instanceof SyntaxError) return errorResponse('ข้อมูลไม่ถูกต้อง', 400)
    console.error('Camp request failed', error.code || error.name)
    return errorResponse('ระบบขัดข้อง กรุณาลองใหม่', 503)
  }
}
