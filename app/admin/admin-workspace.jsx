'use client'

import { useEffect, useRef, useState } from 'react'
import { AdminPendingRegion } from '../pending-ui'
import { AdminIcon } from './admin-icon'

export function AdminWorkspace({ sidebar, title, section, children, topActions, roleLabel = 'ผู้ดูแลระบบ' }) {
  const [menuOpen, setMenuOpen] = useState(true)
  const content = useRef(null)
  useEffect(() => {
    const mobile=window.matchMedia('(max-width:760px)')
    const sync=()=>setMenuOpen(!mobile.matches)
    sync();mobile.addEventListener('change',sync)
    return ()=>mobile.removeEventListener('change',sync)
  },[section])

  return <AdminPendingRegion.Provider value={content}><main className="admin-workspace" data-menu-open={menuOpen} data-section={section}>
    <aside id="admin-sidebar" className="admin-sidebar" hidden={!menuOpen}><button type="button" className="button secondary admin-mobile-menu-close" onClick={()=>setMenuOpen(false)}>ปิดเมนู <AdminIcon name="close"/></button>{sidebar}</aside>
    <div className="admin-main" ref={content}>
      <header className="admin-top">
        <div className="admin-top-title">
          <button type="button" className="button secondary admin-menu-toggle"
            aria-controls="admin-sidebar" aria-expanded={menuOpen}
            aria-label={menuOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
            title={menuOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
            onClick={() => setMenuOpen(open => !open)}>
            <AdminIcon name="menu"/>
          </button>
          <h1>{title}</h1>
        </div>
        <div className="admin-top-actions">{topActions}<span className="admin-status confirmed">{roleLabel}</span></div>
      </header>
      {children}
    </div>
  </main></AdminPendingRegion.Provider>
}
