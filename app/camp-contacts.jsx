'use client'

import { useEffect, useRef, useState } from 'react'
import { contactChannels, contactHref, isLink, locationLinks } from '../lib/camp-contacts'
import { GoogleMapsIcon, SocialIcon } from './social-icon'
import { CustomerIcon } from './customer-icon'
import { useCampOptions } from './use-camp-options'
import { useI18n } from './i18n'

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers / non-secure origins: fall back to a hidden textarea.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    // Inside a modal <dialog> everything outside it is inert, so keep the textarea in the open dialog.
    ;(document.activeElement?.closest('dialog[open]') || document.body).append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

const shortLink = value => value.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')

function useCopied() {
  const [copied,setCopied] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  return [copied, async (id, text) => {
    const ok = await copyText(text)
    setCopied(ok ? id : 'failed:' + id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2200)
  }]
}

// Compact brand icons (footer).
export function ContactList({contacts, compact = false}) {
  const {t} = useI18n()
  const items = contactChannels.filter(({key}) => contacts?.[key])
  if (!items.length) return null
  return <ul className={'contact-list' + (compact ? ' compact' : '')} role="list" aria-label={t('ช่องทางติดต่อ')}>
    {items.map(({key,name}) => {
      const href = contactHref(key, contacts[key])
      const external = key !== 'tel'
      return <li key={key}>
        <a href={href} {...(external ? {target:'_blank', rel:'noopener noreferrer'} : {})} aria-label={key === 'tel' ? t('โทรหาแคมป์ {phone}',{phone:contacts.tel}) : name}>
          <SocialIcon channel={key} size={compact ? 30 : 36}/>
          {!compact && <span><strong>{key === 'tel' ? contacts.tel : name}</strong><small>{key === 'tel' ? t('โทรหาแคมป์') : t('เปิดใน {name}',{name})}</small></span>}
        </a>
      </li>
    })}
  </ul>
}

// One row per channel: tap copies a number / LINE ID, or opens a link. The small button does the other action.
export function ContactActions({contacts}) {
  const {t} = useI18n()
  const [copied,copy] = useCopied()
  const items = contactChannels.filter(({key}) => contacts?.[key])
  if (!items.length) return <p className="contact-empty">{t('ยังไม่มีข้อมูลติดต่อ')}</p>
  return <ul className="contact-actions" role="list" aria-label={t('ช่องทางติดต่อ')}>
    {items.map(({key,name}) => {
      const value = contacts[key]
      const href = contactHref(key, value)
      const link = isLink(key, value)
      const shown = link ? shortLink(value) : value
      const done = copied === key, failed = copied === 'failed:' + key
      const hint = done ? t('คัดลอกแล้ว') : failed ? t('คัดลอกไม่สำเร็จ') : link ? t('แตะเพื่อเปิดลิงก์') : t('แตะเพื่อคัดลอก')
      const body = <>
        <SocialIcon channel={key} size={40}/>
        <span className="contact-action-text"><strong>{name}</strong><span>{shown}</span></span>
        <span className="contact-action-hint" data-done={done || undefined}><CustomerIcon name={done ? 'tick' : link ? 'external' : 'copy'}/>{hint}</span>
      </>
      return <li key={key} className="contact-action">
        {link ? <a className="contact-action-main" href={href} target="_blank" rel="noopener noreferrer" aria-label={t('เปิด {name}: {value}',{name,value:shown})}>{body}</a>
          : <button type="button" className="contact-action-main" onClick={() => copy(key, value)} aria-label={t('คัดลอก {name}: {value}',{name,value})}>{body}</button>}
        {link ? <button type="button" className="contact-action-side" onClick={() => copy(key, value)} aria-label={t('คัดลอกลิงก์ {name}',{name})} title={t('คัดลอกลิงก์')}><CustomerIcon name="copy"/></button>
          : <a className="contact-action-side" href={href} {...(key === 'tel' ? {} : {target:'_blank', rel:'noopener noreferrer'})}
            aria-label={key === 'tel' ? t('โทรหาแคมป์ {phone}',{phone:value}) : t('เปิดใน {name}',{name})} title={key === 'tel' ? t('โทร') : t('เปิดใน {name}',{name})}>
            <CustomerIcon name={key === 'tel' ? 'phone' : 'external'}/></a>}
        <span className="visually-hidden" aria-live="polite">{done ? t('คัดลอก {name} แล้ว',{name}) : ''}</span>
      </li>
    })}
  </ul>
}

// Map + address of the camp (Admin → ตั้งค่าแคมป์ → ช่องทางติดต่อและที่ตั้ง).
export function CampLocation({location, headingLevel = 3}) {
  const {t} = useI18n()
  const [copied,copy] = useCopied()
  const links = locationLinks(location)
  if (!links) return null
  const Heading = 'h' + headingLevel
  return <section className="camp-location" aria-labelledby="camp-location-title">
    <Heading id="camp-location-title"><CustomerIcon name="pin"/>{t('ที่ตั้งแคมป์')}</Heading>
    <div className="camp-location-map">
      <iframe title={t('แผนที่ที่ตั้ง Trunkhill Campfield')} src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>
    </div>
    {location.address && <button type="button" className="camp-location-address" onClick={() => copy('address', t(location.address))}>
      <span>{t(location.address)}</span>
      <small data-done={copied === 'address' || undefined}><CustomerIcon name={copied === 'address' ? 'tick' : 'copy'}/>{copied === 'address' ? t('คัดลอกแล้ว') : t('แตะเพื่อคัดลอกที่อยู่')}</small>
    </button>}
    <div className="camp-location-actions">
      <a className="button secondary" href={links.open} target="_blank" rel="noopener noreferrer"><GoogleMapsIcon/>{t('เปิดใน Google Maps')}</a>
      <a className="button" href={links.directions} target="_blank" rel="noopener noreferrer"><CustomerIcon name="directions"/>{t('นำทาง')}</a>
    </div>
  </section>
}

export function ContactDialog({onClose}) {
  const {t} = useI18n()
  const {contacts,location} = useCampOptions()
  const dialog = useRef(null)
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal() }, [])
  return <dialog ref={dialog} className="dialog sheet-dialog contact-dialog" aria-labelledby="contact-dialog-title" onClose={onClose}>
    <header className="dialog-header">
      <span className="dialog-header-icon" aria-hidden="true"><CustomerIcon name="contact"/></span>
      <div><h2 id="contact-dialog-title">{t('ข้อมูลการติดต่อ')}</h2><p className="contact-dialog-hint">{t('แตะเพื่อคัดลอก หรือเปิดลิงก์')}</p></div>
      <form method="dialog"><button className="icon-button" aria-label={t('ปิดข้อมูลการติดต่อ')}><CustomerIcon name="close"/></button></form>
    </header>
    <ContactActions contacts={contacts}/>
    <CampLocation location={location}/>
  </dialog>
}
