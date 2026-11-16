'use server'
import { redirect } from 'next/navigation'
import { isAdmin } from '../../lib/auth'
import { transaction } from '../../lib/db'
import { isCalendarDate } from '../../lib/booking-dates'
import { ensureStorage, lockStorage } from '../../lib/storage'
import { purgeable, slipArchivedMime, slipPurgeWord, thaiToday } from './booking-backup-data'

const page = params => '/admin?' + new URLSearchParams({section:'storage',...params})

// Removes the slip images of finished bookings in a check-out period, after the admin has downloaded the backup.
// Bookings, totals and slip fingerprints stay; only the image bytes go, and that cannot be undone.
export async function purgeSlips(data) {
  if (!await isAdmin()) redirect('/admin')
  const from = String(data.get('from') || ''), to = String(data.get('to') || '')
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) redirect(page({purge:'invalid'}))
  if (data.get('downloaded') !== 'on' || String(data.get('confirm') || '').trim() !== slipPurgeWord) redirect(page({purge:'unconfirmed',purgeFrom:from,purgeTo:to}))
  const removed = await transaction(async db => {
    await lockStorage(db)
    const [result] = await db.execute(
      `UPDATE booking_payments p JOIN bookings b ON b.id=p.booking SET p.slip=NULL,p.mime=? WHERE ${purgeable}`,[slipArchivedMime,from,to,thaiToday()])
    // Frees the stored files that no row points to any more.
    await ensureStorage(db)
    return result.affectedRows
  })
  redirect(page({purged:String(removed)}))
}
