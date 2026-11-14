// Adds the table for images attached to "ข้อมูลทั่วไปและสิ่งอำนวยความสะดวก". Safe to run more than once.
//   node --env-file=.env.local scripts/facility-media-schema.mjs
import { readFile } from 'node:fs/promises'
import { createConnection } from 'mysql2/promise'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL first')
const connection = await createConnection({ uri:process.env.DATABASE_URL, multipleStatements:true })
await connection.query(await readFile(new URL('../db/facility-media.sql', import.meta.url), 'utf8'))
await connection.end()
console.log('facility_media is ready.')
