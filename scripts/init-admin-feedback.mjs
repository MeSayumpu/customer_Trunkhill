import {readFile} from 'node:fs/promises'
import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL,multipleStatements:true})
try {await db.query(await readFile(new URL('../db/admin-feedback.sql',import.meta.url),'utf8'));console.log('Admin feedback schema ready')} finally {await db.end()}
