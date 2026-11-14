import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL})
try{
 const [[exists]]=await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='settings' AND column_name='reschedule_limit'")
 if(!exists)await db.query('ALTER TABLE settings ADD COLUMN reschedule_limit TINYINT UNSIGNED NOT NULL DEFAULT 3')
 console.log('Reschedule limit ready.')
}finally{await db.end()}
