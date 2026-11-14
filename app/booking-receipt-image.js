import { translate, formatMoney } from '../lib/i18n'

// Draws the proof-of-submission image in the visitor's language (pass the useI18n() value).
export async function downloadBookingReceipt(booking, i18n = {}){
  const lang=i18n.lang||'th'
  const t=(text,params)=>translate(lang,text,params)
  await document.fonts.ready
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1100
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='#f8f5ee';ctx.fillRect(0,0,1000,1100)
  ctx.fillStyle='#ffffff';ctx.fillRect(40,40,920,1020)
  const logo=new Image();logo.src='/camp-logo-transparent.webp'
  try{await logo.decode();ctx.drawImage(logo,390,70,220,140)}catch{}
  const text=(value,y,size=30,color='#234d39')=>{ctx.fillStyle=color;ctx.font=`${size}px sans-serif`;ctx.textAlign='center';ctx.fillText(value,500,y,840)}
  text(t('ส่งหลักฐานการชำระเงินแล้ว'),280,42)
  text(booking.status==='confirmed'?t('แคมป์ยืนยันการจองแล้ว'):t('รอแอดมินตรวจสอบและยืนยันการจอง'),340,26)
  ctx.fillStyle='#eee8dc';ctx.fillRect(90,390,820,140)
  text(t('รหัสการจอง'),435,25);text(booking.reference||booking.id,495,46)
  const date=value=>value.split('-').reverse().join('/')
  text(`${date(booking.arrival)} – ${date(booking.departure)}`,600,32)
  text(t('ผู้จอง {name}',{name:booking.guest||''}),655,28)
  const lines=booking.items.map(i=>`${t(i.name)} × ${i.quantity}`)
  text(lines.slice(0,3).join(' · ')+(lines.length>3?' '+t('และอีก {n} รายการ',{n:lines.length-3}):''),715,27)
  text(t('ยอดจอง {amount}',{amount:formatMoney(lang,booking.total)}),785,38)
  text(t('ใช้รหัสจองและเบอร์โทรเพื่อตรวจสอบหรือเลื่อนการจอง'),890,25)
  text(t('หลักฐานนี้ไม่ใช่การยืนยันว่าเงินเข้าบัญชีแล้ว'),940,23,'#68786f')
  text('Trunkhill Campfield' + (i18n.phone ? ' · ' + i18n.phone : ''),1010,25)
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
  if(!blob)throw new Error('สร้างรูปไม่สำเร็จ')
  const url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=`Trunkhill-${booking.reference||booking.id}.png`;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),10000)
}
