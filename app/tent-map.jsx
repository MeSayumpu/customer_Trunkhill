'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { customerPlotShape, mapPosition, shapeCenter, shapePoints } from '../lib/plot-map'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'

const builtInMap = { src:'/camp-map.webp', ratio:565 / 324 }
const statusLabels = { unchecked:'กำลังตรวจสอบ', selected:'เลือกอยู่', available:'ว่าง', booked:'จองแล้ว' }
const tilt3d = 52
const spinLimit = 45
const zoomSteps = [1, 1.25, 1.5, 1.8, 2.2, 2.6]

const clampSpin = value => Math.max(-spinLimit, Math.min(spinLimit, Math.round(value / 15) * 15))
const radians = degrees => degrees * Math.PI / 180

export function plotStatus(row, counts, ready) {
  if (!ready) return 'unchecked'
  if (counts[row.code]) return 'selected'
  return Number(row.available) > 0 ? 'available' : 'booked'
}

/*
  The rental dome tent (the 600-baht model every plot uses) at a three-quarter angle: a tall dome with a dark
  top panel, a low sloping vestibule in front, a zipped door panel and trimmed pole sleeves.
  Colours come from CSS so status changes are a single attribute.
*/
export function TentGlyph({status = 'available', className = ''}) {
  return <svg className={'tent-glyph ' + className} data-status={status} viewBox="0 0 64 56" aria-hidden="true" focusable="false">
    <path className="tent-glyph-guy" d="M17.5 17 1 35M54 22 63.5 30"/>
    <path className="tent-glyph-front" d="M21 16C27 8 35 5.5 40 6C50 7 58 22 62 40L43 45.6 31.5 49.5Z"/>
    <path className="tent-glyph-side" d="M24 12.5C29 7.5 35.5 5.6 40 6C43.5 6.3 46.5 8.6 49 12.5L41 18C42.3 26 43 36 43 45.6L51.5 43C51.3 32 50.5 21 49 12.5L41 18C36.5 13.5 30 11.8 24 12.5Z"/>
    <path className="tent-glyph-flap" d="M2.5 44C8 32 13 22 17.5 17L10 50Z"/>
    <path className="tent-glyph-front" d="M17.5 17C20 12 25 11.5 27 16.5C29 23 30.2 30 30.5 37.5L31.5 49.5 10 50Z"/>
    <path className="tent-glyph-seam" d="M22.5 13.5 10 50M27 16.5C32 13 38 13.5 41 18"/>
    <path className="tent-glyph-flap" d="M30.6 25C30.5 22.8 31.6 21.6 33.5 21.6L38.6 21.8C40.3 21.9 41.2 23 41.4 24.8L43 45.6 31.5 49.5Z"/>
    <path className="tent-glyph-ridge" d="M17.5 17C20 12 25 11.5 27 16.5C29 23 30.2 30 30.5 37.5L31.5 49.5M30.6 25C30.5 22.8 31.6 21.6 33.5 21.6L38.6 21.8C40.3 21.9 41.2 23 41.4 24.8"/>
    <path className="tent-glyph-hem" d="M2.5 44 10 50 31.5 49.5 43 45.6 62 40"/>
  </svg>
}

// Every plot rents the same tent, so every tent is drawn the same size (percent of the field width).
const tentSize = 6


/*
  Projects the tilted field (and the tents standing on it) the same way CSS does, so the camera box
  can be shrunk to the visible picture: no empty band above the far edge and no sideways overflow.
  Coordinates are relative to the field centre; y points down and z towards the viewer.
*/
function fitCamera({width,ratio,tilt,turn,plots,mode}) {
  if (!width) return null
  const height = width / ratio
  const perspective = width * 2.2
  const slab = Math.min(20, Math.max(8, width * .014))
  const tiltRad = radians(tilt)
  const turnRad = radians(turn)
  const project = (x, y, z, scale) => {
    x *= scale; y *= scale; z *= scale
    const x1 = x * Math.cos(turnRad) - y * Math.sin(turnRad)
    const y1 = x * Math.sin(turnRad) + y * Math.cos(turnRad)
    const y2 = y1 * Math.cos(tiltRad) - z * Math.sin(tiltRad)
    const z2 = y1 * Math.sin(tiltRad) + z * Math.cos(tiltRad)
    const depth = perspective / (perspective - z2)
    return [x1 * depth, y2 * depth, depth]
  }
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([sx,sy]) => [
    [sx * width / 2, sy * height / 2, 0],
    [sx * width / 2, sy * height / 2, -slab],
  ])
  let scale = 1
  let bounds
  for (let pass = 0; pass < 4; pass++) {
    bounds = {minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity}
    const add = (x, y) => {
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y)
    }
    for (const [x,y,z] of corners) { const [px,py] = project(x, y, z, scale); add(px, py) }
    for (const plot of plots) {
      const [px,py,depth] = project((plot.x / 100 - .5) * width, (plot.y / 100 - .5) * height, 0, scale)
      const tentWidth = Math.max(24, plot.size / 100 * width) * scale * depth * 1.12
      const tentHeight = tentWidth * 56 / 64
      add(px - tentWidth / 2, py - tentHeight * (mode === '3d' ? 1.14 : .82))
      add(px + tentWidth / 2, py)
    }
    const spread = Math.max(bounds.maxX, -bounds.minX) * 2
    if (spread <= width * .97) break
    scale *= width * .97 / spread
  }
  const pad = mode === '3d' ? 14 : 8
  const top = pad - (bounds.minY + height / 2)
  return {
    perspective:Math.round(perspective),
    scale:Number(scale.toFixed(4)),
    top:Math.round(top),
    origin:Math.round(top + height / 2),
    height:Math.round(bounds.maxY - bounds.minY + pad * 2),
  }
}

function plotGeometry(row, mapVersion) {
  const shape = customerPlotShape(row, mapVersion)
  const position = row.map_x == null && shape ? shapeCenter(shape) : mapPosition(row)
  if (!position) return null
  return { shape, x:position[0], y:position[1], size:tentSize }
}

export function TentMap({rows, counts, ready, busy, onSelect, mapVersion, zone, large = false, onExpand, label = 'ผังลานกางเต็นท์'}) {
  const {t} = useI18n()
  const viewport = useRef(null)
  const camera = useRef(null)
  const centered = useRef(false)
  // Every visit opens on the flat top view at 100%; 3D, rotation and zoom are one tap away.
  const [mode,setMode] = useState('top')
  const [spin,setSpin] = useState(0)
  const [zoom,setZoom] = useState(1)
  const [ratio,setRatio] = useState(builtInMap.ratio)
  const [fieldWidth,setFieldWidth] = useState(0)
  const custom = Boolean(mapVersion)

  useEffect(() => {
    const element = camera.current
    if (!element) return
    // Whole pixels only: sub-pixel jitter would otherwise re-fit the camera on every frame.
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      setFieldWidth(previous => Math.abs(previous - next) < 1 ? previous : next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  },[])

  useEffect(() => { if (!custom) setRatio(builtInMap.ratio) },[custom])

  const plots = useMemo(() => rows.filter(row => row.kind !== 'gear' && !row.map_hidden).map(row => {
    const geometry = plotGeometry(row, mapVersion)
    if (!geometry) return null
    const status = plotStatus(row, counts, ready)
    return { row, ...geometry, status, dimmed:!!zone && zone !== row.zone && status !== 'selected' }
  }).filter(Boolean),[rows,counts,ready,mapVersion,zone])

  // The "free plots" figures count plots only; Trunkbox rooms drawn on the map are extra markers.
  const campPlots = plots.filter(plot => plot.row.kind !== 'room')
  const openCount = campPlots.filter(plot => plot.status === 'available').length

  // On phones the map starts zoomed in, so bring the bookable plots into view instead of the empty left edge.
  useEffect(() => {
    const element = viewport.current
    const key = zoom + ':' + ready
    if (!element || !plots.length || centered.current === key) return
    if (element.scrollWidth <= element.clientWidth + 1) return
    const focus = plots.filter(plot => plot.status === 'available' || plot.status === 'selected')
    const pool = focus.length ? focus : plots
    const x = pool.reduce((sum, plot) => sum + plot.x, 0) / pool.length
    const inset = element.clientWidth * .025
    const position = inset + (element.scrollWidth - inset * 2) * x / 100
    // Keep the plots clear of the floating zoom controls on the right edge.
    element.scrollLeft = Math.max(0, position - (element.clientWidth - 56) / 2)
    centered.current = key
  },[zoom,plots,ready])

  // Mouse drag pans the map (touch screens already scroll natively).
  const pan = useRef(null)
  const panned = useRef(false)
  function startPan(event) {
    panned.current = false
    const element = viewport.current
    if (event.pointerType !== 'mouse' || event.button !== 0 || !element) return
    if (element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1) return
    pan.current = {x:event.clientX, y:event.clientY, left:element.scrollLeft, top:element.scrollTop, id:event.pointerId, moved:false}
  }
  function movePan(event) {
    const state = pan.current
    const element = viewport.current
    if (!state || !element || event.pointerId !== state.id) return
    const dx = event.clientX - state.x, dy = event.clientY - state.y
    if (!state.moved) {
      if (Math.hypot(dx, dy) < 5) return
      state.moved = true
      element.dataset.dragging = ''
      try { element.setPointerCapture(event.pointerId) } catch {}
    }
    element.scrollLeft = state.left - dx
    element.scrollTop = state.top - dy
  }
  function endPan() {
    const state = pan.current
    pan.current = null
    if (!state?.moved) return
    panned.current = true
    delete viewport.current?.dataset.dragging
  }

  const tilt = mode === '3d' ? tilt3d : 0
  const turn = mode === '3d' ? spin : 0
  const view = useMemo(() => fitCamera({width:fieldWidth,ratio,tilt,turn,plots,mode}),[fieldWidth,ratio,tilt,turn,plots,mode])
  // The field is absolutely positioned inside a camera box sized to the projected picture,
  // so the untransformed field never creates scrollable overflow.
  const cameraStyle = view ? {
    height:view.height + 'px',
    perspective:view.perspective + 'px',
    perspectiveOrigin:`50% ${view.origin}px`,
  } : { aspectRatio:ratio }
  const fieldStyle = {
    aspectRatio:ratio,
    top:(view?.top ?? 0) + 'px',
    '--tilt':tilt + 'deg',
    '--spin':turn + 'deg',
    transform:`rotateX(${tilt}deg) rotateZ(${turn}deg) scale(${view?.scale ?? 1})`,
  }

  function changeZoom(step) {
    const index = zoomSteps.findIndex(value => value >= zoom - .01)
    const next = zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, (index < 0 ? 0 : index) + step))]
    setZoom(next)
  }

  return <div className="tent-map" data-mode={mode} data-large={large || undefined}>
    <div className="tent-map-toolbar">
      <ul className="tent-legend" role="list" aria-label={t('สถานะล็อก')}>
        {['available','selected','booked'].map(status => <li key={status}>{status === 'available' ? <span className="legend-plot" aria-hidden="true"/> : <TentGlyph status={status}/>}{t(statusLabels[status])}</li>)}
      </ul>
      <div className="segmented" role="group" aria-label={t('มุมมองผัง')}>
        <button type="button" aria-pressed={mode === '3d'} onClick={() => setMode('3d')}><CustomerIcon name="cube"/>3D</button>
        <button type="button" aria-pressed={mode === 'top'} onClick={() => setMode('top')}><CustomerIcon name="layers"/>{t('มุมบน')}</button>
      </div>
    </div>
    <div className="tent-frame">
    <div className="tent-float tent-float-start">
      {mode === '3d' && <div className="float-group" role="group" aria-label={t('หมุนผัง')}>
        <button type="button" aria-label={t('หมุนผังทวนเข็ม')} title={t('หมุนซ้าย')} disabled={spin <= -spinLimit} onClick={() => setSpin(value => clampSpin(value - 15))}><CustomerIcon name="rotateLeft"/></button>
        <button type="button" aria-label={t('หมุนผังตามเข็ม')} title={t('หมุนขวา')} disabled={spin >= spinLimit} onClick={() => setSpin(value => clampSpin(value + 15))}><CustomerIcon name="rotateRight"/></button>
      </div>}
    </div>
    <div className="tent-float tent-float-end">
      <div className="float-group float-group-column" role="group" aria-label={t('ซูมผัง')}>
        <button type="button" aria-label={t('ขยายผัง')} title={t('ซูมเข้า')} disabled={zoom >= zoomSteps.at(-1)} onClick={() => changeZoom(1)}><CustomerIcon name="zoomIn"/></button>
        <output className="zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label={t('ย่อผัง')} title={t('ซูมออก')} disabled={zoom <= zoomSteps[0]} onClick={() => changeZoom(-1)}><CustomerIcon name="zoomOut"/></button>
      </div>
      {onExpand && <div className="float-group"><button type="button" aria-label={t('เปิดผังเต็มจอ')} title={t('เต็มจอ')} onClick={onExpand}><CustomerIcon name="expand"/></button></div>}
    </div>
    <div ref={viewport} className="tent-viewport" tabIndex={0} aria-label={t(label) + (ready ? ' · ' + t('ว่าง {n} ล็อก',{n:openCount}) : '')}
      data-pannable={large || zoom > 1 || undefined} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}
      onClickCapture={event => {
        // A drag that moved the map must not also pick the tent under the cursor.
        if (!panned.current) return
        panned.current = false
        event.preventDefault()
        event.stopPropagation()
      }}>
      <div className="tent-stage" style={{width:zoom * 100 + '%','--zoom':zoom}}>
        <div ref={camera} className="tent-camera" style={cameraStyle}>
        <div className="tent-field" style={fieldStyle}>
          <span className="tent-slab tent-slab-front" aria-hidden="true"/>
          <span className="tent-slab tent-slab-left" aria-hidden="true"/>
          <span className="tent-slab tent-slab-right" aria-hidden="true"/>
          <div className="tent-ground" aria-hidden="true" data-built-in={!custom || undefined}>
            {custom && <img src={'/api/plot-map-image?v=' + mapVersion} alt="" draggable={false}
              onLoad={event => {
                const {naturalWidth,naturalHeight} = event.currentTarget
                if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight)
              }}/>}
          </div>
          {/* One SVG for every plot outline: a full-field layer per plot exhausts memory on phones (iOS Safari crashes). */}
          <svg className="tent-pad" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {plots.map(({row,shape,status,dimmed}) => shape && <polygon key={row.code} data-status={status} data-dimmed={dimmed || undefined}
              points={shapePoints(shape).map(point => point.join(',')).join(' ')} vectorEffect="non-scaling-stroke"
              onClick={!busy && ready && status !== 'booked' ? () => onSelect(row, status === 'selected' ? 0 : 1) : undefined}/>)}
          </svg>
          {plots.map(({row,x,y,size,status,dimmed}) => {
            const selected = status === 'selected'
            const canSelect = !busy && ready && status !== 'booked'
            const activate = () => onSelect(row, selected ? 0 : 1)
            // A Trunkbox room is tagged with its name (TB01) and stands a cabin instead of a tent.
            const room = row.kind === 'room'
            const tag = room ? t(row.name) : row.code
            const title = tag + ' · ' + t(statusLabels[status]) + (row.detail ? ' · ' + row.detail : '')
            // Only taken plots (picked by this guest or already booked) stand a tent; a free plot is its outline and code tag, to keep the map calm.
            const pitched = selected || status === 'booked'
            return <div className="tent-plot" key={row.code} data-status={status} data-kind={room ? 'room' : undefined} data-dimmed={dimmed || undefined}>
              {pitched && <span className="tent-shadow" style={{left:x + '%',top:y + '%',width:size * 1.15 + '%'}} aria-hidden="true"/>}
              <button type="button" className="tent" style={{left:x + '%',top:y + '%',width:size + '%'}}
                aria-pressed={selected} aria-label={title} title={title} disabled={!canSelect} onClick={activate}>
                {pitched && (room ? <span className="tent-cabin" aria-hidden="true"><CustomerIcon name="cabin"/></span> : <TentGlyph status={status}/>)}
                <span className="tent-code">{tag}</span>
                {selected && <span className="tent-check" aria-hidden="true"><CustomerIcon name="tick"/></span>}
              </button>
            </div>
          })}
        </div>
        </div>
      </div>
    </div>
    </div>
    <p className="tent-map-hint">
      <CustomerIcon name="tent"/>{ready ? t('แตะล็อกเพื่อเลือก · ว่าง {open} จาก {n} ล็อก',{open:openCount,n:campPlots.length}) : t('กำลังตรวจสอบล็อกว่าง…')}
    </p>
  </div>
}

/* Card grid used when the plots have no map position yet. */
export function TentList({rows, counts, ready, busy, onSelect}) {
  const {t} = useI18n()
  return <ul className="tent-list" role="list">
    {rows.map(row => {
      const status = plotStatus(row, counts, ready)
      const selected = status === 'selected'
      return <li key={row.code}>
        <button type="button" className="tent-card" data-status={status} aria-pressed={selected}
          disabled={busy || !ready || status === 'booked'} onClick={() => onSelect(row, selected ? 0 : 1)}>
          <TentGlyph status={status}/>
          <strong>{row.name}</strong>
          <small>{t(statusLabels[status])}</small>
          {selected && <span className="tent-check" aria-hidden="true"><CustomerIcon name="tick"/></span>}
        </button>
      </li>
    })}
  </ul>
}
