'use client'
import {useEffect,useState} from 'react'
const format=bytes=>bytes>=1e9?(bytes/1e9).toFixed(2)+' GB':bytes>=1e6?(bytes/1e6).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB'
export function StoragePanel({compact=false}){
 const [usage,setUsage]=useState(null),[error,setError]=useState('')
 useEffect(()=>{const abort=new AbortController();async function load(){try{const response=await fetch('/admin/storage',{signal:abort.signal,cache:'no-store'});if(!response.ok)throw Error();setUsage(await response.json());setError('')}catch{if(!abort.signal.aborted)setError('โหลดข้อมูลพื้นที่ไม่สำเร็จ กรุณารีเฟรชหน้า')}}load();const timer=setInterval(load,30000);return()=>{abort.abort();clearInterval(timer)}},[])
 if(!usage)return compact?null:<section className="panel"><p role="status">{error||'กำลังตรวจสอบพื้นที่จัดเก็บ…'}</p></section>
 const percent=Math.min(100,usage.used/usage.limit*100),full=usage.free===0
 if(compact)return percent<90?null:<p className="notice error" role="alert">{full?'พื้นที่จัดเก็บครบ 10 GB แล้ว ไม่สามารถอัปโหลดไฟล์เพิ่มได้':'พื้นที่จัดเก็บใกล้เต็มแล้ว'} · ใช้ {format(usage.used)} / 10 GB <a href="/admin?section=storage">จัดการพื้นที่</a></p>
 return <section className="panel stack storage-panel">
  <header><span className="eyebrow">STORAGE</span><h2>พื้นที่จัดเก็บของระบบ</h2><p>โควตารวมระบบและไฟล์ทั้งหมด 10 GB</p></header>
  <div className="storage-total"><strong>{format(usage.used)} <small>/ 10 GB</small></strong><span>เหลือ {format(usage.free)}</span></div>
  <progress max={usage.limit} value={Math.min(usage.used,usage.limit)} aria-label="พื้นที่จัดเก็บที่ใช้แล้ว"/>
  {full&&<p className="notice error" role="alert">พื้นที่เต็ม ไม่สามารถอัปโหลดเพิ่มได้ กรุณานำไฟล์ที่ไม่ใช้ออกก่อน</p>}
  <div className="storage-categories">{[['ระบบ',usage.system,'โค้ด โปรแกรมที่ใช้ และพื้นที่ฐานข้อมูลนอกเนื้อไฟล์ (ประมาณการ)'],['รูปภาพ',usage.images,'รูปโซน ผังลาน ห้องพัก อุปกรณ์ QR และสลิปรูปภาพ'],['วิดีโอ',usage.videos,'วิดีโอที่อัปโหลดในระบบ'],['ไฟล์อื่น',usage.other,'เช่น สลิป PDF'],['กำลังอัปโหลด / รอบันทึก',usage.reserved,'พื้นที่ที่จองไว้ ป้องกันการอัปโหลดพร้อมกันเกินโควตา']].map(([title,bytes,detail])=><article key={title}><h3>{title}</h3><strong>{format(bytes)}</strong><p className="small muted">{detail}</p></article>)}</div>
  <p className="small muted">ไม่จำกัดขนาดต่อไฟล์ แต่อัปโหลดได้เท่าพื้นที่ว่างรวม ระบบจองพื้นที่ทั้งไฟล์ก่อนเริ่มส่ง ไฟล์ที่ค้างโดยไม่ได้บันทึกจะหมดอายุหลัง 24 ชั่วโมงและคืนพื้นที่เมื่อระบบตรวจสอบครั้งถัดไป</p>
  <p className="small muted">นับพื้นที่ของแอปนี้ ไม่รวมระบบปฏิบัติการ สำรองข้อมูล และโปรเจกต์อื่น · 1 GB = 1,000,000,000 bytes · อัปเดตทุก 30 วินาที</p>
  {error&&<p role="alert">{error}</p>}
 </section>
}
