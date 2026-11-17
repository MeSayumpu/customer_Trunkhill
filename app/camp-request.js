export async function readCamp(url, data, signal) {
  const response = await fetch(url, data ? {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
  } : { signal, cache:'no-store' })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.error || 'กรุณาลองใหม่')
    error.status = response.status
    // Items the server could not reserve (lib/camp.js assertStock), for the "choose again" dialog.
    if (Array.isArray(result.unavailable)) error.unavailable = result.unavailable
    throw error
  }
  return result
}
