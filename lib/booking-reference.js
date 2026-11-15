// Public references stay fixed even when arrival or plots change. Internal IDs remain unchanged.
export function referenceBase(arrival, code) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival) || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(code)) throw new Error('Invalid reference source')
  return arrival.slice(8,10) + arrival.slice(5,7) + arrival.slice(2,4) + code
}

// The first booking for a date and plot gets the bare base; later ones get -02, -03, …
// The number is the lowest one not held by an existing booking, so a booking that was deleted
// (cancelled before payment, or never paid) gives its number back.
export async function assignReference(connection,id,arrival,code) {
  const [[existing]]=await connection.execute('SELECT reference FROM booking_references WHERE booking=?',[id])
  if(existing)return existing.reference
  const base=referenceBase(arrival,code)
  // The counter row is the lock: two bookings for the same base take their numbers one after the other.
  await connection.execute('INSERT INTO booking_reference_counters (base,sequence) VALUES (?,0) ON DUPLICATE KEY UPDATE sequence=sequence',[base])
  await connection.execute('SELECT sequence FROM booking_reference_counters WHERE base=? FOR UPDATE',[base])
  const [rows]=await connection.execute("SELECT reference FROM booking_references WHERE reference=? OR reference LIKE CONCAT(?,'-%')",[base,base])
  const used=new Set(rows.map(row=>row.reference===base?1:/^-\d{2,}$/.test(row.reference.slice(base.length))?Number(row.reference.slice(base.length+1)):0))
  let sequence=1
  while(used.has(sequence))sequence++
  const reference=base+(sequence>1?'-'+String(sequence).padStart(2,'0'):'')
  await connection.execute('UPDATE booking_reference_counters SET sequence=? WHERE base=?',[sequence,base])
  await connection.execute('INSERT INTO booking_references (booking,reference) VALUES (?,?)',[id,reference])
  return reference
}
