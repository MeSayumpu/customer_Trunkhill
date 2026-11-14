import { transaction } from './db'

// Removes a booking that never reached payment, with everything that hangs off it.
// allocations → booking_lines has no cascade, so those go first; the rest cascades from bookings.
export async function deleteUnpaidBooking(connection, id) {
  await connection.execute('DELETE FROM allocations WHERE booking=?',[id])
  await connection.execute('DELETE FROM booking_rentals WHERE booking=?',[id])
  await connection.execute('DELETE FROM booking_lines WHERE booking=?',[id])
  await connection.execute('DELETE FROM bookings WHERE id=?',[id])
}

// Bookings whose payment window ran out with no slip sent are deleted outright instead of being kept as cancelled.
// There is no scheduler on the host, so this runs when a new booking is made and when the admin opens the bookings.
// Bookings with a slip (even a rejected duplicate) are never touched.
export async function purgeUnpaidBookings() {
  try {
    await transaction(async connection => {
      const [rows] = await connection.query(
        `SELECT b.id FROM bookings b JOIN booking_payments p ON p.booking=b.id
         WHERE b.status='pending' AND p.submitted_at IS NULL AND p.expires_at <= UTC_TIMESTAMP()
           AND NOT EXISTS(SELECT 1 FROM duplicate_slip_events e WHERE e.booking=b.id)
         ORDER BY b.id LIMIT 200 FOR UPDATE`)
      for (const {id} of rows) await deleteUnpaidBooking(connection,id)
    })
  } catch (error) {
    // Cleanup must never block a booking or the admin page; the next run picks the rows up again.
    console.error('purgeUnpaidBookings failed',error?.code || error?.message)
  }
}
