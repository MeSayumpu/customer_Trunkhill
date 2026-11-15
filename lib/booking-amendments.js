import {createHash} from 'node:crypto'
import {transaction} from './db'
import {bookingIdentity,phoneNumber,CampError,integer,codePattern,dates,today,lookup,lockStaySettings,openCalendar,assertStayAvailable,assertStock} from './camp'
import {rescheduleReason,rescheduleLimit,rescheduleNotice,stayNights,shiftDate} from './booking-dates'
import {wholeCampCode} from './whole-camp'
import {lockPhoneGuard} from './phone-guard'
import {rescheduleBlackout,blackoutReason} from './reschedule-blackout'

export async function amendBooking(body,commit=false) {
 const identity=bookingIdentity(body.id,phoneNumber(body.phone))
 const allowed=new Set(['action','id','phone','revision','arrival','departure','plotChanges'])
 if(Object.keys(body).some(key=>!allowed.has(key))) throw new CampError('แก้ไขได้เฉพาะวันที่และล็อก กรุณารีเฟรชหน้า')
 if(!integer(body.revision,0,255))throw new CampError('กรุณาค้นหาการจองใหม่')
 const changes=body.plotChanges??[]
 if(!Array.isArray(changes)||changes.length>40||changes.some(i=>!i||typeof i.from!=='string'||typeof i.to!=='string'||!codePattern.test(i.from)||!codePattern.test(i.to)))throw new CampError('ข้อมูลล็อกไม่ถูกต้อง')
 if(new Set(changes.map(i=>i.from)).size!==changes.length)throw new CampError('ล็อกต้นทางซ้ำ')
 const proposal={arrival:body.arrival,departure:body.departure,plotChanges:changes.map(({from,to})=>({from,to})).sort((a,b)=>a.from.localeCompare(b.from))}
 const nights=dates(proposal.arrival,proposal.departure)
 const hash=createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
 const result=await transaction(async connection=>{
  const [[booking]]=await connection.execute('SELECT * FROM bookings WHERE id=? AND phone=? FOR UPDATE',identity)
  if(!booking)throw new CampError('ไม่พบรายการจอง',404)
  const [[previous]]=await connection.execute('SELECT request_hash FROM booking_reschedule_history WHERE booking=? AND revision=?',[booking.id,body.revision+1])
  if(commit&&previous?.request_hash===hash&&booking.reschedule_count===body.revision+1)return
  if(booking.reschedule_count!==body.revision)throw new CampError('ข้อมูลเปลี่ยนแล้ว กรุณาค้นหาการจองใหม่',409)
  const [[payment]]=await connection.execute('SELECT submitted_at FROM booking_payments WHERE booking=?',[booking.id])
  const [[checkout]]=await connection.execute('SELECT completed_at FROM booking_checkouts WHERE booking=?',[booking.id])
  if(nights.length!==stayNights(booking.arrival,booking.departure))throw new CampError('ต้องคงจำนวนคืนเท่ากับการจองเดิม')
  const guard=await lockPhoneGuard(connection,booking.phone)
  if(guard.blocked_at)throw new CampError('เบอร์โทรนี้ถูกระงับ กรุณาติดต่อแอดมิน',403)
  const [oldLines]=await connection.execute('SELECT * FROM booking_lines WHERE booking=? ORDER BY code',[booking.id])
  const [oldRentals]=await connection.execute('SELECT host,code,quantity FROM booking_rentals WHERE booking=? ORDER BY host,code',[booking.id])
  if(!oldLines.length)throw new CampError('ไม่พบรายการที่จอง กรุณาติดต่อแอดมิน',409)
  const whole=oldLines.some(i=>i.code===wholeCampCode)
  const settings=await lockStaySettings(connection,whole)
  const notice=settings.reschedule_notice_days??rescheduleNotice
  const reason=rescheduleReason({...booking,payment_required:!!payment,payment_submitted:!!payment?.submitted_at,checked_out:!!checkout?.completed_at},today(),notice,settings.reschedule_limit??rescheduleLimit)
  if(reason)throw new CampError(reason,409)
  const blackout=await rescheduleBlackout(connection,booking.arrival,booking.departure)
  if(blackout)throw new CampError(blackoutReason(blackout),409)
  if(proposal.arrival<shiftDate(today(),notice))throw new CampError(`วันเข้าพักใหม่ต้องห่างจากวันนี้อย่างน้อย ${notice} วัน`,409)
  const codes=[...new Set([...oldLines.map(i=>i.code),...changes.map(i=>i.to)])].sort()
  const inventory=new Map()
  for(const code of codes){const [[row]]=await connection.execute('SELECT * FROM inventory WHERE code=? FOR UPDATE',[code]);if(row)inventory.set(code,row)}
  const mapping=new Map(changes.map(i=>[i.from,i.to]))
  for(const {from,to} of changes){
   if(!oldLines.some(i=>i.code===from)||from===wholeCampCode||to===wholeCampCode||inventory.get(from)?.kind!=='plot'||inventory.get(to)?.kind!=='plot')throw new CampError('เปลี่ยนได้เฉพาะล็อกลาน จำนวนล็อกและประเภทการจองต้องคงเดิม')
  }
  const lines=oldLines.map(line=>({...line,code:mapping.get(line.code)??line.code,name:mapping.has(line.code)&&mapping.get(line.code)!==line.code?inventory.get(mapping.get(line.code)).name:line.name}))
  if(new Set(lines.map(i=>i.code)).size!==lines.length)throw new CampError('เลือกล็อกปลายทางซ้ำกัน กรุณาเลือกคนละล็อก')
  const rentals=oldRentals.map(line=>({...line,host:mapping.get(line.host)??line.host}))
  if(booking.arrival===proposal.arrival&&booking.departure===proposal.departure&&changes.every(i=>i.from===i.to))throw new CampError('ยังไม่ได้เปลี่ยนวันที่หรือล็อก')
  const rows=lines.map(line=>({...inventory.get(line.code),quantity:line.quantity}))
  if(rows.some(i=>!i.code||(!i.active&&i.code!==wholeCampCode)))throw new CampError('มีรายการเดิมไม่เปิดให้จอง กรุณาติดต่อแอดมิน',409)
  await openCalendar(connection,nights)
  await assertStayAvailable(connection,proposal.arrival,proposal.departure,whole,booking.id)
  await assertStock(connection,rows,proposal.arrival,proposal.departure,booking.id)
  const snapshot=(arrival,departure,items,rentalLines)=>({arrival,departure,items:items.map(({code,name,quantity,amount})=>({code,name,quantity,amount})),rentalLines})
  const before=snapshot(booking.arrival,booking.departure,oldLines,oldRentals)
  const after=snapshot(proposal.arrival,proposal.departure,lines,rentals)
  if(!commit)return {before,after,total:booking.total,revision:body.revision+1}
  await connection.execute('DELETE FROM allocations WHERE booking=?',[booking.id])
  await connection.execute('DELETE FROM booking_rentals WHERE booking=?',[booking.id])
  await connection.execute('DELETE FROM booking_lines WHERE booking=?',[booking.id])
  await connection.query('INSERT INTO booking_lines (booking,code,name,quantity,amount,room_adults,room_seniors,room_children) VALUES ?',[lines.map(i=>[booking.id,i.code,i.name,i.quantity,i.amount,i.room_adults??null,i.room_seniors??null,i.room_children??null])])
  if(rentals.length)await connection.query('INSERT INTO booking_rentals (booking,host,code,quantity) VALUES ?',[rentals.map(i=>[booking.id,i.host,i.code,i.quantity])])
  await connection.query('INSERT INTO allocations (code,night,booking,quantity) VALUES ?',[lines.flatMap(i=>nights.map(n=>[i.code,n,booking.id,i.quantity]))])
  await connection.execute('UPDATE bookings SET arrival=?,departure=?,reschedule_count=reschedule_count+1 WHERE id=?',[proposal.arrival,proposal.departure,booking.id])
  await connection.execute('INSERT INTO booking_reschedule_history (booking,revision,request_hash,before_state,after_state) VALUES (?,?,?,?,?)',[booking.id,body.revision+1,hash,JSON.stringify(before),JSON.stringify(after)])
 })
 return commit?lookup(...identity):result
}
