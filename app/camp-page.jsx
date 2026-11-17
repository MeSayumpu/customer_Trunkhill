'use client'

import { CustomerIcon } from './customer-icon'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link, { PendingScreen } from './pending-ui'
import { useRouter } from 'next/navigation'
import {useCampOptions} from './use-camp-options'
import { money, stayPricing } from '../lib/pricing'
import { DatePicker, GuestPicker, displayDate, guestTypes } from './booking-pickers'
import { RoomGuestPicker } from './room-guest-picker'
import { BookingReview } from './booking-review'
import { BookingSteps } from './booking-steps'
import { PageHero } from './page-hero'
import { CampHeader, campZoneLabel, MobileCampMenu, useCampDetails } from './camp-navigation'
import { draftKey, readBookingDraft } from './booking-draft'
import { TentGlyph, TentList, TentMap } from './tent-map'
import { readCamp as read } from './camp-request'
import { CampLoader } from './camp-loader'
import { mapPosition } from '../lib/plot-map'
import { wholeCampCode, wholeCampName, wholeCampTier } from '../lib/whole-camp'
import { WholeCampOption } from './whole-camp-option'
import { TrunkboxOption } from './trunkbox-option'
import { useConfirm } from './confirm-dialog'
import { UnavailableDialog } from './unavailable-dialog'
import { useI18n } from './i18n'
import { ContactList } from './camp-contacts'
import { locationLinks } from '../lib/camp-contacts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { zoneFeatureIcon } from '../lib/zone-features'


const thaiDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' })
const nextDay = value => new Date(Date.parse(value) + 86400000).toISOString().slice(0,10)
const dayCount = (a,b) => (Date.parse(b) - Date.parse(a)) / 86400000
const compactDateRange = (arrival,departure) => arrival.slice(0,7) === departure.slice(0,7)
  ? Number(arrival.slice(-2)) + '–' + displayDate(departure)
  // Same year: drop the first year so the range fits the search card on phones (30/11 – 3/12/2026).
  : arrival.slice(0,4) === departure.slice(0,4)
    ? displayDate(arrival).replace(/\/\d{4}$/, '') + ' – ' + displayDate(departure)
    : displayDate(arrival) + ' – ' + displayDate(departure)

function MapDialog({onClose,children}) {
  const {t} = useI18n()
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    if (!element.open) element.showModal()
  },[])
  return <dialog ref={dialog} className="dialog map-dialog" aria-labelledby="plot-map-title" onClose={onClose}>
    <header className="dialog-header">
      <span className="dialog-header-icon" aria-hidden="true"><CustomerIcon name="tents"/></span>
      <h2 id="plot-map-title">{t('ผังลาน Trunkhill Campfield')}</h2>
      <form method="dialog"><button className="icon-button" aria-label={t('ปิดผังลาน')}><CustomerIcon name="close"/></button></form>
    </header>
    {children}
  </dialog>
}

export default function CampPage({ review: initialReview = false, amendment = null }) {
  const confirm = useConfirm()
  const {t,msg,money,lang} = useI18n()
  const [editReview,setEditReview] = useState(false)
  const review = amendment ? editReview : initialReview
  const [editGuest,setEditGuest] = useState(amendment?.booking.guest || '')
  const [editQuote,setEditQuote] = useState(null)
  const router = useRouter()
  const [navigating,startNavigation] = useTransition()
  const [zone,setZone] = useState('A')
  const [mapOpen,setMapOpen] = useState(false)
  const options=useCampOptions()
  const tabs=options.zones.map(zone=>[zone,campZoneLabel(zone)])
  const [arrival,setArrival] = useState('')
  const [departure,setDeparture] = useState('')
  const [today,setToday] = useState('')
  const [datePickerKey,setDatePickerKey] = useState(0)
  const [checked,setChecked] = useState(null)
  const [catalog,setCatalog] = useState(null)
  const [counts,setCounts] = useState({})
  const [wholeCamp,setWholeCamp] = useState(false)
  const [rentalsByLock,setRentalsByLock] = useState({})
  const [guests,setGuests] = useState({adults:0,children:0,seniors:0})
  // Guests of each picked Trunkbox room: {code:{adults,seniors,children}}. The guests state above is for the plots only.
  const [roomGuests,setRoomGuests] = useState({})
  const [roomPick,setRoomPick] = useState(null)
  const [guestWarning,setGuestWarning] = useState(false)
  const [availabilityError,setAvailabilityError] = useState('')
  const [bookingError,setBookingError] = useState('')
  // Rows of the "choose again" dialog while a booking was refused for items that are not free; null = closed.
  const [unavailable,setUnavailable] = useState(null)
  const [loading,setLoading] = useState(false)
  const [bookingBusy,setBookingBusy] = useState(false)
  const [receipt,setReceipt] = useState(null)
  const request = useRef(null)
  const activeCheck = useRef(null)
  const dateDialog = useRef(null)
  const guestDialog = useRef(null)
  const roomGuestDialog = useRef(null)
  const guestWarningDialog = useRef(null)
  const {dialogs,...menuActions} = useCampDetails({zone,gear:catalog?.inventory.filter(row => row.kind === 'gear')})

  async function checkDates(start = arrival, end = departure, keepSelection = false) {
    activeCheck.current?.abort()
    const controller = new AbortController()
    activeCheck.current = controller
    setLoading(true)
    setAvailabilityError('')
    try {
      const data = amendment
        ? await read('/api/camp',{action:'editCatalog',id:amendment.booking.id,phone:amendment.phone,arrival:start,departure:end},controller.signal)
        : await read('/api/camp?' + new URLSearchParams({arrival:start,departure:end}), null, controller.signal)
      if (controller.signal.aborted) return
      setCatalog(data)
      setChecked({arrival:start,departure:end})
      setCounts(previous => amendment && keepSelection ? previous : keepSelection ? Object.fromEntries(data.inventory
        .filter(row => previous[row.code] && Number(row.available) > 0)
        .map(row => [row.code, Math.min(previous[row.code], Number(row.available))])) : {})
      setRentalsByLock(previous => keepSelection ? previous : {})
    } catch (error) {
      if (!controller.signal.aborted) {
        setChecked(null)
        setAvailabilityError(error.message)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const currentDate = thaiDate.format(new Date())
    setToday(currentDate)
    if (amendment) {
      const booking=amendment.booking
      const counts=Object.fromEntries(booking.lines.filter(row=>row.code!==wholeCampCode).map(row=>[row.code,row.quantity]))
      const rentals={}
      for(const row of booking.rentalLines) {
        const host=row.host_code
        rentals[host] ||= {}
        rentals[host][row.code]=(rentals[host][row.code]||0)+row.quantity
        counts[row.code]=(counts[row.code]||0)-row.quantity
      }
      setCounts(counts);setRentalsByLock(rentals)
      setWholeCamp(booking.lines.some(row=>row.code===wholeCampCode))
      setGuests({adults:booking.adults,children:booking.children,seniors:booking.seniors})
      const firstZone=booking.lines.find(row=>counts[row.code]>0&&tabs.some(([id])=>id===row.zone))?.zone
      if(firstZone)setZone(firstZone)
      setArrival(booking.arrival);setDeparture(booking.departure)
      void checkDates(booking.arrival,booking.departure,true)
      return ()=>activeCheck.current?.abort()
    }
    const draft = readBookingDraft()
    const validDraft = draft?.arrival >= currentDate && dayCount(draft.arrival,draft.departure) >= 1 &&
      dayCount(draft.arrival,draft.departure) <= 30
    const start = validDraft ? draft.arrival : currentDate
    const end = validDraft ? draft.departure : nextDay(start)
    if (validDraft) {
      setGuests(draft.guests)
      setCounts(draft.counts)
      setWholeCamp(draft.wholeCamp === true)
      setRentalsByLock(draft.rentalsByLock || {})
      setRoomGuests(draft.roomGuests || {})
      if (tabs.some(([id]) => id === draft.zone)) setZone(draft.zone)
    }
    setArrival(start)
    setDeparture(end)
    void checkDates(start,end,validDraft)
    return () => activeCheck.current?.abort()
  }, [])

  const ready = !!catalog && checked?.arrival === arrival && checked?.departure === departure && !loading
  const allRows = catalog?.inventory || []
  const visible = allRows.filter(row => zone === 'BOX' ? row.zone === 'BOX' : row.kind === 'plot')
  const hasMap = zone !== 'BOX' && (!visible.length || visible.some(mapPosition))
  const tier = wholeCamp ? wholeCampTier(guests.adults,catalog?.wholeCampTiers) : null
  const wholeCampItem = { code:wholeCampCode, name:wholeCampName, kind:'plot', quantity:1 }
  // A room only counts as picked once its guests are known (a booking being amended keeps its rooms as they are).
  const liveCounts = amendment ? counts : Object.fromEntries(Object.entries(counts).filter(([code]) =>
    allRows.find(row => row.code === code)?.kind !== 'room' || roomGuests[code]))
  const hosts = wholeCamp ? (ready && catalog.wholeCampAvailable ? [wholeCampItem] : [])
    : allRows.filter(row => row.kind !== 'gear' && liveCounts[row.code])
    .map(row => ({ ...row, quantity:liveCounts[row.code], ...(row.kind === 'room' && roomGuests[row.code] ? { guests:roomGuests[row.code] } : {}) }))
  // The plot guest picker only counts when something other than rooms is booked; room guests are added on top.
  const pickedRooms = hosts.filter(row => row.kind === 'room' && row.guests)
  const onlyRooms = hosts.length > 0 && hosts.every(row => row.kind === 'room')
  const totalGuests = Object.fromEntries(['adults','children','seniors'].map(key =>
    [key,(onlyRooms ? 0 : guests[key]) + pickedRooms.reduce((sum,row) => sum + row.guests[key],0)]))
  const guestCount = Object.values(totalGuests).reduce((sum, count) => sum + count, 0)
  const rentalLines = hosts.flatMap(host => allRows
    .filter(row => (row.kind === 'gear' || (!wholeCamp && row.kind === 'room')) && rentalsByLock[host.code]?.[row.code] > 0)
    .map(row => ({ host:host.code, code:row.code, quantity:rentalsByLock[host.code][row.code] })))
  const combined = wholeCamp ? {} : { ...liveCounts }
  for (const { code, quantity } of rentalLines) combined[code] = (combined[code] || 0) + quantity
  const selected = [
    ...(wholeCamp ? hosts : []),
    ...allRows.filter(row => combined[row.code]).map(row => hosts.find(host => host.code === row.code && host.guests) ?? { ...row, quantity:combined[row.code] }),
  ]
  const nights = ready ? dayCount(arrival,departure) : 0
  const pricing = ready ? stayPricing(selected,catalog.settings,totalGuests.adults,catalog.rates,
    wholeCamp ? (tier ? catalog.wholeCampPrices[tier.maxGuests] : 0) : null, totalGuests.seniors) : null
  // A plot needs an adult or a senior from the main guest picker; children alone cannot book one.
  const plotNeedsGrownUp = !wholeCamp && hosts.some(row => row.kind === 'plot') && guests.adults + guests.seniors < 1
  const total = pricing?.total ?? 0
  const maxWholeCampGuests = catalog?.wholeCampTiers.at(-1)?.maxGuests
  // Whole camp: everyone counts towards the largest group the admin has priced, children and seniors included.
  const tooManyGuests = wholeCamp && ready && (guestCount > maxWholeCampGuests || (guestCount > 0 && !guests.adults))
  const wholeCampUnavailable = ready && wholeCamp && !catalog.wholeCampAvailable
  const wholeCampError = wholeCampUnavailable ? t('เหมาลานไม่ได้ เพราะมีรายการจองในช่วงวันที่เลือก')
    : tooManyGuests ? (guests.adults ? t('เหมาลานรับผู้เข้าพักได้สูงสุด {n} คน รวมทุกประเภท กรุณาปรับจำนวนผู้เข้าพัก',{n:maxWholeCampGuests}) : t('เหมาลานต้องมีผู้ใหญ่อย่างน้อย 1 คน')) : ''
  const guestSummary = t('{n} คน',{n:guestCount}) + (guestCount > 0 ? ' · ' +
    guestTypes.filter(([key]) => totalGuests[key]).map(([key,label]) => t(label) + ' ' + totalGuests[key]).join(' / ') : '')
  const selectedNames = selected.map(row => row.name + (row.quantity > 1 ? ' × ' + row.quantity : ''))
  const mode = wholeCamp ? 'whole' : zone === 'BOX' ? 'box' : 'plots'

  useEffect(() => {
    if (ready && !amendment) sessionStorage.setItem(draftKey, JSON.stringify({ arrival, departure, guests, counts, zone, rentalsByLock, wholeCamp, roomGuests }))
  }, [ready, arrival, departure, guests, counts, zone, rentalsByLock, wholeCamp])

  // A quote is only valid for the selection it was worked out for. Nothing is scheduled when there is no quote: an
  // update here on every change kept re-rendering the page while the saved selection was still being restored after a
  // reload (each of those renders made a new counts object, which ran this effect again), and the page never got ready.
  useEffect(()=>{if(editQuote!==null)setEditQuote(null)},[arrival,departure,guests,counts,rentalsByLock,wholeCamp,editGuest,catalog])

  function confirmClear(title) {
    return confirm({
      title,
      message:'รายการที่เลือกไว้ทั้งหมดจะถูกนำออก ต้องการดำเนินการต่อหรือไม่?',
      items:selectedNames,
      confirmLabel:'ล้างรายการและดำเนินการต่อ',
      cancelLabel:'เก็บรายการไว้',
    })
  }

  async function changeDates(start, end) {
    if (start === arrival && end === departure) return
    if (!amendment && selected.length && !(await confirmClear(t('เปลี่ยนวันเข้าพัก?')))) return
    activeCheck.current?.abort()
    setLoading(false)
    setAvailabilityError('')
    setChecked(null)
    if (!amendment) {setCounts({});setRentalsByLock({});setRoomGuests({})}
    setArrival(start)
    setDeparture(end)
    void checkDates(start,end,!!amendment)
  }

  function changeBookingType(exclusive) {
    setWholeCamp(exclusive)
    setCounts({})
    setRentalsByLock({})
    setRoomGuests({})
    setBookingError('')
  }

  async function switchMode(next) {
    const exclusive = next === 'whole'
    if (exclusive !== wholeCamp) {
      if (selected.length && !(await confirmClear(t('เปลี่ยนประเภทการจอง?')))) return
      changeBookingType(exclusive)
    }
    if (!exclusive) setZone(next === 'box' ? 'BOX' : 'A')
  }

  function select(code, quantity) {
    if (code === wholeCampCode) {
      changeBookingType(false)
      return
    }
    setCounts(previous => ({ ...previous, [code]: quantity }))
    if (!quantity) {
      setRentalsByLock(previous => ({ ...previous, [code]: {} }))
      setRoomGuests(({[code]:removed,...rest}) => rest)
    }
    setBookingError('')
  }

  async function requestRemove(code) {
    const row = code === wholeCampCode ? wholeCampItem : allRows.find(item => item.code === code)
    const attached = rentalLines.filter(line => line.host === code)
      .map(line => (allRows.find(item => item.code === line.code)?.name || line.code) + ' × ' + line.quantity)
    const name = row?.name || code
    const accepted = await confirm({
      title:code === wholeCampCode ? t('ยกเลิกการเหมาลาน?') : t('นำ {name} ออกจากรายการ?',{name}),
      message:attached.length ? 'อุปกรณ์ที่เช่าไว้กับรายการนี้จะถูกนำออกด้วย' : 'คุณสามารถเลือกกลับมาใหม่ได้ภายหลัง หากยังว่างอยู่',
      items:attached,
      confirmLabel:'นำออก',
      cancelLabel:'เก็บไว้',
    })
    if (accepted) select(code, 0)
  }

  // Tapping a picked plot or room again just unpicks it. It only asks first when rented gear would go with it.
  function toggleOff(code) {
    if (rentalLines.some(line => line.host === code)) return requestRemove(code)
    select(code, 0)
  }

  function selectPlot(row, quantity) {
    // A Trunkbox room tapped on the map goes through the room's own steps (who stays in it first), exactly as on the
    // Trunkbox tab, and the page stays on the map. A room already rented with a plot is left alone.
    if (row.kind === 'room') {
      if (liveCounts[row.code]) return toggleOff(row.code)
      if (!combined[row.code]) openRoomGuests(row.code)
      return
    }
    if (!quantity) return toggleOff(row.code)
    if (tabs.some(([id]) => id === row.zone)) setZone(row.zone)
    select(row.code, quantity)
  }

  // Picking a Trunkbox room (or editing one already picked) asks who stays in it first.
  function openRoomGuests(code) {
    setRoomPick(code)
    roomGuestDialog.current.showModal()
    roomGuestDialog.current.scrollTop = 0
  }

  function confirmRoomGuests(code, value) {
    setRoomGuests(previous => ({ ...previous, [code]: value }))
    select(code, 1)
    roomGuestDialog.current.close()
  }

  function confirmRentals(host, quantities) {
    setRentalsByLock(previous => ({ ...previous, [host]: quantities }))
    setBookingError('')
  }

  function goReview() {
    // Plots are priced by the guests of the main picker, so a plot needs them even when a room already has guests.
    if (!guestCount || plotNeedsGrownUp) {
      setGuestWarning(guests.children > 0 && plotNeedsGrownUp ? 'children' : true)
      guestWarningDialog.current.showModal()
      return
    }
    if(amendment){setEditReview(true);window.scrollTo({top:0,behavior:'smooth'});return}
    sessionStorage.setItem(draftKey, JSON.stringify({ arrival, departure, guests, counts, zone, rentalsByLock, wholeCamp, roomGuests }))
    startNavigation(() => router.push('/review'))
  }

  // A refused booking that names the items it could not reserve opens the "choose again" dialog. It lists everything
  // that was picked (as it was when the customer pressed confirm) and marks the items that are not free.
  function showUnavailable(error) {
    if (!error.unavailable?.length) return
    const failed = new Map(error.unavailable.map(item => [item.code,item]))
    const label = row => (row.kind === 'plot' && row.code !== wholeCampCode ? row.code : t(row.name)) + (row.kind === 'gear' ? ' × ' + row.quantity : '')
    const note = item => !item ? t('ยังว่าง') : item.closed ? t('ปิดรับจอง')
      : item.left > 0 ? t('เหลือ {left} ต้องการ {wanted}',{left:item.left,wanted:item.wanted}) : t('ไม่ว่างแล้ว')
    setUnavailable({left:Object.fromEntries(error.unavailable.map(item => [item.code,item.left])),rows:[
      ...selected.map(row => ({code:row.code,label:label(row),ok:!failed.has(row.code),note:note(failed.get(row.code))})),
      ...error.unavailable.filter(item => !selected.some(row => row.code === item.code))
        .map(item => ({code:item.code,label:t(item.name),ok:false,note:note(item)})),
    ]})
  }

  // The only way out of that dialog: back to the picker. Items that are still free stay picked; equipment rented with
  // a plot is cut down to what is left (plots, rooms and loose equipment are trimmed by the availability check).
  function chooseAgain() {
    const left = { ...unavailable?.left }
    const rentals = Object.fromEntries(Object.entries(rentalsByLock).map(([host,items]) => [host,Object.fromEntries(
      Object.entries(items).map(([code,quantity]) => {
        if (!(code in left)) return [code,quantity]
        const kept = Math.min(quantity,left[code])
        left[code] -= kept
        return [code,kept]
      }))]))
    setUnavailable(null)
    setBookingError('')
    setEditQuote(null)
    setRentalsByLock(rentals)
    if (amendment) {
      setEditReview(false)
      window.scrollTo({top:0,behavior:'smooth'})
      return
    }
    sessionStorage.setItem(draftKey, JSON.stringify({ arrival, departure, guests, counts, zone, rentalsByLock:rentals, wholeCamp, roomGuests }))
    startNavigation(() => router.push('/'))
  }

  async function book(event) {
    event.preventDefault()
    if (!ready || !selected.length || bookingBusy || tooManyGuests) return
    if (!guestCount) {
      setBookingError(t('กรุณาเลือกจำนวนผู้เข้าพักก่อนยืนยันการจอง'))
      return
    }
    if (plotNeedsGrownUp) {
      setBookingError(t('การจองล็อกต้องมีผู้ใหญ่หรือผู้สูงอายุอย่างน้อย 1 คน'))
      return
    }
    const fields = new FormData(event.currentTarget)
    if (amendment) {
      setBookingBusy(true);setBookingError('');setEditQuote(null)
      const payload={...totalGuests,arrival,departure,guest:editGuest,id:amendment.booking.id,phone:amendment.phone,
        revision:amendment.booking.reschedule_count,items:selected.map(({code,quantity})=>({code,quantity})),rentalLines}
      try {setEditQuote({payload,...await read('/api/camp',{...payload,action:'quoteAmendment'})})}
      catch(error){setBookingError(error.message);showUnavailable(error)}finally{setBookingBusy(false)}
      return
    }
    const payload = {
      ...totalGuests, arrival, departure, guest:fields.get('guest'), phone:fields.get('phone'),
      items:selected.map(({code,quantity,guests}) => guests ? {code,quantity,guests} : {code,quantity}), expectedTotal:total,
      ...(tier ? { expectedWholeCampFreeUnits:tier.freeUnits } : {}),
      ...(rentalLines.length ? { rentalLines } : {}),
    }
    const fingerprint = JSON.stringify(payload)
    if (request.current?.fingerprint !== fingerprint) request.current = {
      fingerprint,key:crypto.randomUUID(),
      token:(crypto.randomUUID() + crypto.randomUUID()).replaceAll('-',''),
    }
    setBookingBusy(true)
    setBookingError('')
    try {
      const {key,token} = request.current
      const booking = await read('/api/camp',{...payload,requestKey:key,paymentToken:token})
      sessionStorage.setItem('trunkhill-payment-' + booking.id,token)
      sessionStorage.removeItem(draftKey)
      request.current = null
      startNavigation(() => router.push('/payment?id=' + booking.id))
    } catch (error) {
      setBookingError(error.message)
      showUnavailable(error)
      if (error.status === 409) await checkDates(arrival,departure,true)
    } finally {
      setBookingBusy(false)
    }
  }

  async function saveAmendment() {
    if(!editQuote||bookingBusy)return
    setBookingBusy(true);setBookingError('')
    try {amendment.onSaved(await read('/api/camp',{...editQuote.payload,action:'amendBooking',expectedTotal:editQuote.total,expectedFreeUnits:editQuote.freeUnits}))}
    catch(error){setBookingError(error.message);setEditQuote(null);showUnavailable(error)}finally{setBookingBusy(false)}
  }

  async function discardAmendment() {
    const accepted = await confirm({
      title:'ออกโดยไม่บันทึก?',
      message:'การแก้ไขวัน ผู้เข้าพัก ล็อก และอุปกรณ์ที่ยังไม่บันทึกจะถูกยกเลิกทั้งหมด',
      confirmLabel:'ทิ้งการแก้ไข',
      cancelLabel:'แก้ไขต่อ',
    })
    if (accepted) amendment.onClose()
  }

  // On the Trunkbox tab with no plot picked, guests come from the room pickers alone.
  const roomsOnlyMode = !amendment && mode === 'box' && !hosts.some(row => row.kind === 'plot')
  const reviewDisabled = !ready || !selected.length || tooManyGuests
  const dateLabel = arrival && departure ? compactDateRange(arrival,departure) : t('เลือกวันที่')

  // Highlights first, then facilities, as picked for the plot in admin.
  const plotFeatureItems = row => row.features ? [...row.features.highlights,...row.features.facilities] : []
  const plotFeatureChips = row => plotFeatureItems(row).length > 0 && <ul className="summary-item-features" role="list" aria-label={t('จุดเด่นและสิ่งอำนวยความสะดวก')}>
    {plotFeatureItems(row).map((item,index) => <li key={index} title={(lang === 'en' ? item.noteEn : item.note) || undefined}>
      <FontAwesomeIcon icon={zoneFeatureIcon(item.icon)}/>{lang === 'en' ? item.labelEn || t(item.label) : item.label}
    </li>)}
  </ul>
  // Small screens have no summary sidebar, so the picked plots' features sit under the map there.
  const pickedPlotFeatures = hosts.filter(row => plotFeatureItems(row).length > 0)
  const summaryItems = hosts.length > 0 && <ul className="summary-items" role="list" aria-label={t('ล็อกและห้องพักที่เลือก')}>
    {hosts.map(row => {
      const attached = rentalLines.filter(line => line.host === row.code)
      return <li key={row.code}>
        <span className="summary-item-icon" aria-hidden="true">
          {row.kind === 'room' ? <CustomerIcon name="cabin"/> : <TentGlyph status="selected"/>}
        </span>
        <span className="summary-item-text">
          <strong>{t(row.name)}</strong>
          <small>{row.code === wholeCampCode ? t('ทั้งลานตลอดช่วงที่เลือก') : row.detail || campZoneLabel(row.zone)}</small>
          {plotFeatureChips(row)}
          {attached.length > 0 && <small className="summary-item-extra">+ {attached.map(line => (allRows.find(item => item.code === line.code)?.name || line.code) + ' × ' + line.quantity).join(', ')}</small>}
        </span>
        <button type="button" className="icon-button remove-button" aria-label={t('นำ {name} ออก',{name:t(row.name)})}
          disabled={!ready || bookingBusy} onClick={() => requestRemove(row.code)}>
          <CustomerIcon name="remove"/>
        </button>
      </li>
    })}
  </ul>

  const asideSummary = <aside className="booking-aside" aria-label={t('สรุปรายการที่เลือก')}>
    <div className="summary-card">
      <header className="summary-head">
        <span className="eyebrow">{t('การจองของคุณ')}</span>
        <h2>{hosts.length ? (wholeCamp ? t('เหมาลาน') : t('{n} รายการ',{n:hosts.length})) : t('ยังไม่ได้เลือกล็อก')}</h2>
      </header>
      <dl className="summary-facts">
        <div><dt><CustomerIcon name="calendar"/>{t('เข้าพัก')}</dt><dd>{dateLabel}{nights ? ' · ' + t('{n} คืน',{n:nights}) : ''}</dd></div>
        <div><dt><CustomerIcon name="guests"/>{t('ผู้เข้าพัก')}</dt><dd>{t('{n} คน',{n:guestCount})}</dd></div>
      </dl>
      {summaryItems || <div className="summary-empty">
        <TentGlyph status="available"/>
        <p>{t(mode === 'box' ? 'เลือกห้อง Trunkbox ที่ต้องการ' : mode === 'whole' ? 'ตรวจสอบว่าลานว่างครบทุกคืนที่เลือก' : 'แตะล็อกบนผังเพื่อเลือก')}</p>
      </div>}
      <div className="summary-total">
        <span>{t('ยอดรวมโดยประมาณ')}</span>
        <strong>{money(total)}</strong>
      </div>
      <button className="button button-lg review-button" disabled={reviewDisabled} onClick={goReview}>
        {t('สรุปการจอง')}<CustomerIcon name="arrow"/>
      </button>
      <p className="summary-note">{t('ยังไม่มีการชำระเงินในขั้นตอนนี้')}</p>
    </div>
  </aside>

  const dockSummary = <div className="dock-summary">
    {hosts.length > 0 && <ul className="dock-chips" role="list" aria-label={t('รายการที่เลือก')}>
      {hosts.map(row => <li key={row.code}>
        <span>{t(row.name)}</span>
        <button type="button" aria-label={t('นำ {name} ออก',{name:t(row.name)})} disabled={!ready || bookingBusy} onClick={() => requestRemove(row.code)}>
          <CustomerIcon name="close"/>
        </button>
      </li>)}
    </ul>}
    <div className="dock-summary-row">
      <div className="dock-total"><strong>{money(total)}</strong><small>{t('{n} รายการ',{n:selected.length})} · {nights ? t('{n} คืน',{n:nights}) : t('– คืน')}</small></div>
      <button className="button review-button" disabled={reviewDisabled} onClick={goReview}>{t('สรุปการจอง')}<CustomerIcon name="arrow"/></button>
    </div>
  </div>

  // English visitors get the admin's English text; when it is empty, the built-in translation of the Thai text.
  const welcomeText = (thai,english,fallback) => lang === 'en' && english?.trim() ? english : t(thai ?? fallback)
  const welcomeTitle = catalog?.settings.welcome_title_enabled !== 0 && welcomeText(catalog?.settings.welcome_title,catalog?.settings.welcome_title_en,'เลือกวันพัก แล้วเลือกมุมโปรดของคุณ')
  const welcomeSubtitle = catalog?.settings.welcome_subtitle_enabled !== 0 && welcomeText(catalog?.settings.welcome_subtitle,catalog?.settings.welcome_subtitle_en,'วันเข้าพัก · จำนวนคน · ล็อกหรือห้องพัก')
  const mapProps = { rows:visible, counts, ready, busy:bookingBusy, onSelect:selectPlot, mapVersion:catalog?.settings.map_version }
  // The map also shows the Trunkbox rooms the admin has drawn on it. A room counts as picked once its guests are set
  // (as on the Trunkbox tab) or when it is rented together with a plot.
  const mapRows = allRows.filter(row => row.kind === 'plot' || (!wholeCamp && row.kind === 'room'))
  const mapCounts = { ...counts }
  for (const row of allRows) if (row.kind === 'room') {
    if (combined[row.code]) mapCounts[row.code] = combined[row.code]
    else delete mapCounts[row.code]
  }

  return <div className={'camp-home' + (review ? ' flow-page' : ' camp-front')}>
    {(bookingBusy || navigating) && <PendingScreen label={bookingBusy ? t('กำลังบันทึกการจอง…') : undefined}/>}
    <CampHeader page={review ? 'flow' : 'home'} onCampInfo={menuActions.onCampInfo} onZoneDetails={menuActions.onZoneDetails}/>

    {amendment && <div className="camp-shell amendment-banner">
      <section className="panel stack">
        <div className="amendment-banner-head">
          <span className="dialog-header-icon" aria-hidden="true"><CustomerIcon name="edit"/></span>
          <div><h1>{t('แก้ไขการจอง')}</h1>
            <p>{t('เลือกวัน ผู้เข้าพัก ล็อก / ห้อง และอุปกรณ์ แล้วตรวจส่วนต่างก่อนบันทึก ใช้สิทธิ์ 1 ครั้งเมื่อบันทึกสำเร็จ')}</p></div>
        </div>
        <p className="small muted">{t('ยอดระหว่างเลือกคำนวณตามราคาปัจจุบัน กรุณาตรวจยอดใหม่และส่วนต่างก่อนยืนยัน การแก้เฉพาะชื่อคงยอดเดิม')}</p>
        <div className="actions">
          {review&&<button className="button secondary" disabled={bookingBusy} onClick={()=>setEditReview(false)}><CustomerIcon name="back"/>{t('กลับไปเลือกวันและล็อก')}</button>}
          <button className="button secondary danger-text" disabled={bookingBusy} onClick={discardAmendment}>{t('กลับโดยไม่บันทึก')}</button>
        </div>
      </section>
    </div>}

    {review ? <>
      {!amendment && <PageHero aria-label={t('ขั้นตอนการจอง')}><BookingSteps current={2}/></PageHero>}
      <main className="camp-shell flow-shell">
      <BookingReview {...{ ready, loading, availabilityError, selected, nights, pricing, arrival, departure, guestSummary,
        bookingBusy, bookingError, receipt, book, select, confirmRentals, hosts, rentalLines, combined, wholeCamp, wholeCampError }}
        freeUnits={tier?.freeUnits} plotGuests={guests}
        gear={allRows.filter(row => row.kind === 'gear' || (!wholeCamp && row.kind === 'room'))} rentalsByLock={rentalsByLock}
        onRetry={() => checkDates(arrival, departure, true)}
        settings={catalog?.settings}
        amendment={amendment ? {guest:editGuest,setGuest:setEditGuest,phone:amendment.phone,quote:editQuote,save:saveAmendment,onBack:()=>setEditReview(false),noticeDays:amendment.booking.reschedule_notice_days,usedCount:amendment.booking.reschedule_count} : null}/>
    </main></> : <>
      {!amendment && <PageHero aria-labelledby="booking-title">
          {/* The tagline is switched on and off in admin (Settings › คำโปรยหน้าจอง); with both lines off, the steps sit at the top. */}
          {welcomeTitle || welcomeSubtitle ? <div className="booking-hero-copy">
            {welcomeTitle ? <h1 id="booking-title">{welcomeTitle}</h1> : <h1 id="booking-title" className="visually-hidden">{t('จองลานและอุปกรณ์')}</h1>}
            {welcomeSubtitle && <p>{welcomeSubtitle}</p>}
          </div> : <h1 id="booking-title" className="visually-hidden">{t('จองลานและอุปกรณ์')}</h1>}
          <BookingSteps current={1}/>
      </PageHero>}

      <main className="camp-shell booking-layout">
        <section className="booking-main" id="booking" aria-label={t('จองลานและอุปกรณ์')}>
          <div className="search-card">
            <button className="search-field" disabled={!today || bookingBusy} onClick={() => {
              setDatePickerKey(key => key + 1)
              dateDialog.current.showModal()
              dateDialog.current.scrollTop = 0
            }}>
              <span className="search-field-icon" aria-hidden="true"><CustomerIcon name="calendar"/></span>
              <span className="search-field-text"><span>{t('เข้าพัก – วันออก')}</span><strong>{dateLabel}</strong></span>
              {nights > 0 && <span className="search-field-badge">{t('{n} คืน',{n:nights})}</span>}
            </button>
            {/* Trunkbox guests are entered per room, so with only rooms in play this opens the room's own picker. */}
            <button className="search-field" disabled={bookingBusy || (roomsOnlyMode && !pickedRooms.length)} aria-invalid={guestWarning && !guestCount ? true : undefined}
              aria-describedby={guestWarning && !guestCount ? 'camp-guest-warning' : undefined} onClick={() => {
                if (roomsOnlyMode) return openRoomGuests(pickedRooms[0].code)
                guestDialog.current.showModal()
                guestDialog.current.scrollTop = 0
              }}>
              <span className="search-field-icon" aria-hidden="true"><CustomerIcon name="guests"/></span>
              <span className="search-field-text"><span>{t('ผู้เข้าพัก')}</span><strong>{guestCount ? t('{n} คน',{n:guestCount}) : roomsOnlyMode ? t('ระบุเมื่อเลือกห้อง') : t('เพิ่มผู้เข้าพัก')}</strong></span>
            </button>
          </div>

          {availabilityError && <div className="notice error actions" role="alert"><span>{msg(availabilityError)}</span>
            <button className="button secondary" onClick={() => checkDates(arrival,departure,true)}>{t('ลองอีกครั้ง')}</button></div>}

          <div className="mode-switch" role="group" aria-label={t('ประเภทการจอง')}>
            <button type="button" aria-pressed={mode === 'plots'} onClick={() => switchMode('plots')}>
              <CustomerIcon name="tent"/><span><strong>{t('เลือกล็อก')}</strong><small>{t('กางเต็นท์รายล็อก')}</small></span>
            </button>
            <button type="button" aria-pressed={mode === 'box'} onClick={() => switchMode('box')}>
              <CustomerIcon name="cabin"/><span><strong>Trunkbox</strong><small>{t('ห้องพักพร้อมนอน')}</small></span>
            </button>
            <button type="button" aria-pressed={mode === 'whole'} onClick={() => switchMode('whole')}>
              <CustomerIcon name="tents"/><span><strong>{t('เหมาลาน')}</strong><small>{t('ทั้งแคมป์สำหรับกลุ่ม')}</small></span>
            </button>
          </div>

          {mode === 'whole' ? <WholeCampOption available={ready && catalog.wholeCampAvailable && !tooManyGuests}
            tiers={catalog?.wholeCampTiers ?? []}
            onRetry={wholeCampUnavailable ? () => checkDates(arrival,departure,true) : undefined}
            status={wholeCampError || (loading ? t('กำลังตรวจสอบลานว่าง…') : ready ? t('ว่างสำหรับเหมาลานตลอดช่วงที่เลือก') : '')}/> : mode === 'box' ?
            <TrunkboxOption rooms={visible.filter(row=>row.kind==='room')} counts={liveCounts} ready={ready} busy={bookingBusy}
              roomGuests={roomGuests} onSelect={openRoomGuests} onRemove={toggleOff} text={options.trunkboxText}/> :
            <section className="panel map-panel" aria-labelledby="map-panel-title">
              <header className="map-panel-head">
                <div>
                  <h2 id="map-panel-title">{t('ผังลาน')}</h2>
                  <p><CustomerIcon name="info"/>{t('จัดพื้นที่ในล็อกได้อิสระ ไม่มีค่าใช้จ่ายเพิ่ม')}</p>
                </div>
                <button className="button secondary button-sm" type="button" aria-haspopup="dialog" aria-label={t('ดูรูปแต่ละโซน')} onClick={menuActions.onZoneDetails}>
                  <CustomerIcon name="gallery"/>{t('ดูรูป')}
                </button>
              </header>
              {ready && catalog.wholeCampBooked && <p className="notice error" role="status">{t('ช่วงวันที่เลือกมีผู้เหมาลานแล้ว กรุณาเลือกวันใหม่')}</p>}
              <div className="map-panel-body" aria-busy={loading || undefined}>
                {hasMap ? <TentMap {...mapProps} rows={mapRows} counts={mapCounts} onExpand={() => setMapOpen(true)}/>
                  : !ready ? <p className="empty">{t('เลือกวันเข้าพักเพื่อดูรายการว่าง')}</p>
                  : visible.length ? <TentList {...mapProps}/>
                  : <p className="empty">{t('โซนนี้ยังไม่มีรายการเปิดให้จอง')}</p>}
                {loading && <div className="map-loading"><CampLoader label={t('กำลังตรวจสอบลานว่าง…')}/></div>}
              </div>
              {pickedPlotFeatures.length > 0 && <ul className="picked-plot-features" role="list" aria-label={t('จุดเด่นและสิ่งอำนวยความสะดวก')}>
                {pickedPlotFeatures.map(row => <li key={row.code}>
                  <strong>{t(row.name)} · {campZoneLabel(row.zone)}</strong>
                  {plotFeatureChips(row)}
                </li>)}
              </ul>}
            </section>}
        </section>
        {asideSummary}
      </main>
    </>}

    <footer className="site-footer"><div className="camp-shell site-footer-inner">
      <span className="site-footer-brand"><img src="/camp-logo-transparent.webp" alt="" width="58" height="37"/>Trunkhill Campfield</span>
      <div className="actions"><ContactList contacts={options.contacts} compact/>
        {locationLinks(options.location) && <a className="site-footer-map" href={locationLinks(options.location).directions} target="_blank" rel="noopener noreferrer"
          aria-label={t('นำทางไปแคมป์')} title={t('นำทางไปแคมป์')}><img src="/map-directions.webp" alt="" width="36" height="36"/></a>}</div>
    </div></footer>

    <MobileCampMenu page={review ? 'flow' : 'home'} summary={!review && dockSummary} {...menuActions}/>

    <dialog ref={dateDialog} className="dialog booking-picker" aria-labelledby="date-title">
      <form method="dialog" className="dialog-close"><button className="icon-button" aria-label={t('ปิดตัวเลือกวันที่')}><CustomerIcon name="close"/></button></form>
      {today && <DatePicker key={datePickerKey} dialog={dateDialog} arrival={arrival} departure={departure} today={today} bookingWindow={catalog?.settings.booking_window} onConfirm={changeDates}/>}
    </dialog>
    <dialog ref={guestDialog} className="dialog booking-picker" aria-labelledby="guest-title">
      <form method="dialog" className="dialog-close"><button className="icon-button" aria-label={t('ปิดตัวเลือกผู้เข้าพัก')}><CustomerIcon name="close"/></button></form>
      <GuestPicker guests={guests} setGuests={setGuests} settings={catalog?.settings} rates={ready ? catalog.rates : []}
        dialog={guestDialog} wholeCamp={wholeCamp} guestInfo={options.guestTypes} guestRate={options.guestRate} maxTotal={wholeCamp ? maxWholeCampGuests : undefined}/>
    </dialog>
    <dialog ref={roomGuestDialog} className="dialog booking-picker" aria-labelledby="room-guest-title" onClose={() => setRoomPick(null)}>
      {roomPick && allRows.some(row => row.code === roomPick) && <RoomGuestPicker key={roomPick} room={allRows.find(row => row.code === roomPick)}
        initial={roomGuests[roomPick]} guestInfo={options.guestTypes}
        onConfirm={value => confirmRoomGuests(roomPick,value)} onCancel={() => roomGuestDialog.current.close()}/>}
    </dialog>
    <dialog ref={guestWarningDialog} className="dialog confirm-dialog tone-warning camp-guest-warning" aria-labelledby="camp-guest-warning"
      onClose={() => setGuestWarning(false)}>
      <div className="confirm-dialog-body">
        <span className="confirm-dialog-icon" aria-hidden="true"><CustomerIcon name="guests"/></span>
        <h2 id="camp-guest-warning" role="alert">{t(guestWarning === 'children' ? 'การจองล็อกต้องมีผู้ใหญ่หรือผู้สูงอายุอย่างน้อย 1 คน' : 'กรุณาเลือกจำนวนผู้เข้าพักก่อน')}</h2>
        <p className="confirm-dialog-message">{t(guestWarning === 'children' ? 'เด็กเข้าพักฟรีเมื่อมากับผู้ใหญ่หรือผู้สูงอายุ กรุณาเพิ่มผู้ใหญ่หรือผู้สูงอายุ' : 'ระบบใช้จำนวนผู้เข้าพักในการคำนวณราคา')}</p>
        <div className="confirm-dialog-actions">
          <form method="dialog"><button className="button secondary">{t('กลับ')}</button></form>
          <button className="button" type="button" onClick={() => {
            guestWarningDialog.current.close()
            guestDialog.current.showModal()
            guestDialog.current.scrollTop = 0
          }}>{t('เลือกจำนวนคน')}</button>
        </div>
      </div>
    </dialog>

    {mapOpen && <MapDialog onClose={() => setMapOpen(false)}>
      <TentMap {...mapProps} large rows={mapRows} counts={mapCounts}/>
    </MapDialog>}
    {dialogs}
    <UnavailableDialog rows={unavailable?.rows ?? null} onBack={chooseAgain}/>
  </div>
}
