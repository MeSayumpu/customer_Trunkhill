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

export const blackoutReason = row => `การจองช่วง ${row.label} (${blackoutRange(row)}) ไม่สามารถเลื่อนได้ กรุณาติดต่อแอดมิน`
