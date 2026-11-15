'use client'
import {useEffect,useState} from 'react'

export function MediaUpload({name='photo',video=false,required=false,current}) {
  const [file,setFile]=useState(null),[url,setUrl]=useState(''),[error,setError]=useState('')
  useEffect(()=>{if(!file){setUrl('');return}const src=URL.createObjectURL(file);setUrl(src);return()=>URL.revokeObjectURL(src)},[file])
  // video="any" takes either a photo or a video (the customer-page banner); the preview follows the chosen file.
  const any=video==='any',images='image/jpeg,image/png,image/webp',videos='video/mp4,video/webm'
  const showVideo=any?!!file?.type.startsWith('video/'):video
  return <div className="media-upload"><label className="media-upload-picker"><strong>{any?'เลือกรูปภาพหรือวิดีโอ':video?'เลือกวิดีโอ':'เลือกรูปภาพ'}</strong>
    <span>{any?'JPG / PNG / WebP / MP4 / WebM':video?'MP4 / WebM':'JPG / PNG / WebP'}</span>
    <input name={name} type="file" accept={any?images+','+videos:video?videos:images} required={required} onChange={e=>{const f=e.target.files[0];setFile(f||null);setError('')}}/>
  </label>{error&&<p role="alert">{error}</p>}{(url||current)&&<figure className="media-upload-preview">{showVideo?<video preload="none" controls src={url||current}/>:<img loading="lazy" decoding="async" src={url||current} alt="ภาพตัวอย่างก่อนบันทึก"/>}<figcaption>{file?.name||'รูปปัจจุบัน'}</figcaption></figure>}</div>
}
