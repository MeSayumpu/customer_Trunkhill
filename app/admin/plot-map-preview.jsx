'use client'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {PlotMap} from '../plot-map'

export function MapPreview({rows,image,onClose}) {
  const dialog=useRef(null),host=useRef(null)
  const [device,setDevice]=useState('mobile'),[mount,setMount]=useState(null),[width,setWidth]=useState(800)
  const [counts,setCounts]=useState({}),[zoom,setZoom]=useState(1)
  useEffect(()=>{dialog.current.showModal();const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(host.current);return()=>observer.disconnect()},[])
  const frameWidth=device==='mobile'?390:1100,frameHeight=device==='mobile'?720:700,scale=Math.min(1,width/frameWidth)
  function load(event) {
    const doc=event.currentTarget.contentDocument
    document.querySelectorAll('link[rel=stylesheet],style').forEach(node=>doc.head.appendChild(node.cloneNode(true)))
    doc.body.classList.add('admin-ui')
    doc.body.style.fontFamily=getComputedStyle(dialog.current).fontFamily
    setMount(doc.body)
  }
  return <dialog className="dialog map-preview-dialog" ref={dialog} aria-labelledby="map-preview-title" onCancel={e=>{e.preventDefault();onClose()}}>
    <header className="map-preview-header"><div><h2 id="map-preview-title">พรีวิวหน้าผู้จอง</h2><p className="small muted">ใช้รูปและพื้นที่ที่กำลังแก้ไข · สถานะว่างเป็นตัวอย่าง ไม่ใช่ยอดจองจริง</p></div><button className="button secondary" onClick={onClose} aria-label="ปิดพรีวิว">×</button></header>
    <div className="actions"><button type="button" className={'button'+(device==='mobile'?'':' secondary')} onClick={()=>setDevice('mobile')}>มือถือ · 390px</button><button type="button" className={'button'+(device==='desktop'?'':' secondary')} onClick={()=>setDevice('desktop')}>คอมพิวเตอร์ · 1100px</button></div>
    <div className="map-preview-host" ref={host}><div style={{width:frameWidth*scale,height:frameHeight*scale,margin:'auto'}}><iframe title={'ตัวอย่างหน้าผู้จอง '+device} srcDoc={'<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="margin:0;background:#f5f7f2"></body></html>'} onLoad={load} style={{width:frameWidth,height:frameHeight,transform:`scale(${scale})`,transformOrigin:'top left',border:'1px solid #d7e1d8',borderRadius:16}}/></div></div>
    {mount&&createPortal(<main style={{padding:16,maxWidth:1050,margin:'auto'}}><h2 style={{marginBottom:8}}>เลือกล็อกบนผังลาน</h2><p style={{fontSize:13,marginBottom:16}}>ลองคลิกพื้นที่เพื่อเลือก / ยกเลิกการเลือก</p><div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}><button onClick={()=>setZoom(Math.max(1,zoom-.25))} aria-label="ย่อพรีวิว">−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(3,zoom+.25))} aria-label="ขยายพรีวิว">+</button></div><PlotMap rows={rows} ready counts={counts} backgroundSrc={image} zoom={zoom} onSelect={(row,value)=>setCounts({...counts,[row.code]:value})}/><p style={{marginTop:12}}>เลือกแล้ว: {Object.keys(counts).filter(code=>counts[code]).join(', ')||'ยังไม่ได้เลือก'}</p></main>,mount)}
  </dialog>
}
