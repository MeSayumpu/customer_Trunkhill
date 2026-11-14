import {mediaResponse} from '../../../lib/storage'
import { database } from '../../../lib/db'

export async function GET(request) {
  const revision = request.nextUrl.searchParams.get('v')
  if (!revision || !/^[a-f0-9-]{36}$/.test(revision)) return new Response(null,{status:404})
  const [[version]] = await database().execute('SELECT mime,content FROM plot_map_versions WHERE revision=? AND published_at IS NOT NULL',[revision])
  const [[legacy]] = version ? [[]] : await database().execute('SELECT mime,content FROM plot_map_background WHERE id=1 AND revision=?',[revision])
  const row = version || legacy
  if (!row?.mime) return new Response(null,{status:404})
  return mediaResponse(request,row.content,{
    'Content-Type':row.mime,
    'Cache-Control':'public, max-age=86400, immutable',
    'X-Content-Type-Options':'nosniff',
  })
}
