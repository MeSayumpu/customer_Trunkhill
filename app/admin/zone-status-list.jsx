'use client'

import {useId,useRef,useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import {setZoneActive} from './camp-options-actions'
import {AdminIcon} from './admin-icon'

export function ZoneStatusList({zones}) {
  const dialog=useRef(null), router=useRouter(), titleId=useId()
  const [selected,setSelected]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [pending,startTransition]=useTransition()
  const enabling=selected&&!selected.active
  function close(){if(!pending)dialog.current.close()}
  function save(){
    startTransition(async()=>{
      try {
        const result=await setZoneActive(selected.zone,!!enabling)
        if(result.error){setError(result.error);return}
        dialog.current.close();setNotice(`${enabling?'เปิด':'ปิด'}การใช้งานโซน ${selected.zone} แล้ว`);router.refresh()
      } catch {setError('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')}
    })
  }
  return <div className="zone-status-list">
    <p className="small muted">โซนที่ปิดจะไม่รับการจองใหม่ ข้อมูลล็อก รูปภาพ และรายการจองเดิมยังอยู่ เปิดใช้งานอีกครั้งได้ทุกเมื่อ</p>
    {notice&&<p role="status">{notice}</p>}
    {zones.map(item=><div className="zone-manage-row" key={item.zone}>
      <div><strong>โซน {item.zone}</strong><small>{item.total} รายการ · {item.active?'เปิดใช้งาน':'ปิดใช้งาน'}</small></div>
      <button type="button" className={'button secondary '+(item.active?'zone-disable-button':'')} aria-label={`${item.active?'ปิด':'เปิด'}การใช้งานโซน ${item.zone}`} disabled={pending} onClick={()=>{setSelected(item);setError('');dialog.current.showModal()}}><AdminIcon name={item.active?'close':'confirmed'}/>{item.active?'ปิดการใช้งาน':'เปิดการใช้งาน'}</button>
    </div>)}
    {!zones.length&&<p>ยังไม่มีโซน เพิ่มโซนใหม่ได้ด้านบน</p>}
    <dialog ref={dialog} className="dialog admin-booking-confirm" data-tone={enabling?'approve':'cancel'} aria-labelledby={titleId} onCancel={event=>{event.stopPropagation();if(pending)event.preventDefault()}}>
      <div className="stack">
        <div className="booking-confirm-heading"><span className="booking-confirm-icon"><AdminIcon name={enabling?'confirmed':'close'}/></span><button type="button" className="button secondary" aria-label="ปิดหน้าต่างยืนยัน" onClick={close} disabled={pending}><AdminIcon name="close"/></button></div>
        <h2 id={titleId}>ยืนยัน{enabling?'เปิด':'ปิด'}การใช้งานโซน {selected?.zone}?</h2>
        <p>{enabling?'ล็อกที่เปิดให้จองในโซนนี้จะกลับมาแสดงให้ผู้จองเลือกได้ตามปกติ':'ล็อกทั้งหมดในโซนนี้จะถูกซ่อนจากหน้าผู้จอง และไม่สามารถจองใหม่หรือเลื่อนวันเข้ามาในโซนนี้ได้'}</p>
        <p className="booking-confirm-warning">ข้อมูลโซน รูปภาพ และรายการจองเดิมจะยังอยู่ สถานะเปิด–ปิดของแต่ละล็อกจะคงเดิม</p>
        {error&&<p role="alert">{error}</p>}
        <div className="booking-confirm-actions"><button type="button" className="button secondary" autoFocus onClick={close} disabled={pending}>กลับ</button><button type="button" className={'button '+(enabling?'booking-approve':'booking-confirm-cancel')} onClick={save} disabled={pending}>{pending?'กำลังบันทึก…':`ยืนยัน${enabling?'เปิด':'ปิด'}การใช้งาน`}</button></div>
      </div>
    </dialog>
  </div>
}
