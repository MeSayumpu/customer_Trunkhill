'use client'

import { CustomerIcon } from './customer-icon'

import { useState } from 'react'
import { useI18n } from './i18n'
import { isRentalStay, isTent, tentCodes } from '../lib/rentals'
import { PagedItems } from './paged-items'
import { useMobileScreen } from './use-mobile-screen'

const photos = {
  'SNOW-PEAK': [176, 132],
  'LANDNEST-DOME': [176, 196],
  'VAULT-TARP': [176, 255],
  'LANDNEST-SHELTER': [176, 314],
  LANDLOCK: [176, 375],
  'SNOW-PEAK-TARP': [176, 435],
  TRUNKBOX: [176, 496],
  BEDDING: [614, 127],
  'SLEEPING-BAG': [614, 170],
  'CAMP-TABLE': [614, 221],
  'CAMP-CHAIR': [614, 272],
  EXTENSION: [614, 329],
  'LED-LIGHT': [614, 384],
  FAN: [614, 438],
  'AIR-CONDITIONER': [614, 492],
}

function RentalPhoto({ row }) {
  if (row.has_photo) return <img className="rental-photo rental-uploaded-photo" src={'/admin/inventory-photo/' + row.code}
    alt="" width="66" height="40" loading="lazy"/>
  const photo = photos[row.code]
  if (!photo) return <span className="rental-photo rental-symbol" aria-hidden="true">{row.kind === 'room' ? '⌂' : '◇'}</span>
  const [x, y] = photo
  return <span className="rental-photo rental-photo-sprite" aria-hidden="true"
    style={{ backgroundPosition: `-${x * .68}px -${y * .68}px` }} />
}

// One row with − / + for any rental: tents, rooms and equipment all allow several items.
function Counter({row, quantity, adjust, price}) {
  const {t} = useI18n()
  const max = Math.min(100, Number(row.available))
  return <div className="rental-equipment">
    <div className="rental-product"><RentalPhoto row={row}/><span>{t(row.name)}<small>{price}</small>{max === 0 && <small>{t('ไม่ว่าง')}</small>}</span></div>
    <div className="guest-counter">
      <button type="button" aria-label={t('ลด {name}',{name:t(row.name)})} disabled={quantity === 0}
        onClick={() => adjust(row.code, -1, max)}><CustomerIcon name="minus"/></button>
      <output aria-label={t('จำนวน {name}',{name:t(row.name)})}>{quantity}</output>
      <button type="button" aria-label={t('เพิ่ม {name}',{name:t(row.name)})} disabled={quantity >= max}
        onClick={() => adjust(row.code, 1, max)}><CustomerIcon name="plus"/></button>
    </div>
  </div>
}

export function RentalPicker({ dialog, rows, draft, setDraft, onConfirm, hostName }) {
  const mobile = useMobileScreen()
  const {t,money} = useI18n()
  const [view,setView] = useState('stay')
  const tentRows = rows.filter(isTent)
  // Rows arrive in the admin's order; until the admin arranges the tents, keep the original built-in order.
  const tents = tentRows.some(row => row.sort_order > 0) ? tentRows
    : [...tentCodes.map(code => tentRows.find(row => row.code === code)).filter(Boolean),
      ...tentRows.filter(row => !tentCodes.includes(row.code))]
  // Tents only: Trunkbox rooms are booked from the Trunkbox tab on the booking page, not as a plot add-on.
  const stays = tents
  const equipment = rows.filter(row => !isRentalStay(row))
  function adjust(code, step, max) {
    setDraft(previous => ({ ...previous, [code]: Math.max(0, Math.min(max, (previous[code] || 0) + step)) }))
  }

  function selectView(next) {
    setView(next)
    dialog.current.scrollTop = 0
  }

  return <dialog ref={dialog} className="dialog rental-dialog" aria-labelledby="rental-title">
    <header className="dialog-header">
      <span className="dialog-header-icon" aria-hidden="true"><CustomerIcon name="gear"/></span>
      <div><h2 id="rental-title">{t('เช่าอุปกรณ์เพิ่ม')}</h2>
        {hostName && <p className="small muted">{t('สำหรับ {name}',{name:hostName})}</p>}</div>
      <form method="dialog"><button className="icon-button" aria-label={t('ปิดโดยไม่บันทึก')}><CustomerIcon name="close"/></button></form>
    </header>
    <div className="customer-switch" aria-label={t('ประเภทอุปกรณ์')}>
      <button type="button" aria-pressed={view === 'stay'} onClick={() => selectView('stay')}>{t('เต็นท์')}</button>
      <button type="button" aria-pressed={view === 'gear'} onClick={() => selectView('gear')}>{t('อุปกรณ์')}</button>
    </div>
    <div className="rental-columns">
      <section className="stack" hidden={view !== 'stay'}>
        <div className="rental-heading"><h2>{t('เช่าเต็นท์')}</h2><span className="small">{t('เลือกได้หลายหลัง · ราคาต่อหลังต่อคืน')}</span></div>
        {stays.length === 0 && <p className="muted">{t('ยังไม่มีรายการให้เลือก')}</p>}
        {stays.map(row => <Counter key={row.code} row={row} quantity={draft[row.code] || 0} adjust={adjust} price={t('{price} / คืน',{price:money(row.price)})}/>)}
      </section>
      <section className="stack" hidden={view !== 'gear'}>
        <div className="rental-heading"><h2>{t('เช่าอุปกรณ์')}</h2><span className="small">{t('ราคาต่อชิ้นต่อคืน')}</span></div>
        {equipment.length === 0 && <p className="muted">{t('ยังไม่มีรายการให้เลือก')}</p>}
        <PagedItems items={equipment} size={3} label={t('อุปกรณ์ให้เช่า')} paginate={false}>{page => page.map(row =>
          <Counter key={row.code} row={row} quantity={draft[row.code] || 0} adjust={adjust} price={money(row.price)}/>)}</PagedItems>
      </section>
    </div>
    <button type="button" className="button rental-confirm" onClick={async () => {
      const accepted = await onConfirm({...draft})
      if (accepted !== false) dialog.current.close()
    }}>{t('ยืนยันการเลือก')}</button>
  </dialog>
}

