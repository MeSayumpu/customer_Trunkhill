import {createConnection} from 'mysql2/promise'
const db = await createConnection(process.env.DATABASE_URL)
try {
  for (const [name,type] of [['bank_name','VARCHAR(120)'],['bank_account','VARCHAR(20)']]) {
    const [[exists]] = await db.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='payment_config' AND column_name=?",[name])
    if (!exists) await db.query(`ALTER TABLE payment_config ADD COLUMN ${name} ${type} NULL`)
  }
  console.log('Bank transfer fields ready.')
} finally { await db.end() }
