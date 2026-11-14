import {createConnection} from 'mysql2/promise'
import {customerExperienceSchema} from './customer-experience-schema.mjs'
const db=await createConnection({uri:process.env.DATABASE_URL,dateStrings:true})
try{await customerExperienceSchema(db);console.log('Customer settings and booking references ready')}finally{await db.end()}
