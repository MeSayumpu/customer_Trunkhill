'use client'

import { useEffect, useRef } from 'react'

// The loading screen normally lasts a moment. If it is still there after ten seconds the page change has stalled
// (seen in a tab that had been left open for hours): the page is loaded again by itself, once. If that stalls too,
// or the browser cannot remember that it already tried, a note with a "load again" button is shown instead of
// loading again and again.
//
// The same check runs from two places because the loading screen reaches the browser in two ways:
// - opened directly (address bar, reload): it arrives as plain HTML and React leaves it alone while the page is still
//   coming, so only the inline script below can act;
// - moving between pages inside the site: React draws it, and scripts drawn by React do not run, so the effect acts.
const key = 'trunkhill-loading-reload', waitMs = 10000, quietMs = 120000

function rescue(root) {
  const note = root.querySelector('.loading-rescue')
  if (!root.isConnected || !note || !note.hidden) return
  try {
    const last = Number(sessionStorage.getItem(key)) || 0
    if (Date.now() - last > quietMs) {
      sessionStorage.setItem(key,String(Date.now()))
      window.location.reload()
      return
    }
  } catch {}
  note.hidden = false
}

// Kept in step with rescue() above by hand: this copy must stand alone, because it runs before the page's own code.
const inline = `(function(){var root=document.currentScript&&document.currentScript.parentNode;if(!root)return;setTimeout(function(){
var note=root.querySelector('.loading-rescue');if(!root.isConnected||!note||!note.hidden)return;
try{var last=Number(sessionStorage.getItem('${key}'))||0;if(Date.now()-last>${quietMs}){sessionStorage.setItem('${key}',String(Date.now()));location.reload();return}}catch(e){}
note.hidden=false},${waitMs})})()`

const text = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')

export function LoadingRescue({note,label}) {
  const root = useRef(null)
  useEffect(() => {
    const timer = setTimeout(() => root.current && rescue(root.current), waitMs)
    return () => clearTimeout(timer)
  }, [])
  // Plain HTML, and a link rather than a button, on purpose. While a page is still arriving React holds back clicks made
  // inside its loading screen (it replays them once the page is ready), so a button's handler never runs here.
  // A link's own navigation is not held back: an empty href points at the address being loaded, which loads it again.
  return <div ref={root} dangerouslySetInnerHTML={{__html:
    `<p class="loading-rescue" role="alert" hidden>${text(note)}<a class="button secondary" href="">${text(label)}</a></p><script>${inline}</script>`}}/>
}
