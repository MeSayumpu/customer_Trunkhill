import { database } from '../../lib/db'
import { effectiveStatus } from '../../lib/payment-rules'

// Slip images may be removed only from bookings that are over: cancelled or checked out, and this many days past check-out.
// The booking itself, its amounts and the slip's fingerprint (payment_file_claims, used to catch reused slips) all stay.
export const slipPurgeMinDays = 90
export const slipPurgeWord = 'ลบสลิป'
// Left in booking_payments.mime when the image is removed, so the admin pages can say where the slip went.
export const slipArchivedMime = 'archived'

const joins = 'FROM bookings b JOIN booking_payments p ON p.booking=b.id'
const finished = `((${effectiveStatus})='cancelled' OR EXISTS (SELECT 1 FROM booking_checkouts c WHERE c.booking=b.id AND c.completed_at IS NOT NULL))`
// Parameter: today (Thai date).
const overdue = `b.departure<=DATE_SUB(?,INTERVAL ${slipPurgeMinDays} DAY) AND ${finished}`
// Parameters: from, to, today (Thai date).
export const purgeable = `b.departure BETWEEN ? AND ? AND p.slip IS NOT NULL AND ${overdue}`
const slipBytes = `CASE WHEN LEFT(p.slip,9)='@storage:'
  THEN COALESCE((SELECT a.bytes FROM storage_assets a WHERE a.id=CONVERT(SUBSTRING(p.slip,10) USING ascii)),0) ELSE LENGTH(p.slip) END`

export const thaiToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())

// What a purge of this check-out period would remove, and how many slips in it must stay.
export async function purgeScope(from,to) {
  const today = thaiToday()
  const [[row]] = await database().execute(
    `SELECT COALESCE(SUM(${overdue}),0) AS eligible,
       COALESCE(SUM(CASE WHEN ${overdue} THEN ${slipBytes} ELSE 0 END),0) AS bytes,
       COUNT(*) AS slips
     ${joins} WHERE b.departure BETWEEN ? AND ? AND p.slip IS NOT NULL`,[today,today,from,to])
  return { eligible:Number(row.eligible), bytes:Number(row.bytes), kept:Number(row.slips) - Number(row.eligible) }
}
