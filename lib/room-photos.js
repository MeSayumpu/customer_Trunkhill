import { claimUpload } from './storage'
import { roomPhotoLimit } from './room-gallery'

// Parses the room form's photo order: "cover" (current main photo), "g:<id>" (current extra photo),
// "n:<index>" (the index-th newly uploaded file). Returns null when the field is malformed.
export function readPhotoOrder(raw, uploadCount) {
  let order
  try { order = JSON.parse(String(raw || '[]')) } catch { return null }
  if (!Array.isArray(order) || order.length > roomPhotoLimit) return null
  const seen = new Set()
  for (const token of order) {
    if (typeof token !== 'string' || seen.has(token) || !/^(cover|g:\d{1,10}|n:\d{1,3})$/.test(token)) return null
    if (token.startsWith('n:') && Number(token.slice(2)) >= uploadCount) return null
    seen.add(token)
  }
  return order
}

// Rewrites a room's photos in the given order: the first becomes the main photo (inventory_photos),
// the rest are its extra photos (inventory_gallery). Stored contents are moved, never re-uploaded.
export async function saveRoomPhotos(connection, code, order, uploads) {
  const [[cover]] = await connection.execute('SELECT mime,photo FROM inventory_photos WHERE code=? FOR UPDATE',[code])
  const [gallery] = await connection.execute('SELECT id,mime,content FROM inventory_gallery WHERE code=? FOR UPDATE',[code])
  const claimed = []
  for (const value of uploads) claimed.push(await claimUpload(connection,value,'admin','image'))
  const byToken = new Map([
    ...(cover ? [['cover',{mime:cover.mime,content:cover.photo}]] : []),
    ...gallery.map(row => ['g:' + row.id,{mime:row.mime,content:row.content}]),
    ...claimed.map((file,index) => ['n:' + index,{mime:file.mime,content:file.content}]),
  ])
  const photos = order.map(token => byToken.get(token)).filter(Boolean)
  await connection.execute('DELETE FROM inventory_gallery WHERE code=?',[code])
  await connection.execute('DELETE FROM inventory_photos WHERE code=?',[code])
  const [first,...rest] = photos
  if (first) await connection.execute('INSERT INTO inventory_photos (code,mime,photo) VALUES (?,?,?)',[code,first.mime,first.content])
  for (const [index,photo] of rest.entries())
    await connection.execute('INSERT INTO inventory_gallery (code,mime,content,sort) VALUES (?,?,?,?)',[code,photo.mime,photo.content,index + 1])
  return claimed.length
}
