import { database } from './db'
import { customerPlotShape, mapPosition, shapeCenter, shapePoints } from './plot-map'

export function mapElements(rows,version) {
  return Object.fromEntries(rows.map(row=>{
    const shape=customerPlotShape(row,version)
    if(shape)return [row.code,{type:'polygon',points:shapePoints(shape).map(p=>p.map(n=>Math.round(n*100)/100))}]
    const position=mapPosition(row)
    if(!position)return [row.code,null]
    const [x,y]=position
    return [row.code,{type:'polygon',points:[[x-3,y-3],[x+3,y-3],[x+3,y+3],[x-3,y+3]].map(p=>p.map(n=>Math.max(0,Math.min(100,n))))}]
  }))
}
export function applyMap(rows,map) {
  if(!map)return rows
  const elements=typeof map.elements==='string'?JSON.parse(map.elements):map.elements
  return rows.map(row=>{
    const shape=elements[row.code]
    const center=shape?shapeCenter(shape):[null,null]
    return {...row,map_shape:shape?JSON.stringify(shape):null,map_x:center[0],map_y:center[1],map_hidden:!shape}
  })
}
export async function publishedMap(connection=database()) {
  const [[map]]=await connection.query(`SELECT v.revision,v.elements,v.mime FROM plot_map_state s JOIN plot_map_versions v ON v.revision=s.published_revision WHERE s.id=1`)
  return map||null
}
