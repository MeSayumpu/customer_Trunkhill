export function guardPhone(value) {
  let phone=String(value||'').replace(/[ ()-]/g,'')
  if (/^(?:\+66|0066|66)\d{9}$/.test(phone)) phone='0'+phone.replace(/^(?:\+66|0066|66)/,'')
  return phone
}

export async function lockPhoneGuard(connection,value) {
  const phone=guardPhone(value)
  await connection.execute('INSERT IGNORE INTO booking_phone_guards (phone) VALUES (?)',[phone])
  const [[row]]=await connection.execute('SELECT * FROM booking_phone_guards WHERE phone=? FOR UPDATE',[phone])
  return row
}
