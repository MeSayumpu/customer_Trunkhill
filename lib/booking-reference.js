// Public references stay fixed even when arrival or plots change. Internal IDs remain unchanged.
export function referenceBase(arrival, code) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival) || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(code)) throw new Error('Invalid reference source')
  return arrival.slice(8,10) + arrival.slice(5,7) + arrival.slice(2,4) + code
}

export async function assignReference(connection,id,arrival,code) {
  const [[existing]]=await connection.execute('SELECT reference FROM booking_references WHERE booking=?',[id])
  if(existing)return existing.reference
  const base=referenceBase(arrival,code)
  await connection.execute('INSERT INTO booking_reference_counters (base,sequence) VALUES (?,1) ON DUPLICATE KEY UPDATE sequence=sequence+1',[base])
  const [[counter]]=await connection.execute('SELECT sequence FROM booking_reference_counters WHERE base=? FOR UPDATE',[base])
  const reference=base+(Number(counter.sequence)>1?'-'+String(counter.sequence).padStart(2,'0'):'')
  await connection.execute('INSERT INTO booking_references (booking,reference) VALUES (?,?)',[id,reference])
  return reference
}
