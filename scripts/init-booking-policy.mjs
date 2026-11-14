import { createConnection } from 'mysql2/promise'
const db = await createConnection({uri:process.env.DATABASE_URL})
try {
  const [[exists]] = await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='settings' AND column_name='reschedule_notice_days'")
  if (!exists) await db.query('ALTER TABLE settings ADD COLUMN reschedule_notice_days SMALLINT UNSIGNED NOT NULL DEFAULT 3')
  console.log('Booking policy schema ready.')
} finally { await db.end() }
