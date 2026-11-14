import fs from 'node:fs'
function edit(path,changes){let s=fs.readFileSync(path,'utf8');for(const [a,b]of changes){if(!s.includes(a))throw Error(path+': missing '+a.slice(0,70));s=s.replace(a,b)}fs.writeFileSync(path,s)}
edit('app/camp-page.jsx',[
 ["const [zone,setZone] = useState('A')","const [zone,setZone] = useState('A')\n  const [mapZoom,setMapZoom] = useState(1)"],
 ['<WholeCampOption summary={selection}','<WholeCampOption'],
 ['onSelect={select} summary={selection}','onSelect={select}'],
 ["{!wholeCamp && zone !== 'BOX' && <div className=\"camp-desktop-selection\">{selection}</div>}",'<div className="camp-desktop-selection">{selection}</div>'],
 ["summary={!review && !wholeCamp && zone !== 'BOX' && selection}",'summary={!review && selection}'],
 ['<h3>จัดพื้นที่ล็อกได้อิสระ ไม่มีค่าใช้จ่ายเพิ่ม</h3>','<p className="plot-guidance"><CustomerIcon name="info"/> จัดพื้นที่ล็อกได้อิสระ ไม่มีค่าใช้จ่ายเพิ่ม</p>'],
 ['<><strong>ผังลาน</strong>','<><span>ผังลาน · คลิกในรูปเพื่อเลือกล็อก</span>'],
 ['mapDialog.current.showModal()','setMapZoom(1)\n                mapDialog.current.showModal()'],
 ['ผังลาน Trunkhill</h2>','ผังลาน Trunkhill Campfield</h2>'],
 ['<p className="small muted">เลื่อนรูปซ้าย–ขวาเพื่อดูผังขนาดใหญ่ แล้วแตะล็อกที่ต้องการ</p>','<div className="map-zoom-controls"><button type="button" className="button secondary" aria-label="ย่อผัง" disabled={mapZoom<=1} onClick={()=>setMapZoom(z=>Math.max(1,z-.25))}><CustomerIcon name="minus"/></button><button type="button" className="button secondary" onClick={()=>setMapZoom(1)}>{Math.round(mapZoom*100)}%</button><button type="button" className="button secondary" aria-label="ขยายผัง" disabled={mapZoom>=3} onClick={()=>setMapZoom(z=>Math.min(3,z+.25))}><CustomerIcon name="plus"/></button></div>'],
 ["<PlotMap rows={allRows.filter(row => row.kind === 'plot')}","<PlotMap zoom={mapZoom} rows={allRows.filter(row => row.kind === 'plot')}"],
 ['}}><span>เข้าพัก – วันออก</span>','}}><CustomerIcon name="calendar"/><span>เข้าพัก – วันออก</span>'],
 ['<span>ผู้เข้าพัก</span><strong>{guestCount}','<CustomerIcon name="guests"/><span>ผู้เข้าพัก</span><strong>{guestCount}'],
 ['<header className="customer-welcome"><h1>เลือกวันพัก แล้วเลือกมุมโปรดของคุณ</h1><p>วันเข้าพัก · จำนวนคน · ล็อกหรือห้องพัก</p></header>','<header className="customer-welcome">{catalog?.settings.welcome_title_enabled !== 0 && <h1>{catalog?.settings.welcome_title ?? "เลือกวันพัก แล้วเลือกมุมโปรดของคุณ"}</h1>}{catalog?.settings.welcome_subtitle_enabled !== 0 && <p>{catalog?.settings.welcome_subtitle ?? "วันเข้าพัก · จำนวนคน · ล็อกหรือห้องพัก"}</p>}</header>'],
])
edit('app/booking-review.jsx',[
 ['<span>นำ {row.name} ออก</span>','<span>ลบ</span>'],
 ["const [view,setView] = useState('items')","const [view,setView] = useState('items')\n  const [fieldErrors,setFieldErrors] = useState({})\n  function submit(event){\n    const form=event.currentTarget, data=new FormData(form), errors={}\n    if(!String(data.get('guest')||'').trim())errors.guest='กรุณากรอกชื่อผู้จอง'\n    if(!/^\\+?\\d{8,15}$/.test(String(data.get('phone')||'').replace(/[ ()-]/g,'')))errors.phone='กรุณากรอกเบอร์โทรให้ถูกต้อง'\n    setFieldErrors(errors)\n    if(Object.keys(errors).length){event.preventDefault();form.elements[Object.keys(errors)[0]].focus();return}\n    book(event)\n  }"],
 ['    <div className="customer-switch" aria-label="ขั้นตอนตรวจสอบการจอง">\n      <button type="button" aria-pressed={view === \'items\'} onClick={() => setView(\'items\')}>รายการที่จอง</button>\n      <button type="button" aria-pressed={view === \'guest\'} onClick={() => setView(\'guest\')}>ข้อมูลผู้จองและยอดรวม</button>\n    </div>',''],
 ["`รายการที่จอง (${lodging.length} ล็อก / ห้อง)`","'รายการที่จอง'"],
 ["{row.kind === 'plot' && row.code !== wholeCampCode ? 'Zone ' + row.zone + ' - ' : ''}{row.name}","{row.kind === 'plot' && row.code !== wholeCampCode ? row.code : row.name}"],
 ['onSubmit={book} hidden','onSubmit={submit} noValidate hidden'],
 ['name="guest" autoComplete','aria-invalid={!!fieldErrors.guest} aria-describedby={fieldErrors.guest ? "guest-error" : undefined} name="guest" autoComplete'],
 ['setGuest(event.target.value)}:{})}/></label>','setGuest(event.target.value)}:{})}/>{fieldErrors.guest&&<small id="guest-error" className="field-error" role="alert">{fieldErrors.guest}</small>}</label>'],
 ['name="phone" type="tel"','aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} name="phone" type="tel"'],
 ['readOnly:true}:{})}/></label>','readOnly:true}:{})}/>{fieldErrors.phone&&<small id="phone-error" className="field-error" role="alert">{fieldErrors.phone}</small>}</label>'],
 ["{(amendment?.noticeDays??settings?.reschedule_notice_days)===0?'ทำรายการได้ถึงวันเข้าพักเดิม':`โดยทำรายการล่วงหน้าอย่างน้อย ${amendment?.noticeDays??settings?.reschedule_notice_days??3} วัน`}","โดยต้องเลื่อนล่วงหน้าอย่างน้อย {amendment?.noticeDays??settings?.reschedule_notice_days??3} วันก่อนวันเข้าพักเดิม"],
 ['{receipt ? <div className="notice"','<button type="button" className="button secondary" onClick={()=>{setView(\'items\');window.scrollTo({top:0,behavior:\'smooth\'})}}>← กลับไปดูรายการที่จอง</button>\n          {receipt ? <div className="notice"'],
])
edit('app/booking/booking-management.jsx',[
 ['<h2 id="booking-summary-title">รายละเอียดการจอง','<h2 id="booking-summary-title"><CustomerIcon name="receipt"/> รายละเอียดการจอง'],
 ['<span className="notice">เลื่อน','<span className="notice"><CustomerIcon name="calendar"/> เลื่อน'],
 ["}>{status}</span>","}><CustomerIcon name={booking.status==='cancelled'?'close':'info'}/> {status}</span>"],
 ['        <h1>รายละเอียดการจอง</h1>',''],
 ['name="id" required maxLength={20}','name="id" required maxLength={64}'],
])
edit('app/booking/booking-editor.jsx',[
 ['<p>รหัสเดิม','<ul className="booking-edit-rules"><li>รหัสเดิม'],
 [' ครั้ง</p>\n    <p>คงข้อมูล',' ครั้ง</li>\n    <li>คงข้อมูล'],
 ['{money(booking.total)}</p>\n    <p>เลื่อน','{money(booking.total)}</li>\n    <li>เลื่อน'],
 ['ไม่ต้องรอแอดมินยืนยัน</p>','ไม่ต้องรอแอดมินยืนยัน</li></ul>'],
 ['     <div className="camp-zone-switch">{[\'A\',\'B\',\'C\',\'D\'].map(id=><button key={id} type="button" aria-pressed={zone===id} onClick={()=>setZone(id)}>Zone {id}</button>)}</div>',''],
 ['<h2>เลือกล็อกใหม่ให้ {active}</h2>','<h2>{active} <CustomerIcon name="arrow"/> {mapping[active] || "เลือกล็อกใหม่"}</h2>'],
 ['zone={zone} counts={counts}','counts={counts}'],
 ['rows.filter(i=>i.zone===zone).map','rows.map'],
 ['<p>เดิม {displayDate(booking.arrival)} – {displayDate(booking.departure)}</p>','<div className="reschedule-date old"><span>วันเข้าพักเดิม</span><strong>{displayDate(booking.arrival)} – {displayDate(booking.departure)}</strong></div>'],
 ['<p>ใหม่ {displayDate(arrival)} – {displayDate(departure)}</p>','<div className="reschedule-date new"><span><CustomerIcon name="calendar"/> วันเข้าพักใหม่</span><strong>{displayDate(arrival)} – {displayDate(departure)}</strong></div>'],
])
edit('app/rental-picker.jsx',[
 ['<span>{row.name}{max === 0 && <small>ไม่ว่าง</small>}</span><strong>{money(row.price)}</strong>','<span>{row.name}<small>{money(row.price)}</small>{max === 0 && <small>ไม่ว่าง</small>}</span>'],
])
edit('app/customer-icon.jsx',[
 ['faCalendarDays,faMapLocationDot','faFaceSadTear,faCalendarDays,faMapLocationDot'],
 ['const icons={calendar:','const icons={cry:faFaceSadTear,calendar:'],
])
console.log('Customer feedback updates applied')
