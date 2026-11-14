import {readFile} from 'node:fs/promises'
import {createConnection} from 'mysql2/promise'
const db=await createConnection({uri:process.env.DATABASE_URL,multipleStatements:true})
try {await db.query(await readFile(new URL('../db/plot-map-versions.sql',import.meta.url),'utf8'));console.log('Map draft/publish schema ready; existing published map preserved.')} finally {await db.end()}
