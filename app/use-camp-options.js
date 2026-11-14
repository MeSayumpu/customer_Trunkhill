'use client'
import {useEffect,useState} from 'react'
import {normalizeContacts,normalizeLocation} from '../lib/camp-contacts'
export function useCampOptions(){
  const [options,setOptions]=useState({zones:['A','B','C','D','BOX'],facilities:{},contacts:normalizeContacts(),location:normalizeLocation(),window:{value:3,unit:'months'},loaded:false})
  useEffect(()=>{const abort=new AbortController();fetch('/api/camp-options',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>setOptions({...data,contacts:normalizeContacts(data.contacts),location:normalizeLocation(data.location),loaded:true})).catch(()=>{if(!abort.signal.aborted)setOptions(previous=>({...previous,error:'โหลดการตั้งค่าไม่สำเร็จ กรุณาปิดแล้วเปิดหน้าต่างอีกครั้ง'}))});return()=>abort.abort()},[])
  return options
}
