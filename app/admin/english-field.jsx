// The English version of the Thai text typed in the field before it. Put both inside <div className="text-pair"> so they
// sit side by side on a wide screen and stack on a phone. Left empty, customers on the English page see the Thai text.
export function EnglishField({name, value, maxLength, rows, label = 'English'}) {
  const props = { name, lang:'en', maxLength, defaultValue:value || '', placeholder:'เว้นว่างได้ · หน้าภาษาอังกฤษจะแสดงข้อความไทย' }
  return <label className="english-field">{label}{rows ? <textarea rows={rows} {...props}/> : <input {...props}/>}</label>
}
