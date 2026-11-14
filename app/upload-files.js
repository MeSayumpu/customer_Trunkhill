'use client'
export async function prepareUploads(form,options={}){
 const query=new URLSearchParams(options.booking?{booking:options.booking}:{})
 const base=(options.booking?'/api/uploads?':'/admin/uploads?')+query
 const headers=options.token?{Authorization:'Bearer '+options.token}:{}
 async function send(url,init){const response=await fetch(url,{...init,headers:{...headers,...init.headers}});const result=await response.json();if(!response.ok)throw Error(result.error||'อัปโหลดไม่สำเร็จ');return result}
 const created=[]
 try {
  const entries=[...form.entries()];for(const name of new Set(entries.filter(([,v])=>v instanceof File).map(([k])=>k))){
   const values=form.getAll(name);form.delete(name)
   for(const file of values){if(!(file instanceof File)){form.append(name,file);continue}if(!file.size)continue
    const session=await send(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bytes:file.size})});created.push(session.id)
    for(let offset=0,part=0;offset<file.size;offset+=session.chunkBytes,part++){
     const url=base+'&'+new URLSearchParams({id:session.id,part:String(part)})
     let last;for(let attempt=0;attempt<3;attempt++){try{await send(url,{method:'PUT',body:file.slice(offset,offset+session.chunkBytes)});last=null;break}catch(error){last=error}}
     if(last)throw last
    }
    const result=await send(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:session.id})});form.append(name,result.value)
   }
  }
  return form
 }catch(error){await Promise.allSettled(created.map(id=>send(base+'&id='+id,{method:'DELETE'})));throw error}
}
