import {createConnection} from 'mysql2/promise'
const connection=await createConnection(process.env.DATABASE_URL)
try {
  const [[exists]]=await connection.query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='zone_details' AND column_name='active'")
  if(!exists)await connection.query('ALTER TABLE zone_details ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE')
  console.log('Zone status schema ready; existing zones remain enabled.')
} finally {await connection.end()}
