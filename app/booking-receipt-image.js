import { translate, formatMoney } from '../lib/i18n'

// Same look as the result card on the payment page (.payment-receipt in customer-ui.css): colours, font and order.
const font = '"IBM Plex Sans Thai",system-ui,"Leelawadee UI",Tahoma,sans-serif'
const color = { bg:'#f6f2e9', card:'#fff', line:'#e4ddcc', forest:'#1f4a37', forest50:'#eef5f0', ink:'#17301f', muted:'#5d6d61',
  totalBg:'#e6f3ea', totalLine:'#bfdcc8' }
const width = 1000, cardX = 40, left = 100, right = 900, center = 500
const maxItems = 6

function roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath()
  ctx.moveTo(x + r,y)
  ctx.arcTo(x + w,y,x + w,y + h,r); ctx.arcTo(x + w,y + h,x,y + h,r); ctx.arcTo(x,y + h,x,y,r); ctx.arcTo(x,y,x + w,y,r)
  ctx.closePath()
}

// Draws the proof-of-submission image in the visitor's language (pass the useI18n() value) and returns it as a PNG file.
export async function bookingReceiptFile(booking, i18n = {}){
  const lang=i18n.lang||'th'
  const t=(text,params)=>translate(lang,text,params)
  const money=value=>formatMoney(lang,value)
  const date=value=>value.split('-').reverse().join('/')
  const nights=Math.round((Date.parse(booking.departure)-Date.parse(booking.arrival))/86400000)
  // The page font is declared with font-display:swap, so each weight is requested before drawing.
  await Promise.all([400,600,700].map(weight=>document.fonts.load(`${weight} 30px "IBM Plex Sans Thai"`,'กขค Abc 123'))).catch(()=>{})
  await document.fonts.ready
  const logo=new Image();logo.src='/camp-logo-transparent.webp'
  const hasLogo=await logo.decode().then(()=>true,()=>false)

  const rows=[
    ...(booking.guest?[[t('ผู้จอง'),booking.guest]]:[]),
    [t('วันเข้าพัก'),date(booking.arrival)],
    [t('วันออก'),date(booking.departure)+' · '+t('{n} คืน',{n:nights})],
  ]
  const items=booking.items.slice(0,maxItems).map(item=>[`${t(item.name)} × ${item.quantity}`,item.amount==null?'':money(item.amount)])
  const more=booking.items.length-items.length

  // Vertical layout first, so the card is exactly as tall as its content.
  const logoW=190,logoH=hasLogo?Math.round(logoW*logo.naturalHeight/logo.naturalWidth):0
  const rowH=58
  let y=cardX+56
  const at={}
  at.logo=y; y+=logoH+(hasLogo?34:0)
  at.check=y+68; y+=136+44
  at.title=y+36; y+=64
  at.subtitle=y+26; y+=62
  at.code=y; y+=160+34
  at.rows=y; y+=rows.length*rowH+18
  at.itemsTitle=y+28; y+=52
  at.items=y; y+=items.length*rowH+(more>0?46:0)+22
  at.total=y; y+=96+38
  at.note1=y+22; y+=40
  at.note2=y+22; y+=58
  at.brand=y+22; y+=56
  const cardH=y-cardX,height=y+cardX

  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  const text=(value,x,baseline,{size=28,weight=400,fill=color.ink,align='center',max=right-left,spacing='0px'}={})=>{
    ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=fill;ctx.textAlign=align;ctx.letterSpacing=spacing
    ctx.fillText(value,x,baseline,max)
  }
  const rule=lineY=>{ctx.strokeStyle=color.line;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(left,lineY);ctx.lineTo(right,lineY);ctx.stroke()}

  ctx.fillStyle=color.bg;ctx.fillRect(0,0,width,height)
  ctx.save()
  ctx.shadowColor='rgba(23,48,31,.14)';ctx.shadowBlur=40;ctx.shadowOffsetY=14
  roundRect(ctx,cardX,cardX,width-2*cardX,cardH,36);ctx.fillStyle=color.card;ctx.fill()
  ctx.restore()
  roundRect(ctx,cardX,cardX,width-2*cardX,cardH,36);ctx.strokeStyle=color.line;ctx.lineWidth=2;ctx.stroke()

  if(hasLogo){
    // Faint watermark behind the content, as on the page.
    const markW=720,markH=markW*logo.naturalHeight/logo.naturalWidth
    ctx.save();ctx.globalAlpha=.05;ctx.drawImage(logo,center-markW/2,cardX+cardH*.3,markW,markH);ctx.restore()
    ctx.drawImage(logo,center-logoW/2,at.logo,logoW,logoH)
  }

  // Check badge: forest circle with a soft ring.
  ctx.fillStyle='rgba(31,74,55,.12)';ctx.beginPath();ctx.arc(center,at.check,68,0,Math.PI*2);ctx.fill()
  ctx.fillStyle=color.forest;ctx.beginPath();ctx.arc(center,at.check,52,0,Math.PI*2);ctx.fill()
  ctx.strokeStyle='#fff';ctx.lineWidth=9;ctx.lineCap='round';ctx.lineJoin='round'
  ctx.beginPath();ctx.moveTo(center-22,at.check+2);ctx.lineTo(center-6,at.check+18);ctx.lineTo(center+24,at.check-16);ctx.stroke()

  text(booking.total>0?t('ส่งหลักฐานการชำระเงินแล้ว'):t('ส่งคำขอจองแล้ว'),center,at.title,{size:46,weight:700})
  text(t(booking.status==='confirmed'?'แคมป์ยืนยันการจองแล้ว':booking.total>0?'แคมป์จะตรวจสอบสลิปก่อนยืนยันการจอง':'รอแคมป์ยืนยันการจอง'),center,at.subtitle,{size:28})

  // Booking code box: dashed forest border on the pale green fill.
  roundRect(ctx,left,at.code,right-left,160,24);ctx.fillStyle=color.forest50;ctx.fill()
  ctx.save();ctx.setLineDash([8,7]);ctx.strokeStyle=color.forest;ctx.lineWidth=2;ctx.stroke();ctx.restore()
  text(t('รหัสการจอง'),center,at.code+52,{size:25,fill:color.muted})
  text(booking.reference||booking.id,center,at.code+118,{size:54,weight:700,spacing:'2px',max:right-left-60})

  rows.forEach(([label,value],index)=>{
    const baseline=at.rows+index*rowH+38
    text(label,left,baseline,{size:27,fill:color.muted,align:'left',max:260})
    text(value,right,baseline,{size:27,weight:600,align:'right',max:520})
    rule(at.rows+(index+1)*rowH)
  })

  text(t('รายการที่จอง'),left,at.itemsTitle,{size:29,weight:700,align:'left'})
  items.forEach(([label,amount],index)=>{
    const baseline=at.items+index*rowH+38
    text(label,left,baseline,{size:27,align:'left',max:amount?560:right-left})
    if(amount)text(amount,right,baseline,{size:27,align:'right',max:220})
    if(index<items.length-1||more>0)rule(at.items+(index+1)*rowH)
  })
  if(more>0)text(t('และอีก {n} รายการ',{n:more}),left,at.items+items.length*rowH+34,{size:25,fill:color.muted,align:'left'})

  // Total: the green summary bar from the review page.
  roundRect(ctx,left,at.total,right-left,96,24);ctx.fillStyle=color.totalBg;ctx.fill();ctx.strokeStyle=color.totalLine;ctx.lineWidth=2;ctx.stroke()
  text(t('ยอดจอง'),left+30,at.total+60,{size:30,weight:700,fill:'#173b2c',align:'left',max:300})
  text(money(booking.total),right-30,at.total+63,{size:42,weight:700,fill:color.forest,align:'right',max:420})

  text(t('ใช้รหัสจองและเบอร์โทรเพื่อตรวจสอบหรือเลื่อนการจอง'),center,at.note1,{size:24,fill:color.muted})
  text(t('หลักฐานนี้ไม่ใช่การยืนยันว่าเงินเข้าบัญชีแล้ว'),center,at.note2,{size:23,fill:color.muted})
  text('Trunkhill Campfield'+(i18n.phone?' · '+i18n.phone:''),center,at.brand,{size:25,weight:600,fill:color.forest})

  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
  if(!blob)throw new Error('สร้างรูปไม่สำเร็จ')
  return new File([blob],`Trunkhill-${booking.reference||booking.id}.png`,{type:'image/png'})
}

export function downloadReceiptFile(file){
  const url=URL.createObjectURL(file),link=document.createElement('a')
  link.href=url;link.download=file.name;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),10000)
}

// Phones that can hand an image to the system share sheet ("Save Image" puts it in the photo library, or send to LINE).
export function canShareReceipt(file){
  try{return matchMedia('(pointer:coarse)').matches&&!!navigator.canShare?.({files:[file]})}catch{return false}
}
