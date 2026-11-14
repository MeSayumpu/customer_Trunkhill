import {isAdmin} from '../../../lib/auth'
import {transaction} from '../../../lib/db'
import {measureSystem,storageUsage,lockStorage} from '../../../lib/storage'
export async function GET(){
 if(!await isAdmin())return new Response(null,{status:403})
 await measureSystem()
 const usage=await transaction(async db=>{await lockStorage(db);return storageUsage(db,true)})
 return Response.json(usage,{headers:{'Cache-Control':'no-store'}})
}
