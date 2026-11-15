'use client'

import { createContext, useContext } from 'react'

const HeroContext = createContext(null)

// The uploaded banner ({id,kind}) is read once on the server (CustomerLayout) so the first paint already has it.
export function HeroProvider({media,children}) {
  return <HeroContext.Provider value={media}>{children}</HeroContext.Provider>
}

// Dark green band at the top of every customer page. With a photo or video uploaded in admin
// (ตั้งค่าแคมป์ › คำโปรยหน้าจอง) the media sits behind a dark-to-light green gradient.
export function PageHero({children,...props}) {
  const media = useContext(HeroContext)
  const src = media && '/api/facility-media/' + media.id
  return <section {...props} className={'booking-hero' + (media ? ' has-media' : '')}>
    {media && (media.kind === 'video'
      ? <video className="booking-hero-media" src={src} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} disablePictureInPicture/>
      : <img className="booking-hero-media" src={src} alt="" decoding="async" fetchPriority="high"/>)}
    <div className="camp-shell booking-hero-inner">{children}</div>
  </section>
}
