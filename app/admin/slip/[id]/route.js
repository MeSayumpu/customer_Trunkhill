import {mediaResponse} from '../../../../lib/storage'
import { isStaff } from '../../../../lib/auth'
import { database } from '../../../../lib/db'

export async function GET(request,{params}) {
  if (!(await isStaff())) return new Response(null,{status:404})
  const {id} = await params
  const [[row]] = await database().execute('SELECT mime,slip FROM booking_payments WHERE booking=?',[id])
  if (!row?.slip) return new Response(null,{status:404})
  const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}
  return mediaResponse(request,row.slip,{
    'Content-Type':row.mime,
    'Content-Disposition':(row.mime === 'application/pdf' && request.nextUrl.searchParams.get('preview') !== '1' ? 'attachment' : 'inline') + '; filename="slip.' + extensions[row.mime] + '"',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  })
}
