import { database, transaction } from './db'

// English versions of the texts the admin writes in Thai (item names and details, zone texts, facilities, the camp
// address, the bank and account names), kept as one map {thai: english} in camp_options. The customer pages add it to
// the dictionary, so every place that already calls t(thai) answers in English without knowing where the text came from.
// A text with no entry simply stays Thai.
const optionKey = 'translations'
const read = row => {
  const value = row && (typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json)
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export async function adminTranslations(connection = database()) {
  const [[row]] = await connection.execute('SELECT value_json FROM camp_options WHERE option_key=?',[optionKey])
  return read(row)
}

// pairs: [[thai, english, replaced]] as sent by an admin form. An empty English removes the entry. `replaced` is the
// Thai text this field held before, given only where that text is long and used nowhere else (the facilities pages),
// so its old entry does not pile up; short texts such as a room's detail may be shared by several rows and are kept.
export async function saveAdminTranslations(pairs) {
  const changes = pairs.map(row => row.map(text => String(text ?? '').trim()))
  await transaction(async connection => {
    const [[row]] = await connection.execute('SELECT value_json FROM camp_options WHERE option_key=? FOR UPDATE',[optionKey])
    const map = read(row)
    for (const [thai, english, replaced] of changes) {
      if (replaced && replaced !== thai) delete map[replaced]
      if (!thai) continue
      if (english) map[thai] = english
      else delete map[thai]
    }
    await connection.execute('INSERT INTO camp_options(option_key,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)',
      [optionKey,JSON.stringify(map)])
  })
}
