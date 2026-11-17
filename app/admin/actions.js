'use server'

import {campZones} from '../../lib/camp-options'
import { redirect } from 'next/navigation'
import { authenticate, clearSession, isAdmin, isStaff, setManagerPassword } from '../../lib/auth'
import { database, transaction } from '../../lib/db'
import {claimUpload,lockStorage,ensureStorage,storageId,StorageError} from '../../lib/storage'
import { codePattern, integer } from '../../lib/camp'
import { adminUrl, inventorySections } from './navigation'
import { liveAllocation, uploadMime } from '../../lib/payment-rules'
import { isTent } from '../../lib/rentals'
import { normalizeZoneFeatures, zoneFeatureGroups } from '../../lib/zone-features'
import { readPhotoOrder, saveRoomPhotos } from '../../lib/room-photos'
import { isCalendarDate } from '../../lib/booking-dates'
import { wholeCampCode, wholeCampGuestLimit, wholeCampRateFields } from '../../lib/whole-camp'

async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin')
}

// Bookings and blocked phones are open to the manager as well.
async function requireStaff() {
  if (!(await isStaff())) redirect('/admin')
}

export async function saveWelcome(data) {
  await requireAdmin()
  const title=String(data.get('title')||'').trim(),subtitle=String(data.get('subtitle')||'').trim()
  const titleEn=String(data.get('titleEn')||'').trim(),subtitleEn=String(data.get('subtitleEn')||'').trim()
  const titleEnabled=data.has('titleEnabled'),subtitleEnabled=data.has('subtitleEnabled')
  if(title.length>160||subtitle.length>240||titleEn.length>160||subtitleEn.length>240||(titleEnabled&&!title)||(subtitleEnabled&&!subtitle))redirect(adminUrl('settings',{group:'welcome',error:'invalid'}))
  await database().execute('UPDATE settings SET welcome_title=?,welcome_subtitle=?,welcome_title_en=?,welcome_subtitle_en=?,welcome_title_enabled=?,welcome_subtitle_enabled=? WHERE id=1',[title,subtitle,titleEn,subtitleEn,titleEnabled,subtitleEnabled])
  redirect(adminUrl('settings',{group:'welcome',saved:'settings'}))
}

// The admin sets the manager's password; the manager has no way to change it.
export async function saveManagerPassword(data) {
  await requireAdmin()
  const password = data.get('password')
  const saved = password === data.get('confirm') && await setManagerPassword(password)
  redirect(adminUrl('settings',{group:'staff',...(saved ? {saved:'managerPassword'} : {error:'managerPassword'})}))
}

export async function login(data) {
  redirect((await authenticate(data.get('account'),data.get('password'))) ? '/admin' : '/admin?error=login')
}

export async function logout() {
  await clearSession()
  redirect('/admin')
}

export async function changeStatus(data) {
  await requireStaff()
  const id = data.get('id')
  const status = data.get('status')
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id) || !['confirmed','cancelled'].includes(status)) redirect('/admin?error=invalid')
  const updated = await transaction(async connection => {
    const [[booking]] = await connection.execute('SELECT status FROM bookings WHERE id = ? FOR UPDATE', [id])
    if (!booking || booking.status === 'cancelled') return false
    if (status === 'confirmed') {
      const [[payment]] = await connection.execute('SELECT submitted_at FROM booking_payments WHERE booking=?',[id])
      if (payment && !payment.submitted_at) return false
    }
    if (status === 'cancelled') {
      const [[checkout]] = await connection.execute('SELECT completed_at FROM booking_checkouts WHERE booking=?',[id])
      if (checkout?.completed_at) return false
      const [lines] = await connection.execute('SELECT code FROM booking_lines WHERE booking = ? ORDER BY code', [id])
      for (const { code } of lines) await connection.execute('SELECT code FROM inventory WHERE code = ? FOR UPDATE', [code])
      await connection.execute('DELETE FROM allocations WHERE booking = ?', [id])
    }
    await connection.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, id])
    return true
  })
  redirect(adminUrl('bookings', { ...(updated ? {saved:'booking'} : {error:'invalid'}), q:data.get('q'), status:data.get('filterStatus'),
    ...Object.fromEntries(['from','to','kind','sort','size','page'].map(key=>[key,data.get(key)])) }))
}

// Free-text note on a booking, for the admin only (deposits taken, special requests, old-system remarks).
export async function saveBookingNote(data) {
  await requireStaff()
  const id = data.get('id')
  const note = String(data.get('note') || '').replace(/\r\n?/g,'\n').trim()
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id) || note.length > 1000) redirect('/admin?section=bookings&error=invalid')
  await database().execute('UPDATE bookings SET admin_note=? WHERE id=?',[note || null,id])
  redirect(adminUrl('bookings',{ saved:'note', view:id, q:data.get('q'), status:data.get('filterStatus'),
    ...Object.fromEntries(['from','to','madeFrom','madeTo','kind','sort','size','page','expand'].map(key=>[key,data.get(key)])) }))
}

export async function unlockPhone(data) {
  await requireStaff()
  const phone=String(data.get('phone')||'')
  const blockedAt=String(data.get('blockedAt')||'')
  if (!/^\+?\d{8,15}$/.test(phone) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(blockedAt)) redirect(adminUrl('blockedPhones',{error:'invalid'}))
  await database().execute('UPDATE booking_phone_guards SET duplicate_count=0,blocked_at=NULL,unlocked_at=UTC_TIMESTAMP() WHERE phone=? AND blocked_at=?',[phone,blockedAt])
  redirect(adminUrl('blockedPhones',{saved:'unlocked',q:phone}))
}

export async function saveSlipCheck(data) {
  await requireAdmin()
  await database().execute('UPDATE settings SET slip_duplicate_check=? WHERE id=1',[data.get('slipDuplicateCheck') === 'on' ? 1 : 0])
  redirect(adminUrl('payment',{saved:'payment'}))
}

export async function savePaymentConfig(data) {
  await requireAdmin()
  const recipient = String(data.get('recipient') || '').trim()
  const bankName = String(data.get('bankName') || '').trim()
  const bankAccount = String(data.get('bankAccount') || '').replace(/[ -]/g,'')
  const file = data.get('qr')
  if (!recipient || recipient.length > 120 || bankName.length > 120 || Boolean(bankName) !== Boolean(bankAccount) ||
      (bankAccount && !/^\d{6,20}$/.test(bankAccount))) {
    redirect(adminUrl('payment',{error:'invalid'}))
  }
  if (!storageId(file)) {
    const [result] = await database().execute('UPDATE payment_config SET recipient=?,bank_name=?,bank_account=? WHERE id=1',[recipient,bankName || null,bankAccount || null])
    redirect(adminUrl('payment',result.affectedRows ? {saved:'payment'} : {error:'invalid'}))
  }
  try {await transaction(async db=>{
  const {content:bytes,mime}=await claimUpload(db,file,'admin')
  await db.execute(
    'INSERT INTO payment_config (id,recipient,mime,qr,bank_name,bank_account) VALUES (1,?,?,?,?,?) ON DUPLICATE KEY UPDATE recipient=?,mime=?,qr=?,bank_name=?,bank_account=?',
    [recipient,mime,bytes,bankName || null,bankAccount || null,recipient,mime,bytes,bankName || null,bankAccount || null],
  )
  await ensureStorage(db)
  })}catch(error){if(error instanceof StorageError)redirect(adminUrl('payment',{error:'storage'}));throw error}
  redirect(adminUrl('payment',{saved:'payment'}))
}

export async function saveBookingPolicy(data) {
  await requireAdmin()
  const days=numberField(data,'noticeDays')
  const limit=numberField(data,'rescheduleLimit')
  if(!integer(days,0,365)||!integer(limit,0,255))redirect(adminUrl('bookingPolicy',{error:'invalid'}))
  await database().execute('UPDATE settings SET reschedule_notice_days=?,reschedule_limit=? WHERE id=1',[days,limit])
  redirect(adminUrl('bookingPolicy',{saved:'policy'}))
}

export async function addRescheduleBlackout(data) {
  await requireAdmin()
  const label = String(data.get('label') || '').trim()
  const start = String(data.get('start') || '')
  const end = String(data.get('end') || '')
  if (!label || label.length > 120 || !isCalendarDate(start) || !isCalendarDate(end) || end < start) redirect(adminUrl('bookingPolicy',{error:'invalid'}))
  await database().execute('INSERT INTO reschedule_blackouts (label,start_date,end_date) VALUES (?,?,?)',[label,start,end])
  redirect(adminUrl('bookingPolicy',{saved:'policy'}))
}

export async function deleteRescheduleBlackout(data) {
  await requireAdmin()
  const id = Number(data.get('id'))
  if (!integer(id,1,4294967295)) redirect(adminUrl('bookingPolicy',{error:'invalid'}))
  await database().execute('DELETE FROM reschedule_blackouts WHERE id=?',[id])
  redirect(adminUrl('bookingPolicy',{saved:'policy'}))
}

export async function saveSettings(data) {
  await requireAdmin()
  const mode = data.get('mode')
  const required = ['price','soloPrice'].map(field => numberField(data, field))
  const holiday = ['holidayPrice','holidaySoloPrice','holidayPlotPrice'].map(field => numberField(data, field))
  if (!['person','plot'].includes(mode) || !required.every(value => integer(value,0,100000)) ||
      !holiday.every(value => value === null || integer(value,0,100000))) {
    redirect(adminUrl('pricing', { error:'invalid' }))
  }
  await database().execute(
    `UPDATE settings SET mode=?,person_price=?,solo_person_price=?,
     holiday_person_price=?,holiday_solo_price=?,holiday_plot_price=? WHERE id=1`,
    [mode,...required,...holiday],
  )
  redirect(adminUrl('pricing', { saved:'settings' }))
}

export async function saveWholeCampRates(data) {
  await requireAdmin()
  const fields = [{name:'maxGuests', max:wholeCampGuestLimit}, ...wholeCampRateFields]
  const columns = fields.map(({name}) => data.getAll(`wholeCamp-${name}`))
  const groupCount = columns[0].length
  const invalid = () => redirect(adminUrl('pricing',{error:'wholeCampRates'}))
  if (!integer(groupCount,1,wholeCampGuestLimit) || columns.some(column => column.length !== groupCount)) invalid()

  let previousMax = 0
  const rates = Array.from({length:groupCount}, (_,index) => {
    const tier = Object.fromEntries(fields.map(({name,max},fieldIndex) => {
      const raw = columns[fieldIndex][index]
      const value = typeof raw === 'string' && raw.trim() ? Number(raw) : null
      if (!integer(value,name === 'maxGuests' ? previousMax + 1 : 0,max)) invalid()
      return [name,value]
    }))
    previousMax = tier.maxGuests
    return tier
  })
  await database().execute('UPDATE settings SET whole_camp_rates=? WHERE id=1',[JSON.stringify(rates)])
  redirect(adminUrl('pricing',{saved:'wholeCampRates'}))
}

export async function saveTentDiscount(data) {
  await requireAdmin()
  const discount = numberField(data, 'tentDiscount')
  const guestLimit = numberField(data, 'guestLimit')
  const codes = [...new Set(data.getAll('tentCode'))]
  if (!integer(discount,0,100000) || !integer(guestLimit,0,100) || !codes.length ||
      !codes.every(code => typeof code === 'string' && codePattern.test(code))) {
    redirect(adminUrl('gear',{tab:'tents',error:'invalid'}))
  }
  const placeholders = codes.map(() => '?').join(',')
  const updated = await transaction(async connection => {
    const [rows] = await connection.execute(
      `SELECT code FROM inventory WHERE kind='gear' AND is_tent=TRUE AND code IN (${placeholders}) FOR UPDATE`, codes,
    )
    if (rows.length !== codes.length) return false
    await connection.execute(
      `UPDATE inventory SET tent_discount_per_guest=?,tent_discount_guest_limit=?,tent_discount_tiers=NULL WHERE kind='gear' AND is_tent=TRUE AND code IN (${placeholders})`,
      [discount,guestLimit,...codes],
    )
    return true
  })
  redirect(adminUrl('gear',{tab:'tents',...(updated ? {saved:'tentDiscount'} : {error:'invalid'})}))
}

function numberField(data, field) {
  const value = data.get(field)
  return typeof value === 'string' && value.trim() ? Number(value) : null
}

function calendarFormUrl(data, params) {
  const day = data.get('calendarDay')
  return adminUrl('calendar',{day:isCalendarDate(day) ? day : undefined,...params})
}

export async function saveCalendarPeriod(data) {
  await requireAdmin()
  const id = numberField(data, 'periodId')
  const kind = data.get('kind')
  const label = String(data.get('label') || '').trim()
  const start = data.get('start')
  const end = data.get('end')
  const rates = kind === 'season' ? ['soloPrice','price','plotPrice'].map(field => numberField(data,field)) : [null,null,null]
  if ((id !== null && !integer(id,1,4294967295)) || !['closed','holiday','season'].includes(kind) ||
      !label || label.length > 120 || !isCalendarDate(start) || !isCalendarDate(end) || end < start ||
      (kind === 'season' && (!rates.slice(0,2).every(value => integer(value,0,100000)) ||
        (rates[2] !== null && !integer(rates[2],0,100000))))) {
    redirect(calendarFormUrl(data,{error:'invalid'}))
  }
  const error = await transaction(async connection => {
    await connection.query('SELECT id FROM settings WHERE id=1 FOR UPDATE')
    if (kind === 'season') {
      const [[overlap]] = await connection.execute(
        `SELECT id FROM camp_calendar WHERE kind='season' AND id<>? AND start_date<=? AND end_date>=? LIMIT 1`,
        [id ?? 0,end,start],
      )
      if (overlap) return 'seasonOverlap'
    }
    const values = [kind,label,start,end,...rates]
    if (id === null) {
      await connection.execute(
        `INSERT INTO camp_calendar (kind,label,start_date,end_date,solo_person_price,person_price,plot_price) VALUES (?,?,?,?,?,?,?)`,values)
    } else {
      const [result] = await connection.execute(
        `UPDATE camp_calendar SET kind=?,label=?,start_date=?,end_date=?,solo_person_price=?,person_price=?,plot_price=? WHERE id=?`,
        [...values,id],
      )
      if (!result.affectedRows) return 'invalid'
    }
  })
  redirect(calendarFormUrl(data,error ? {error} : {saved:'calendar'}))
}

export async function deleteCalendarPeriod(data) {
  await requireAdmin()
  const id = numberField(data, 'periodId')
  if (!integer(id,1,4294967295)) redirect(calendarFormUrl(data,{error:'invalid'}))
  await transaction(async connection => {
    await connection.query('SELECT id FROM settings WHERE id=1 FOR UPDATE')
    await connection.execute('DELETE FROM camp_calendar WHERE id=?',[id])
  })
  redirect(calendarFormUrl(data,{saved:'calendar'}))
}

export async function saveGearOrder(data) {
  await requireAdmin()
  const tab = data.get('tab') === 'tents' ? 'tents' : 'equipment'
  let codes = null
  try { codes = JSON.parse(data.get('codes')) } catch {}
  if (!Array.isArray(codes) || codes.length > 1000 || new Set(codes).size !== codes.length ||
      codes.some(code => typeof code !== 'string' || !codePattern.test(code))) redirect(adminUrl('gear',{tab,error:'invalid'}))
  await transaction(async connection => {
    // Only rental items of this tab are renumbered; anything not in the list keeps its place after them.
    for (const [index,code] of codes.entries()) {
      await connection.execute("UPDATE inventory SET sort_order=? WHERE code=? AND kind='gear' AND is_tent=?",[index + 1,code,tab === 'tents'])
    }
  })
  redirect(adminUrl('gear',{tab,saved:'inventory'}))
}

export async function saveInventory(data) {
  await requireAdmin()
  const original = data.get('original')
  const code = String(data.get('code')).trim().toUpperCase()
  const kind = data.get('kind')
  const zone = data.get('zone')
  const name = String(data.get('name')).trim()
  const detail = String(data.get('detail')).trim()
  const price = Number(data.get('price'))
  const stock = kind === 'gear' ? Number(data.get('stock')) : 1
  // Discount steps [[adults, rate], …]; the single-rate columns keep the largest step for older code paths.
  let discountTiers = []
  try { discountTiers = JSON.parse(data.get('tentDiscountTiers') || '[]') } catch { discountTiers = null }
  const tiersValid = Array.isArray(discountTiers) && discountTiers.length <= 10 &&
    discountTiers.every(tier => Array.isArray(tier) && tier.length === 2 && integer(tier[0],1,100) && integer(tier[1],1,100000)) &&
    new Set((discountTiers || []).map(tier => tier[0])).size === discountTiers.length
  if (tiersValid) discountTiers.sort((a,b) => a[0] - b[0])
  const [discountGuestLimit,discount] = (tiersValid && discountTiers.at(-1)) || [0,0]
  // Rooms: guests the price covers, the most adults + seniors the room takes, and the nightly charge per extra one.
  const roomGuests = kind === 'room' ? ['roomBaseGuests','roomMaxGuests','roomExtraGuestPrice'].map(name => numberField(data, name)) : [2,4,150]
  const roomGuestsValid = integer(roomGuests[0],1,20) && integer(roomGuests[1],roomGuests[0],20) && integer(roomGuests[2],0,100000)
  const active = data.has('active')
  const allowedZones = { plot: (await campZones()).filter(z=>z!=='BOX'), room: ['BOX'], gear: ['GEAR'] }
  const section = Object.hasOwn(inventorySections,kind) ? inventorySections[kind] : 'plots'
  const tab = data.get('tab')
  const listPage = name => { const value = data.get(name); return typeof value === 'string' && /^[A-Z0-9][A-Z0-9-]{0,23}$/.test(value) ? value : '' }
  const filters = { q:data.get('q'), zone:data.get('filterZone'), tab:kind === 'gear' && tab === 'tents' ? 'tents' : '', after:listPage('after'), before:listPage('before') }
  const file = data.get('photo')
  let photo
  let mime
  if (storageId(file)) {
    if (kind === 'plot') redirect(adminUrl(section, { ...filters, error:'photo' }))
    photo = file
  }
  // Rooms send all photos at once: the order (existing + new) and the new files as 'photos'.
  const roomUploads = kind === 'room' ? data.getAll('photos').filter(storageId) : []
  const photoOrder = kind === 'room' && data.has('photoOrder') ? readPhotoOrder(data.get('photoOrder'),roomUploads.length) : null
  if (kind === 'room' && data.has('photoOrder') && !photoOrder) redirect(adminUrl(section, { ...filters, error:'roomPhotoLimit' }))
  if (!codePattern.test(code) || code === wholeCampCode || (original && original !== code) ||
      !Object.hasOwn(allowedZones, kind) || !allowedZones[kind].includes(zone) ||
      !name || name.length > 120 || detail.length > 240 || !integer(price, 0, 100000) || !integer(stock, 0, 1000) ||
      !tiersValid || !roomGuestsValid) {
    redirect(adminUrl(section, { ...filters, error:'invalid' }))
  }

  let result
  let zoneFeatures = normalizeZoneFeatures(null)
  try {
    result = await transaction(async connection => {
      await lockStorage(connection)
      if(photo){const uploaded=await claimUpload(connection,photo,'admin');photo=uploaded.content;mime=uploaded.mime}
      if (kind === 'plot') {
        const [[targetZone]] = await connection.execute('SELECT zone,features FROM zone_details WHERE zone=? FOR UPDATE', [zone])
        if (!targetZone) return {error:'invalid'}
        zoneFeatures = normalizeZoneFeatures(targetZone.features)
      } else if (kind === 'room') {
        const [[box]] = await connection.execute('SELECT features FROM zone_details WHERE zone=?', [zone])
        zoneFeatures = normalizeZoneFeatures(box?.features)
      }
      const [[current]] = await connection.execute('SELECT * FROM inventory WHERE code = ? FOR UPDATE', [code])
      // Keep only ticks that exist in the plot's zone; everything ticked is stored as NULL so later additions to the zone show too.
      let plotFeatures = current?.zone === zone ? current.plot_features ?? null : null
      if (kind !== 'gear' && data.has('plotFeaturesForm')) {
        const ticked = new Set(data.getAll('plotFeature'))
        const picked = Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,
          zoneFeatures[group].filter(item => ticked.has(group + ':' + item.label)).map(item => item.label)]))
        const all = zoneFeatureGroups.every(([group]) => picked[group].length === zoneFeatures[group].length)
        plotFeatures = all ? null : JSON.stringify(picked)
      }
      const tent = kind === 'gear' && (data.has('rentalType') ? data.get('rentalType') === 'tents' : current ? isTent(current) : tab === 'tents')
      const discountValues = tent ? [discount,discountGuestLimit,discountTiers.length ? JSON.stringify(discountTiers) : null] : [null,null,null]
      if (!current && !original) {
        await connection.execute(
          `INSERT INTO inventory (code,kind,zone,name,detail,price,stock,active,is_tent,tent_discount_per_guest,tent_discount_guest_limit,tent_discount_tiers,plot_features,room_base_guests,room_max_guests,room_extra_guest_price)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [code,kind,zone,name,detail,price,stock,active,tent,...discountValues,plotFeatures,...roomGuests],
        )
      } else {
        if (!current || !original || current.kind !== kind) return {error:'invalid'}
        const [[{ peak }]] = await connection.execute(
          `SELECT COALESCE(MAX(used),0) AS peak FROM (
             SELECT SUM(quantity) AS used FROM allocations a WHERE code = ? AND night >= CURRENT_DATE
               AND ${liveAllocation} GROUP BY night
           ) nightly`, [code])
        if (stock < Number(peak)) return {error:'stock'}
        await connection.execute(
          `UPDATE inventory SET zone=?,name=?,detail=?,price=?,stock=?,active=?,is_tent=?,tent_discount_per_guest=?,tent_discount_guest_limit=?,tent_discount_tiers=?,plot_features=?,room_base_guests=?,room_max_guests=?,room_extra_guest_price=? WHERE code=?`,
          [zone,name,detail,price,stock,active,tent,...discountValues,plotFeatures,...roomGuests,code],
        )
      }
      if (photo) {
        await connection.execute(
          'INSERT INTO inventory_photos (code,mime,photo) VALUES (?,?,?) ON DUPLICATE KEY UPDATE mime=?, photo=?',
          [code,mime,photo,mime,photo],
        )
      }
      if (photoOrder && await saveRoomPhotos(connection,code,photoOrder,roomUploads)) photo = true
      if(photo)await ensureStorage(connection)
      return {saved:'inventory',tab:kind === 'gear' ? (tent ? 'tents' : 'equipment') : ''}
    })
  } catch (error) {
    if(error instanceof StorageError)redirect(adminUrl(section,{...filters,error:'storage'}))
    if (error.code !== 'ER_DUP_ENTRY') throw error
    result = {error:'invalid'}
  }
  redirect(adminUrl(section,{...filters,...result}))
}
