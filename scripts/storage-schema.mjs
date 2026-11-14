import {createConnection} from 'mysql2/promise'
import {readFile} from 'node:fs/promises'
const db=await createConnection({uri:process.env.DATABASE_URL,multipleStatements:true})
try{await db.query(await readFile(new URL('../db/storage.sql',import.meta.url),'utf8'));console.log('Storage schema ready (10 GB total quota).')}finally{await db.end()}
