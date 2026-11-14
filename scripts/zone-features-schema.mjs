// Adds zone_details.features (highlights + recommended facilities per zone). Safe to run more than once.
//   node --env-file=.env.local scripts/zone-features-schema.mjs
import { createConnection } from 'mysql2/promise'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL first')
const connection = await createConnection({ uri:process.env.DATABASE_URL })
const [[exists]] = await connection.execute(
  "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='zone_details' AND column_name='features'")
if (!exists) await connection.query('ALTER TABLE zone_details ADD COLUMN features LONGTEXT NULL')
await connection.end()
console.log('zone_details.features is ready.')
