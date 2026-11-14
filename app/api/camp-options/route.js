import {campOptions,campZones} from '../../../lib/camp-options'
export const dynamic='force-dynamic'
export async function GET(){return Response.json({...await campOptions(),zones:await campZones(undefined,true)},{headers:{'Cache-Control':'no-store'}})}
