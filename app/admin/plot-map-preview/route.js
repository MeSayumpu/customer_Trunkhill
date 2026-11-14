import {mediaResponse} from '../../../lib/storage'
import {isAdmin} from '../../../lib/auth'
import {database} from '../../../lib/db'
export async function GET(request) {
  if(!(await isAdmin()))return new Response(null,{status:403})
  const revision=request.nextUrl.searchParams.get('v')
  if(!revision||!/^[a-f0-9-]{36}$/.test(revision))return new Response(null,{status:404})
  const [[row]]=await database().execute('SELECT mime,content FROM plot_map_versions WHERE revision=?',[revision])
  if(!row?.mime)return new Response(null,{status:404})
  return mediaResponse(request,row.content,{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
}
