// Minimal ZIP writer for backups: files are stored without compression (slips are already compressed images)
// and names are UTF-8. Each file is handed over whole, so sizes and CRC go in the header and any unzip tool opens it.
const table = new Uint32Array(256).map((_,index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (let index = 0; index < bytes.length; index++) crc = table[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
// Archives without the ZIP64 extension stop at 4 GB and 65,535 files.
export const zipMaxBytes = 0xFFFFFFFF - 1024 * 1024
export const zipMaxFiles = 0xFFFF

// files: async iterable of {name, content:Buffer, date?:Date}. Yields the archive piece by piece.
export async function* zipStream(files) {
  const entries = []
  let offset = 0
  for await (const file of files) {
    const name = Buffer.from(file.name)
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content)
    const date = file.date ?? new Date()
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
    const day = (Math.max(0,date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    const entry = { name, crc:crc32(content), size:content.length, time, day, offset }
    if (entries.length >= zipMaxFiles || offset + content.length + name.length + 30 > zipMaxBytes) throw new Error('ZIP too large')
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034B50,0); header.writeUInt16LE(20,4); header.writeUInt16LE(0x0800,6); header.writeUInt16LE(0,8)
    header.writeUInt16LE(time,10); header.writeUInt16LE(day,12); header.writeUInt32LE(entry.crc,14)
    header.writeUInt32LE(entry.size,18); header.writeUInt32LE(entry.size,22); header.writeUInt16LE(name.length,26)
    entries.push(entry)
    offset += header.length + name.length + content.length
    yield header; yield name; yield content
  }
  const start = offset
  for (const entry of entries) {
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014B50,0); record.writeUInt16LE(20,4); record.writeUInt16LE(20,6); record.writeUInt16LE(0x0800,8)
    record.writeUInt16LE(0,10); record.writeUInt16LE(entry.time,12); record.writeUInt16LE(entry.day,14)
    record.writeUInt32LE(entry.crc,16); record.writeUInt32LE(entry.size,20); record.writeUInt32LE(entry.size,24)
    record.writeUInt16LE(entry.name.length,28); record.writeUInt32LE(entry.offset,42)
    offset += record.length + entry.name.length
    yield record; yield entry.name
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10)
  end.writeUInt32LE(offset - start,12); end.writeUInt32LE(start,16)
  yield end
}
