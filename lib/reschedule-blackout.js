// Periods (long weekends and the like) set by the admin in which a booked stay may not be moved.
// A stay counts when any of its nights falls inside a period.
export async function rescheduleBlackout(db, arrival, departure) {
  const [[row]] = await db.execute(
    `SELECT label,DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date,DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date
     FROM reschedule_blackouts WHERE start_date < ? AND end_date >= ? ORDER BY start_date LIMIT 1`,[departure,arrival])
  return row ?? null
}

const shortDate = value => Number(value.slice(8)) + '/' + Number(value.slice(5,7)) + '/' + value.slice(0,4)

export const blackoutRange = row => row.start_date === row.end_date ? shortDate(row.start_date) : shortDate(row.start_date) + ' – ' + shortDate(row.end_date)

// Shown to the guest when they try to move a stay that falls in such a period.
export const blackoutReason = () => 'ไม่สามารถเลื่อนวันเข้าพักในช่วงนี้ได้'
