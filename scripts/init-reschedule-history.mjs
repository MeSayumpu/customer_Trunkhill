import {readFile} from 'node:fs/promises'
import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL})
try{await db.query(await readFile(new URL('../db/booking-reschedule-history.sql',import.meta.url),'utf8'));console.log('Reschedule history ready.')}
finally{await db.end()}
