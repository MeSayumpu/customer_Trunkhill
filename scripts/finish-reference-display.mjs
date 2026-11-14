import fs from 'node:fs'
for(const [path,pairs] of [
 ['app/admin/booking-list.jsx',[['<code>{row.id}</code>','<code>{row.reference||row.id}</code>'],['<code>{detail.id}</code>','<code>{detail.reference||detail.id}</code>']]],
 ['app/admin/checkout.jsx',[['<code>{booking.id}</code>','<code>{booking.reference||booking.id}</code>'],['ชื่อผู้จอง / เบอร์โทร','ชื่อผู้จอง / เบอร์โทร / รหัสจอง']]],
 ['app/admin/bookings-export/route.js',[["csv([row.id,row.guest","csv([row.reference||row.id,row.guest"]]],
]){let s=fs.readFileSync(path,'utf8');for(const [a,b]of pairs){if(!s.includes(a))throw Error(path);s=s.replace(a,b)}fs.writeFileSync(path,s)}
