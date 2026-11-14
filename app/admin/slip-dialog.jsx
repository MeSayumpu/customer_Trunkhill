'use client'
import {useRef,useId} from 'react'
export function SlipDialog({id,mime}) {
  const dialog=useRef(null),title=useId()
  return <><button type="button" className="button secondary" onClick={()=>dialog.current.showModal()}>เปิดสลิปการโอน</button>
    <dialog ref={dialog} className="dialog admin-slip-dialog" aria-labelledby={title} onCancel={e=>e.stopPropagation()}>
      <header><h2 id={title}>สลิปการโอน</h2><button type="button" className="button secondary" aria-label="ปิดสลิป" onClick={()=>dialog.current.close()}>×</button></header>
      {mime?.startsWith('image/')?<img loading="lazy" decoding="async" src={'/admin/slip/'+id} alt="สลิปการโอน"/>:<iframe title="สลิปการโอน" src={'/admin/slip/'+id+'?preview=1'}/>}
    </dialog></>
}
