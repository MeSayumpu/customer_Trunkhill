'use client'

import NextLink, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react'
import { createPortal, useFormStatus } from 'react-dom'
import { CampLoader } from './camp-loader'
import {prepareUploads} from './upload-files'
import { useConfirm } from './confirm-dialog'
import { useI18n } from './i18n'

export const AdminPendingRegion = createContext(null)

function ScopedPending({region, label}) {
  const origin = useRef(null)
  const [target,setTarget] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const dialogHeader = origin.current?.closest('dialog[open]')?.querySelector('.admin-dialog-header')
      setTarget(dialogHeader ?? region.current)
    },180)
    return () => window.clearTimeout(timer)
  },[region])

  return <>
    <span ref={origin} hidden/>
    {target && createPortal(<div className="admin-pending"><CampLoader label={label}/></div>,target)}
  </>
}

function FullPendingScreen({label}) {
  const {t} = useI18n()
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  return createPortal(<dialog ref={dialog} className="pending-screen" aria-label={t(label || 'กำลังโหลด')}
    onCancel={event => event.preventDefault()}>
    <CampLoader label={label ? t(label) : undefined}/>
  </dialog>, document.body)
}

export function PendingScreen({label}) {
  const region = useContext(AdminPendingRegion)
  return region ? <ScopedPending region={region} label={label}/> : <FullPendingScreen label={label}/>
}

function LinkPending() {
  const { pending } = useLinkStatus()
  return pending && <PendingScreen/>
}

export default function LoadingLink({children,...props}) {
  return <NextLink {...props}>{children}<LinkPending/></NextLink>
}

function ActionPending() {
  const { pending } = useFormStatus()
  return pending && <PendingScreen label="กำลังดำเนินการ…"/>
}

export function ActionForm({children,action,...props}) {
  const [error,setError]=useState('')
  function submit(data){
    setError('')
    const fileFields=new Set([...data.entries()].filter(([,value])=>value instanceof File).map(([name])=>name))
    // Nothing to upload: the action is called at once, still inside the form's own transition, which a useActionState
    // action needs. Empty file fields are dropped the same way an upload would drop them.
    if(![...data.values()].some(value=>value instanceof File&&value.size)){
      for(const name of fileFields){const rest=data.getAll(name).filter(value=>!(value instanceof File));data.delete(name);for(const value of rest)data.append(name,value)}
      return action(data)
    }
    return (async()=>{try{await prepareUploads(data)}catch(error){setError(error.message);return}return action(data)})()
  }
  return <form {...props} action={submit}>{children}{error&&<p role="alert" className="notice error">{error}</p>}<ActionPending/></form>
}

export function AdminSearchForm({children,className}) {
  const router = useRouter()
  const [pending,startTransition] = useTransition()

  function search(event) {
    event.preventDefault()
    const query = new URLSearchParams(new FormData(event.currentTarget))
    startTransition(() => router.push('/admin?' + query,{scroll:false}))
  }

  return <form action="/admin" className={className} onSubmit={search}>
    {children}
    {pending && <PendingScreen label="กำลังค้นหา…"/>}
  </form>
}

export function UploadForm({children,onSubmit,confirm:confirmOptions,...props}) {
  const confirm = useConfirm()
  const [pending,setPending] = useState(false)
  const [error,setError]=useState('')
  useEffect(() => {
    const reset = () => setPending(false)
    window.addEventListener('pageshow',reset)
    return () => window.removeEventListener('pageshow',reset)
  }, [])

  return <form {...props} onSubmit={async event => {
    onSubmit?.(event)
    if(event.defaultPrevented)return
    event.preventDefault()
    if(pending)return
    const element=event.currentTarget
    // Uploads that overwrite existing media ask first.
    if(confirmOptions&&!(await confirm(confirmOptions)))return
    const form=new FormData(element)
    setPending(true);setError('')
    try{await prepareUploads(form);const response=await fetch(props.action,{method:'POST',body:form});if(response.redirected){window.location.assign(response.url);return}if(!response.ok)throw Error('อัปโหลดไม่สำเร็จ');window.location.reload()}catch(error){setError(error.message);setPending(false)}
  }}>
    {children}
    {error&&<p role="alert" className="notice error">{error}</p>}
    {pending && <PendingScreen label="กำลังอัปโหลด…"/>}
  </form>
}
