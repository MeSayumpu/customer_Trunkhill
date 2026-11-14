import {database} from '../../lib/db'
import {PlotMapEditor} from './plot-map-editor'
import {wholeCampCode} from '../../lib/whole-camp'
import {mapElements} from '../../lib/plot-map-store'

export async function PlotMapSettings() {
  const db=database()
  const [[rows],[[background]],[[state]]]=await Promise.all([
    db.execute(`SELECT i.code,i.name,i.kind,i.zone,i.active,i.stock,m.x AS map_x,m.y AS map_y,m.shape_json AS map_shape FROM inventory i LEFT JOIN plot_map_positions m ON m.code=i.code WHERE i.kind IN ('plot','room') AND i.code<>? ORDER BY i.zone,i.code`,[wholeCampCode]),
    db.query('SELECT revision FROM plot_map_background WHERE id=1'),
    db.query('SELECT s.*,v.elements,v.mime FROM plot_map_state s LEFT JOIN plot_map_versions v ON v.revision=s.draft_revision WHERE s.id=1'),
  ])
  const elements=state.elements?(typeof state.elements==='string'?JSON.parse(state.elements):state.elements):mapElements(rows,background?.revision)
  const image=state.draft_revision?(state.mime?'/admin/plot-map-preview?v='+state.draft_revision:null):(background?'/api/plot-map-image?v='+background.revision:null)
  return <PlotMapEditor rows={rows} initialElements={elements} initialRevision={state.draft_revision} publishedRevision={state.published_revision} initialImage={image}/>
}
