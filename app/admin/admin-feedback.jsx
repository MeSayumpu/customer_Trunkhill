'use client'

import { useEffect, useRef, useState } from 'react'
import { AdminIcon } from './admin-icon'

const scrollKey = 'trunkhill-admin-scroll'
const section = () => new URLSearchParams(window.location.search).get('section') || 'dashboard'
const scrollers = () => [...document.querySelectorAll('.admin-ui .admin-table-scroll')]

// Result of a save as a floating message, and the page kept where the admin was working.
// stamp changes on every server render, so saving twice in a row shows the message twice.
export function AdminFeedback({stamp, message, error}) {
  const [toast,setToast] = useState(null)
  const box = useRef(null)

  // Any admin form about to be sent: remember where the page and its tables are scrolled.
  useEffect(() => {
    const remember = () => {
      try {
        sessionStorage.setItem(scrollKey,JSON.stringify({section:section(),y:window.scrollY,time:Date.now(),
          inner:scrollers().map(element => [element.scrollLeft,element.scrollTop])}))
      } catch {}
    }
    document.addEventListener('submit',remember,true)
    return () => document.removeEventListener('submit',remember,true)
  },[])

  // The page that comes back after the save: put the scroll back instead of starting from the top.
  useEffect(() => {
    let saved
    try { saved = JSON.parse(sessionStorage.getItem(scrollKey)); sessionStorage.removeItem(scrollKey) } catch {}
    if (!saved || saved.section !== section() || Date.now() - saved.time > 30000) return
    const restore = () => {
      window.scrollTo({top:saved.y,behavior:'instant'})
      scrollers().forEach((element,index) => { if (saved.inner[index]) [element.scrollLeft,element.scrollTop] = saved.inner[index] })
    }
    restore()
    const frame = requestAnimationFrame(restore)
    return () => cancelAnimationFrame(frame)
  },[stamp])

  useEffect(() => {
    if (!message) return
    setToast({id:stamp,message,error})
    // The result is said once: a reload or the back button does not repeat it.
    const url = new URL(window.location.href)
    if (url.searchParams.has('saved') || url.searchParams.has('error')) {
      url.searchParams.delete('saved');url.searchParams.delete('error')
      window.history.replaceState(window.history.state,'',url)
    }
  },[stamp,message,error])

  useEffect(() => {
    if (!toast) return
    // Shown after any dialog of the same render so it sits above it.
    const show = setTimeout(() => { try { if (box.current && !box.current.matches(':popover-open')) box.current.showPopover?.() } catch {} },30)
    const hide = setTimeout(() => setToast(null),toast.error ? 9000 : 3500)
    return () => { clearTimeout(show);clearTimeout(hide) }
  },[toast])

  if (!toast) return null
  return <div key={toast.id} ref={box} popover="manual" className={'admin-toast' + (toast.error ? ' error' : '')}
    role={toast.error ? 'alert' : 'status'} onClick={() => setToast(null)}>
    <AdminIcon name={toast.error ? 'warning' : 'confirmed'}/><span>{toast.message}</span>
    <button type="button" className="admin-toast-close" aria-label="ปิดข้อความ"><AdminIcon name="close"/></button>
  </div>
}
