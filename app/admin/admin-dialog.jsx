'use client'

import { useEffect, useRef } from 'react'
import Link from '../pending-ui'
import { useRouter } from 'next/navigation'
import { AdminIcon } from './admin-icon'

export function AdminDialog({ title, closeUrl, children }) {
  const dialog = useRef(null)
  const router = useRouter()

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
  }, [])

  return <dialog ref={dialog} className="dialog admin-dialog" aria-labelledby="admin-dialog-title"
    onCancel={event => { event.preventDefault(); router.replace(closeUrl, { scroll:false }) }}>
    <header className="admin-dialog-header">
      <h2 id="admin-dialog-title">{title}</h2>
      <Link href={closeUrl} scroll={false} className="button secondary" aria-label="ปิดหน้าต่าง"><AdminIcon name="close"/></Link>
    </header>
    {children}
  </dialog>
}
