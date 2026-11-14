import {database} from '../../../../lib/db'
import {isAdmin} from '../../../../lib/auth'
import {mediaResponse} from '../../../../lib/storage'
export async function GET(request,{params}){
 const {id}=await params
 if(!/^\d{1,10}$/.test(id))return new Response(null,{status:404})
 const [[row]]=await database().execute('SELECT g.mime,g.content,i.active FROM inventory_gallery g JOIN inventory i ON i.code=g.code WHERE g.id=?',[id])
 if(!row||(!row.active&&!(await isAdmin())))return new Response(null,{status:404})
 return mediaResponse(request,row.content,{'Content-Type':row.mime,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'})
}
