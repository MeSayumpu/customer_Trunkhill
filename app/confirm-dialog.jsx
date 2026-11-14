'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { CustomerIcon } from './customer-icon'
import { useI18n } from './i18n'

const ConfirmContext = createContext(null)

const defaults = {
  title:'ยืนยันการลบ',
  message:'',
  items:[],
  confirmLabel:'ลบรายการ',
  cancelLabel:'ไม่ลบ',
  tone:'danger',
}

/*
  Every removal goes through this dialog, so wording and focus behaviour stay identical.
  The customer variant uses customer-ui.css; the admin variant reuses the admin confirm styles
  (.admin-booking-confirm) already used for approving and cancelling bookings.
*/
export function ConfirmProvider({children, variant = 'customer'}) {
  const dialog = useRef(null)
  const cancelButton = useRef(null)
  const [request,setRequest] = useState(null)
  const id = useId()
  const {t} = useI18n()

  const confirm = useCallback(options => new Promise(resolve => {
    setRequest(previous => {
      previous?.resolve(false)
      return {...defaults,...options,resolve}
    })
  }),[])

  useEffect(() => {
    const element = dialog.current
    if (!request || !element) return
    if (!element.open) element.showModal()
    cancelButton.current?.focus()
  },[request])

  function settle(value) {
    const current = request
    setRequest(null)
    if (dialog.current?.open) dialog.current.close()
    current?.resolve(value)
  }

  const icon = <CustomerIcon name={request?.tone === 'danger' ? 'remove' : 'warning'}/>
  const message = request && <div id={id + '-message'} className="confirm-dialog-message">
    {request.message && <p>{t(request.message)}</p>}
    {request.items.length > 0 && <ul role="list" className={variant === 'admin' ? 'booking-confirm-summary' : undefined}>
      {request.items.map(item => <li key={item}>{t(item)}</li>)}
    </ul>}
  </div>

  const body = !request ? null : variant === 'admin' ? <div className="stack">
    <div className="booking-confirm-heading">
      <span className="booking-confirm-icon" aria-hidden="true">{icon}</span>
      <button type="button" className="button secondary" aria-label={t('ปิดหน้าต่างยืนยัน')} onClick={() => settle(false)}><CustomerIcon name="close"/></button>
    </div>
    <h2 id={id + '-title'}>{t(request.title)}</h2>
    {message}
    <div className="booking-confirm-actions">
      <button ref={cancelButton} type="button" className="button secondary" onClick={() => settle(false)}>{t(request.cancelLabel)}</button>
      <button type="button" className={'button ' + (request.tone === 'danger' ? 'booking-confirm-cancel' : 'booking-approve')} onClick={() => settle(true)}>{t(request.confirmLabel)}</button>
    </div>
  </div> : <div className="confirm-dialog-body">
    <span className="confirm-dialog-icon" aria-hidden="true">{icon}</span>
    <h2 id={id + '-title'}>{t(request.title)}</h2>
    {message}
    <div className="confirm-dialog-actions">
      <button ref={cancelButton} type="button" className="button secondary" onClick={() => settle(false)}>{t(request.cancelLabel)}</button>
      <button type="button" className="button confirm-dialog-accept" onClick={() => settle(true)}>{t(request.confirmLabel)}</button>
    </div>
  </div>

  return <ConfirmContext.Provider value={confirm}>
    {children}
    <dialog ref={dialog} role="alertdialog" aria-labelledby={id + '-title'} aria-describedby={id + '-message'}
      className={variant === 'admin' ? 'dialog admin-booking-confirm admin-remove-confirm' : 'confirm-dialog tone-' + (request?.tone || 'danger')}
      data-tone={variant === 'admin' ? (request?.tone === 'danger' ? 'cancel' : 'approve') : undefined}
      onCancel={event => {event.preventDefault();event.stopPropagation();settle(false)}}
      onClick={event => {if (event.target === dialog.current) settle(false)}}>
      {body}
    </dialog>
  </ConfirmContext.Provider>
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  return confirm ?? (async ({title,message}) => window.confirm([title,message].filter(Boolean).join('\n')))
}

/*
  Submit button for server-rendered forms: asks first, then submits the same form with this button
  as the submitter, so a formAction on the button still applies.
*/
export function ConfirmSubmit({confirm:options, children, ...props}) {
  const confirm = useConfirm()
  return <button {...props} onClick={async event => {
    event.preventDefault()
    const button = event.currentTarget
    if (await confirm(options)) button.form?.requestSubmit(button)
  }}>{children}</button>
}
