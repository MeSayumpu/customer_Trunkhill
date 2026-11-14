import {database} from '../../../../lib/db'
import {mediaResponse} from '../../../../lib/storage'
export async function GET(request,{params}){
 const {id}=await params
 if(!/^\d{1,10}$/.test(id))return new Response(null,{status:404})
 const [[row]]=await database().execute('SELECT mime,content FROM zone_media WHERE id=?',[id])
 if(!row)return new Response(null,{status:404})
 return mediaResponse(request,row.content,{'Content-Type':row.mime,'Cache-Control':'public, max-age=300'})
}
