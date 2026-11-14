'use client'
import {prepareUploads} from '../upload-files'
import {useEffect,useRef,useState,useTransition} from 'react'
import {MapBackground,PlotMap} from '../plot-map'
import {readMapShape,shapeCenter} from '../../lib/plot-map'
import {savePlotMap} from './plot-map-actions'
import {AdminIcon} from './admin-icon'
import {MapPreview} from './plot-map-preview'
import {useConfirm} from '../confirm-dialog'

const round=n=>Math.round(n*100)/100
const clamp=n=>Math.max(0,Math.min(100,round(n)))
export function PlotMapEditor({rows,initialElements,initialRevision,publishedRevision,initialImage}) {
  const [elements,setElements]=useState(initialElements),[selected,setSelected]=useState(rows[0]?.code||'')
  const [revision,setRevision]=useState(initialRevision),[published,setPublished]=useState(publishedRevision)
  const [image,setImage]=useState(initialImage),[file,setFile]=useState(null),[dirty,setDirty]=useState(false)
  const [zoom,setZoom]=useState(1),[drawing,setDrawing]=useState(false),[points,setPoints]=useState([]),[vertex,setVertex]=useState(null)
  const [past,setPast]=useState([]),[future,setFuture]=useState([]),[preview,setPreview]=useState(false),[confirm,setConfirm]=useState(false)
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[pending,startTransition]=useTransition()
  const canvas=useRef(null),viewport=useRef(null),drag=useRef(null),objectUrl=useRef(null),confirmDialog=useRef(null),saving=useRef(false)
  useEffect(()=>()=>{if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)},[])
  useEffect(()=>{const warn=e=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
  useEffect(()=>{if(confirm)confirmDialog.current.showModal()},[confirm])
  const shape=elements[selected],invalid=Object.entries(elements).find(([,s])=>s&&!readMapShape(JSON.stringify(s)))
  function remember() {setPast(previous=>[...previous.slice(-49),elements]);setFuture([]);setDirty(true);setMessage('');setError('')}
  function replace(next) {remember();setElements(next)}
  const confirmRemoval=useConfirm()
  const ask=(title,message,confirmLabel,items=[])=>confirmRemoval({title,message,items,confirmLabel,cancelLabel:'ยกเลิก'})
  function choose(code) {if(drawing||pending)return;setSelected(code);setVertex(null)}
  function location(event) {const rect=canvas.current.getBoundingClientRect();return [clamp((event.clientX-rect.left)/rect.width*100),clamp((event.clientY-rect.top)/rect.height*100)]}
  function startDrag(event,code,index=null) {
    if(drawing||pending||event.button!==0)return
    event.preventDefault();event.stopPropagation();choose(code);setVertex(index)
    drag.current={kind:index===null?'shape':'vertex',code,index,start:location(event),points:elements[code].points}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event) {
    const d=drag.current;if(!d)return
    if(d.kind==='pan'){viewport.current.scrollLeft=d.left-(event.clientX-d.x);viewport.current.scrollTop=d.top-(event.clientY-d.y);return}
    const point=location(event)
    if (!d.remembered) {
      if (point[0]===d.start[0]&&point[1]===d.start[1]) return
      remember();d.remembered=true
    }
    let next
    if(d.kind==='vertex')next=d.points.map((p,i)=>i===d.index?point:p)
    else {
      const xs=d.points.map(p=>p[0]),ys=d.points.map(p=>p[1])
      const dx=Math.max(-Math.min(...xs),Math.min(100-Math.max(...xs),point[0]-d.start[0]))
      const dy=Math.max(-Math.min(...ys),Math.min(100-Math.max(...ys),point[1]-d.start[1]))
      next=d.points.map(([x,y])=>[round(x+dx),round(y+dy)])
    }
    setElements(previous=>({...previous,[d.code]:{type:'polygon',points:next}}))
  }
  function finishDrag(){drag.current=null}
  function backgroundDown(event) {
    if(event.button!==0||pending)return
    if(drawing){if(points.length<24)setPoints([...points,location(event)]);return}
    drag.current={kind:'pan',x:event.clientX,y:event.clientY,left:viewport.current.scrollLeft,top:viewport.current.scrollTop}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function finishDrawing() {
    const next={type:'polygon',points}
    if(!readMapShape(JSON.stringify(next))){setError('วางอย่างน้อย 3 จุดให้เกิดพื้นที่ก่อนจบการวาด');return}
    replace({...elements,[selected]:next});setDrawing(false);setPoints([])
  }
  function keyboard(event,code,index=null) {
    if(pending||drawing)return
    const amount=event.shiftKey?1:.2,delta={ArrowLeft:[-amount,0],ArrowRight:[amount,0],ArrowUp:[0,-amount],ArrowDown:[0,amount]}[event.key]
    if(!delta)return
    event.preventDefault();event.stopPropagation();const s=elements[code]
    const moved=s.points.map((p,i)=>index===null||i===index?p.map((n,axis)=>clamp(n+delta[axis])):p)
    replace({...elements,[code]:{type:'polygon',points:moved}})
  }
  function undo(){if(!past.length)return;setFuture([elements,...future]);setElements(past.at(-1));setPast(past.slice(0,-1));setDirty(true);setVertex(null)}
  function redo(){if(!future.length)return;setPast([...past,elements]);setElements(future[0]);setFuture(future.slice(1));setDirty(true);setVertex(null)}
  function changeImage(event) {
    const next=event.target.files?.[0];if(!next)return
    if(!['image/jpeg','image/png','image/webp'].includes(next.type)){setError('เลือก JPG, PNG หรือ WebP');event.target.value='';return}
    if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)
    objectUrl.current=URL.createObjectURL(next);setImage(objectUrl.current);setFile(next);setDirty(true);setError('');setMessage('เปลี่ยนรูปแล้ว ตรวจตำแหน่งล็อกให้ตรงกับรูปก่อน Publish')
  }
  function save(operation) {
    if(saving.current||drawing||invalid)return
    saving.current=true;setError('');setMessage('')
    const form=new FormData();form.set('operation',operation);form.set('base',revision||'');form.set('elements',JSON.stringify(elements));if(file)form.set('image',file)
    startTransition(async()=>{
      try {
        await prepareUploads(form)
        const result=await savePlotMap(form)
        if(result.error){setError(result.error);return}
        setRevision(result.revision);if(result.published)setPublished(result.revision)
        setImage(result.custom?'/admin/plot-map-preview?v='+result.revision:null);setFile(null);setDirty(false)
        setMessage(result.published?'Publish แล้ว ผู้จองจะเห็นผังใหม่นี้เมื่อโหลดข้อมูลใหม่':'บันทึก Draft แล้ว ผังของผู้จองยังไม่เปลี่ยน')
        if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=null}
      } catch(error) {setError(error.message||'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง')}
      finally {saving.current=false;setConfirm(false);confirmDialog.current?.close()}
    })
  }
  const previewRows=rows.filter(row=>row.active).map(row=>({...row,available:row.stock,map_hidden:!elements[row.code],map_shape:elements[row.code]?JSON.stringify(elements[row.code]):null,map_x:elements[row.code]?shapeCenter(elements[row.code])[0]:null,map_y:elements[row.code]?shapeCenter(elements[row.code])[1]:null}))
  return <section className="map-studio stack">
    <header className="map-studio-header"><div><span className="eyebrow">MAP STUDIO</span><h2>จัดการผังลาน</h2><p className="small muted">แก้ไขได้หลายล็อก แล้วบันทึกทั้งหมดพร้อมกัน</p></div><span className={'admin-status '+(!dirty&&revision&&revision===published?'confirmed':'pending')}>{dirty?'มีการแก้ไขที่ยังไม่บันทึก':revision&&revision===published?'เผยแพร่แล้ว':'Draft · ยังไม่เผยแพร่'}</span></header>
    <div className="map-studio-toolbar">
      <div className="actions"><button type="button" className="button secondary" disabled={pending||drawing||!past.length} onClick={undo}>↶ ย้อนกลับ</button><button type="button" className="button secondary" disabled={pending||drawing||!future.length} onClick={redo}>↷ ทำซ้ำ</button><span className="map-zoom-controls"><button type="button" aria-label="ย่อผัง" onClick={()=>setZoom(z=>Math.max(.5,round(z-.25)))} disabled={zoom<=.5}>−</button><output>{Math.round(zoom*100)}%</output><button type="button" aria-label="ขยายผัง" onClick={()=>setZoom(z=>Math.min(4,round(z+.25)))} disabled={zoom>=4}>+</button></span><button type="button" className="button secondary" onClick={()=>{setZoom(1);viewport.current.scrollTo(0,0)}}>พอดีจอ</button></div>
      <div className="actions"><button type="button" className="button secondary" disabled={drawing||!!invalid} onClick={()=>setPreview(true)}>พรีวิว</button><button type="button" className="button secondary" onClick={()=>save('draft')} disabled={pending||drawing||!!invalid}><AdminIcon name="save"/>{pending?'กำลังบันทึก…':'บันทึก Draft'}</button><button type="button" className="button" onClick={()=>setConfirm(true)} disabled={pending||drawing||!!invalid}>Publish</button></div>
    </div>
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}{invalid&&<p className="notice error">ขอบเขต {invalid[0]} ยังไม่ถูกต้อง กรุณาขยับจุดให้มีพื้นที่ หรือย้อนกลับก่อนบันทึก</p>}
    <div className="map-studio-workspace"><aside className="map-studio-sidebar panel stack">
      <label className="map-image-upload"><AdminIcon name="zoneMedia"/><strong>เปลี่ยนรูปผังลาน</strong><small>JPG / PNG / WebP</small><input aria-label="รูปผังลาน" type="file" accept="image/jpeg,image/png,image/webp" onChange={changeImage} disabled={pending}/></label>
      <div className="map-element-heading"><h3>ล็อกและห้องพัก</h3><span className="small muted">{Object.values(elements).filter(Boolean).length} พื้นที่</span></div>
      <div className="map-element-list" aria-label="รายการพื้นที่บนผัง">{rows.map(row=><button key={row.code} type="button" data-selected={row.code===selected} onClick={()=>choose(row.code)} disabled={drawing||pending}><span><strong>{row.code}</strong><small>{row.name}{!row.active?' · ปิดจอง':''}</small></span><span className="small">{elements[row.code]?'บนผัง':'ยังไม่วาง'}</span></button>)}</div>
      <p className="small muted">ลบพื้นที่ออกจากผังได้โดยไม่ลบข้อมูลล็อกหรือรายการจอง ล็อกที่ไม่มีพื้นที่ยังแสดงในรายการเลือกล็อก</p>
    </aside><div className="map-studio-main">
      <div className="map-element-tools"><strong>{selected||'ยังไม่มีล็อก'}</strong>
        {!drawing?<><button type="button" className="button secondary" disabled={!selected||pending} onClick={async()=>{if(shape&&!(await ask('วาดขอบเขตใหม่แทนของเดิม?','เมื่อจบการวาด ขอบเขตเดิมของ '+selected+' จะถูกแทนที่ (กด ↶ ย้อนกลับได้ก่อนบันทึก)','เริ่มวาดใหม่',[selected+' · '+shape.points.length+' จุด'])))return;setDrawing(true);setPoints([]);setVertex(null);setError('')}}>{shape?'วาดขอบเขตใหม่':'วาดรูปหลายเหลี่ยม'}</button>
          <button type="button" className="button secondary" disabled={!shape||shape?.points.length>=24||pending} onClick={()=>{const p=shape.points;let best=0;for(let i=1;i<p.length;i++)if(Math.hypot(p[i][0]-p[(i+1)%p.length][0],p[i][1]-p[(i+1)%p.length][1])>Math.hypot(p[best][0]-p[(best+1)%p.length][0],p[best][1]-p[(best+1)%p.length][1]))best=i;const middle=p[best].map((n,a)=>round((n+p[(best+1)%p.length][a])/2));replace({...elements,[selected]:{type:'polygon',points:[...p.slice(0,best+1),middle,...p.slice(best+1)]}});setVertex(best+1)}}>เพิ่มจุด</button>
          <button type="button" className="button secondary" disabled={vertex===null||!shape||shape?.points.length<=3||pending} onClick={async()=>{if(!(await ask('ลบจุดนี้ออกจากขอบเขต?','รูปร่างของ '+selected+' จะเปลี่ยนทันที (กด ↶ ย้อนกลับได้ก่อนบันทึก)','ลบจุด',['จุดที่ '+(vertex+1)+' ของ '+selected])))return;replace({...elements,[selected]:{type:'polygon',points:shape.points.filter((_,i)=>i!==vertex)}});setVertex(null)}}>ลบจุด</button>
          <button type="button" className="button secondary admin-cancel" disabled={!shape||pending} onClick={async()=>{if(!(await ask('ลบพื้นที่ '+selected+' ออกจากผัง?','ล็อกและรายการจองยังอยู่ แต่จะไม่แสดงบนผังลานจนกว่าจะวาดใหม่ (กด ↶ ย้อนกลับได้ก่อนบันทึก)','ลบพื้นที่',[selected])))return;replace({...elements,[selected]:null});setVertex(null)}}>ลบพื้นที่</button></>:<><span className="small">{points.length}/24 จุด</span><button type="button" className="button" disabled={points.length<3} onClick={finishDrawing}>จบการวาด</button><button type="button" className="button secondary" disabled={!points.length} onClick={()=>setPoints(points.slice(0,-1))}>ย้อนจุด</button><button type="button" className="button secondary" onClick={async()=>{if(points.length&&!(await ask('เลิกวาดและทิ้งจุดที่วางไว้?','จุดที่วางแล้วทั้งหมดจะหายไป ขอบเขตเดิมยังคงอยู่','ทิ้งจุดที่วาด',[points.length+' จุด'])))return;setDrawing(false);setPoints([])}}>เลิกวาด</button></>}
      </div>
      <p className="map-instructions">{drawing?'คลิกตามมุมพื้นที่อย่างน้อย 3 จุด แล้วกด “จบการวาด”':'คลิกพื้นที่เพื่อเลือก · ลากพื้นที่เพื่อย้าย · ลากจุดเพื่อปรับขอบ · ลากพื้นว่างเพื่อเลื่อนภาพ · ใช้ปุ่มลูกศรขยับพื้นที่หรือจุดที่โฟกัส'}</p>
      <div className="map-studio-viewport" ref={viewport}>
        <div ref={canvas} className="plot-map-canvas map-edit-canvas" style={{width:zoom*100+'%'}}>
          <MapBackground src={image}/>
          <svg className="map-edit-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
            <rect width="100" height="100" fill="transparent" onPointerDown={backgroundDown}/>
            {!drawing&&rows.filter(row=>elements[row.code]).map(row=><polygon key={row.code} points={elements[row.code].points.map(p=>p.join(',')).join(' ')} className={row.code===selected?'selected':''} vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={'พื้นที่ '+row.code} aria-pressed={row.code===selected} onFocus={()=>choose(row.code)} onClick={()=>choose(row.code)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(row.code)}else keyboard(e,row.code)}} onPointerDown={e=>startDrag(e,row.code)}/>)}
            {drawing&&<polyline points={points.map(p=>p.join(',')).join(' ')} fill="#c8dfdd77" stroke="#087f8c" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
          </svg>
          {rows.filter(row=>elements[row.code]&&(!drawing||row.code!==selected)).map(row=>{const center=shapeCenter(elements[row.code]);return <span className="map-edit-label" data-selected={row.code===selected} style={{left:center[0]+'%',top:center[1]+'%'}} key={row.code}>{row.code}</span>})}
          {(drawing?points:shape?.points||[]).map((point,index)=><button key={index} type="button" className="map-edit-vertex" data-selected={vertex===index} style={{left:point[0]+'%',top:point[1]+'%'}} aria-label={'จุดที่ '+(index+1)+' ของ '+selected} onFocus={()=>setVertex(index)} onPointerDown={e=>startDrag(e,selected,index)} onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onKeyDown={e=>keyboard(e,selected,index)} disabled={drawing||pending}>{index+1}</button>)}
        </div>
      </div>
    </div></div>
    {preview&&<MapPreview rows={previewRows} image={image} onClose={()=>setPreview(false)}/>}
    <dialog className="dialog map-publish-dialog" ref={confirmDialog} aria-labelledby="map-publish-title" onCancel={e=>{e.preventDefault();if(!pending){confirmDialog.current.close();setConfirm(false)}}}>
      <h2 id="map-publish-title">เผยแพร่ผังนี้ให้ผู้จอง?</h2><p>รูปและพื้นที่ทั้งหมดในตัวแก้ไขจะถูกบันทึกและ Publish พร้อมกัน ผู้จองจะเห็นผังนี้เมื่อโหลดข้อมูลใหม่</p><p className="small muted">หากยังไม่พร้อม ให้เลือกบันทึก Draft แทน</p><div className="actions"><button type="button" className="button secondary" disabled={pending} onClick={()=>{confirmDialog.current.close();setConfirm(false)}}>กลับไปตรวจสอบ</button><button type="button" className="button" disabled={pending} onClick={()=>save('publish')}>{pending?'กำลังเผยแพร่…':'ยืนยัน Publish'}</button></div>
    </dialog>
  </section>
}
