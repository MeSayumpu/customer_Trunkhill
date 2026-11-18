// Minimal OOXML workbook: typed numbers and inline strings (never formulas).
import zlib from 'node:zlib'
const xml=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function zip(files){
  const chunks=[],directory=[];let offset=0
  for(const [path,content] of Object.entries(files)){
    const name=Buffer.from(path),data=Buffer.from(content),crc=crc32(data)
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26)
    chunks.push(local,name,data)
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42)
    directory.push(central,name);offset+=local.length+name.length+data.length
  }
  const index=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16)
  return Buffer.concat([...chunks,index,end])
}
const column=i=>{let text='';for(i++;i;i=Math.floor((i-1)/26))text=String.fromCharCode(65+(i-1)%26)+text;return text}
const rowXml=(row,r)=>`<row r="${r}">${row.map((value,c)=>{const ref=column(c)+r;return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`}).join('')}</row>`
const parts={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Checkouts" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
}
// The column widths and the filter cover as many columns as the header row has.
const sheetStart=columns=>`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${columns}" width="22" customWidth="1"/></cols><sheetData>`
const sheetEnd=(columns,count)=>`</sheetData><autoFilter ref="A1:${column(columns-1)}${Math.max(1,count)}"/></worksheet>`
export function workbook(rows){
  const columns=Math.max(1,rows[0]?.length||1)
  return zip({...parts,'xl/worksheets/sheet1.xml':sheetStart(columns)+rows.map((row,r)=>rowXml(row,r+1)).join('')+sheetEnd(columns,rows.length)})
}

// The same workbook written as a stream, for sheets of any length: rows arrive in batches (the first row of the first
// batch is the header) and leave as zip chunks, so memory holds one batch at a time instead of the whole file.
// The sheet is compressed and its size is written after its data (zip "data descriptor"), which is how spreadsheet
// programs themselves save large files.
const crc32Of=typeof zlib.crc32==='function'?zlib.crc32:(data,crc=0)=>{crc=~crc;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return ~crc>>>0}
function zipLocal(name,flags,method,crc,packed,size){
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8)
  local.writeUInt32LE(crc,14);local.writeUInt32LE(packed,18);local.writeUInt32LE(size,22);local.writeUInt16LE(name.length,26)
  return Buffer.concat([local,name])
}
function zipCentral({name,flags,method,crc,packed,size,offset}){
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10)
  central.writeUInt32LE(crc,16);central.writeUInt32LE(packed,20);central.writeUInt32LE(size,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42)
  return Buffer.concat([central,name])
}
export async function* workbookStream(batches){
  const entries=[];let offset=0
  for(const [path,content] of Object.entries(parts)){
    const name=Buffer.from(path),data=Buffer.from(content),crc=crc32Of(data),local=zipLocal(name,0,0,crc,data.length,data.length)
    entries.push({name,flags:0,method:0,crc,packed:data.length,size:data.length,offset})
    offset+=local.length+data.length
    yield local;yield data
  }
  const name=Buffer.from('xl/worksheets/sheet1.xml'),local=zipLocal(name,8,8,0,0,0)
  const sheet={name,flags:8,method:8,crc:0,packed:0,size:0,offset}
  offset+=local.length
  yield local
  const deflate=zlib.createDeflateRaw(),ready=[]
  let failure=null
  deflate.on('data',chunk=>ready.push(chunk)).on('error',error=>{failure=error})
  const write=text=>{
    const data=Buffer.from(text)
    sheet.crc=crc32Of(data,sheet.crc);sheet.size+=data.length
    return new Promise((resolve,reject)=>deflate.write(data,error=>error?reject(error):resolve()))
  }
  try{
    let count=0,columns=1,started=false
    for await(const batch of batches){
      if(!started){columns=Math.max(1,batch[0]?.length||1);await write(sheetStart(columns));started=true}
      if(batch.length)await write(batch.map(row=>rowXml(row,++count)).join(''))
      if(failure)throw failure
      for(const chunk of ready.splice(0)){sheet.packed+=chunk.length;yield chunk}
    }
    if(!started)await write(sheetStart(columns))
    await write(sheetEnd(columns,count))
    await new Promise((resolve,reject)=>{deflate.once('end',resolve).once('error',reject);deflate.end()})
    for(const chunk of ready.splice(0)){sheet.packed+=chunk.length;yield chunk}
  }finally{deflate.destroy()}
  const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(sheet.crc,4);descriptor.writeUInt32LE(sheet.packed,8);descriptor.writeUInt32LE(sheet.size,12)
  yield descriptor
  offset+=sheet.packed+descriptor.length
  entries.push(sheet)
  const index=Buffer.concat(entries.map(zipCentral)),end=Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16)
  yield index;yield end
}
