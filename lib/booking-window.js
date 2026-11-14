export function addMonths(date,months) {
  const d=new Date(date+'T00:00:00Z'),day=d.getUTCDate()
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months)
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()
  d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)
}
export function bookingWindowEnd(today,window={value:3,unit:'months'}) {
  if(window.unit==='months')return addMonths(today,Number(window.value))
  const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Number(window.value));return d.toISOString().slice(0,10)
}
