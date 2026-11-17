import { useId } from 'react'

// Round brand badges for the camp's contact channels (drawn inline, no extra icon package).
const badges = {
  tel: { background:'#1f4a37', glyph:<path fill="#fff" d="M8.2 4.4c.4-.1.8.1 1 .5l1.3 2.9c.2.4.1.8-.2 1.1l-1.4 1.2a9.6 9.6 0 0 0 4.9 4.9l1.2-1.4c.3-.3.7-.4 1.1-.2l2.9 1.3c.4.2.6.6.5 1l-.4 2.1c-.1.5-.5.8-1 .8C11.5 18.6 5.4 12.5 5.4 5.9c0-.5.3-.9.8-1z"/> },
  line: { background:'#06c755', glyph:<>
    <path fill="#fff" d="M12 5.2c-4.3 0-7.8 2.8-7.8 6.3 0 3.1 2.8 5.7 6.5 6.2.3.1.6.2.7.4.1.2.1.5 0 .8l-.1.7c0 .2-.2.8.7.4.9-.4 4.8-2.8 6.5-4.8 1.2-1.3 1.8-2.6 1.8-3.7 0-3.5-3.5-6.3-8.3-6.3z"/>
    <text x="12" y="13.1" textAnchor="middle" fontSize="4.2" fontWeight="800" fontFamily="Arial, sans-serif" fill="#06c755">LINE</text>
  </> },
  facebook: { background:'#1877f2', glyph:<path fill="#fff" d="M13.4 20v-6.3h2.1l.4-2.6h-2.5V9.5c0-.7.3-1.3 1.4-1.3h1.2V6c-.3 0-1-.1-2-.1-2 0-3.4 1.2-3.4 3.5v1.7H8.4v2.6h2.2V20z"/> },
  tiktok: { background:'#111', glyph:<>
    <path fill="#25f4ee" d="M15.4 5.3a3.6 3.6 0 0 0 .9 2.4 3.6 3.6 0 0 0 2.6 1.3v2.2a5.7 5.7 0 0 1-3.4-1.1v4.9a4.4 4.4 0 1 1-4.4-4.4h.6v2.3a2.2 2.2 0 1 0 1.6 2.1V4.6h2.1z" transform="translate(-.6 -.4)"/>
    <path fill="#fe2c55" d="M15.4 5.3a3.6 3.6 0 0 0 .9 2.4 3.6 3.6 0 0 0 2.6 1.3v2.2a5.7 5.7 0 0 1-3.4-1.1v4.9a4.4 4.4 0 1 1-4.4-4.4h.6v2.3a2.2 2.2 0 1 0 1.6 2.1V4.6h2.1z" transform="translate(.5 .4)"/>
    <path fill="#fff" d="M15.4 5.3a3.6 3.6 0 0 0 .9 2.4 3.6 3.6 0 0 0 2.6 1.3v2.2a5.7 5.7 0 0 1-3.4-1.1v4.9a4.4 4.4 0 1 1-4.4-4.4h.6v2.3a2.2 2.2 0 1 0 1.6 2.1V4.6h2.1z"/>
  </> },
  youtube: { background:'#ff0000', glyph:<>
    <rect x="4.6" y="7" width="14.8" height="10" rx="3" fill="#fff"/>
    <path fill="#ff0000" d="M10.6 9.6v4.8l4.2-2.4z"/>
  </> },
  instagram: { background:'gradient', gradient:true, glyph:<>
    <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.4" fill="none" stroke="#fff" strokeWidth="1.7"/>
    <circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" strokeWidth="1.7"/>
    <circle cx="15.4" cy="8.6" r=".9" fill="#fff"/>
  </> },
  x: { background:'#000', glyph:<path fill="#fff" d="M15.6 5.8h1.9l-4.2 4.8 4.9 6.6h-3.9l-3-4-3.5 4H5.9l4.5-5.1-4.7-6.3h4l2.7 3.6zm-.7 10.2H16L9.2 6.9H8z"/> },
  lemon8: { background:'#ffe74a', glyph:<>
    <circle cx="12" cy="12" r="6.2" fill="#fff6b0" stroke="#1c1c1c" strokeWidth="1.2"/>
    <path d="M12 5.8v12.4M5.8 12h12.4M7.6 7.6l8.8 8.8M16.4 7.6l-8.8 8.8" stroke="#e6c200" strokeWidth=".9"/>
    <text x="12" y="15.2" textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="Arial, sans-serif" fill="#1c1c1c">8</text>
  </> },
}

// The Google Maps pin, for the button that opens the camp in Google Maps. Sized by the text around it.
export function GoogleMapsIcon({className = ''}) {
  return <svg className={'customer-icon google-maps-icon ' + className} viewBox="0 0 92.3 132.3" aria-hidden="true" focusable="false">
    <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z"/>
    <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z"/>
    <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"/>
    <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3"/>
    <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2"/>
  </svg>
}

export function SocialIcon({channel, size = 32, className = ''}) {
  const badge = badges[channel] || badges.tel
  const gradientId = useId().replace(/:/g,'') + '-ig'
  return <svg className={'social-icon ' + className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {badge.gradient && <defs>
      <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
        <stop offset="0" stopColor="#fdf497"/><stop offset=".05" stopColor="#fdf497"/>
        <stop offset=".45" stopColor="#fd5949"/><stop offset=".6" stopColor="#d6249f"/><stop offset=".9" stopColor="#285aeb"/>
      </radialGradient>
    </defs>}
    <circle cx="12" cy="12" r="12" fill={badge.gradient ? 'url(#' + gradientId + ')' : badge.background}/>
    {badge.glyph}
  </svg>
}
