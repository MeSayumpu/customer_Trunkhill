'use client'

import { useEffect, useId, useRef } from 'react'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'

/*
  Shown when a booking is refused because something in it is no longer free. A booking is all or nothing, so the
  dialog lists everything that was picked, marks what cannot be booked, and its only way out is back to the picker.
  rows: [{code,label,ok,note}] or null (closed).
*/
export function UnavailableDialog({rows, onBack}) {
  const dialog = useRef(null)
  const button = useRef(null)
  const id = useId()
  const {t} = useI18n()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (rows && !element.open) {
      element.showModal()
      button.current?.focus()
    }
    if (!rows && element.open) element.close()
  },[rows])

  return <dialog ref={dialog} role="alertdialog" className="confirm-dialog tone-danger unavailable-dialog"
    aria-labelledby={id + '-title'} aria-describedby={id + '-message'}
    onCancel={event => {event.preventDefault();onBack()}}>
    {rows && <div className="confirm-dialog-body">
      <span className="confirm-dialog-icon" aria-hidden="true"><CustomerIcon name="warning"/></span>
      <h2 id={id + '-title'}>{t('จองไม่ได้ มีรายการที่ไม่ว่างแล้ว')}</h2>
      <div id={id + '-message'} className="confirm-dialog-message">
        <p>{t('ระบบยังไม่ได้จองรายการใดเลย กรุณากลับไปเลือกใหม่')}</p>
        <ul role="list" className="unavailable-list">
          {rows.map(row => <li key={row.code} data-ok={row.ok || undefined}>
            <span>{row.label}</span><strong>{row.note}</strong>
          </li>)}
        </ul>
      </div>
      <div className="confirm-dialog-actions unavailable-actions">
        <button ref={button} type="button" className="button" onClick={onBack}>{t('กลับไปเลือกใหม่')}</button>
      </div>
    </div>}
  </dialog>
}
