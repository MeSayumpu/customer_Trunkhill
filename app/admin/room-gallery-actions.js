'use server'

import { redirect } from 'next/navigation'
import { isAdmin } from '../../lib/auth'
import { transaction } from '../../lib/db'
import { codePattern } from '../../lib/camp'
import { adminUrl } from './navigation'

function read(form) {
  const code = form.get('code'), id = form.get('id')
  if (typeof code !== 'string' || !codePattern.test(code) || typeof id !== 'string' || !/^\d{1,10}$/.test(id)) redirect(adminUrl('rooms',{error:'invalid'}))
  return {code, id:Number(id)}
}

export async function removeRoomPhoto(form) {
  if (!(await isAdmin())) redirect('/admin')
  const {code,id} = read(form)
  await transaction(db => db.execute('DELETE FROM inventory_gallery WHERE id=? AND code=?',[id,code]))
  redirect(adminUrl('rooms',{edit:code,saved:'inventory'}))
}

// Swap with the neighbouring photo so the customer carousel follows the admin's order.
export async function moveRoomPhoto(form) {
  if (!(await isAdmin())) redirect('/admin')
  const {code,id} = read(form)
  const step = form.get('step') === '-1' ? -1 : 1
  await transaction(async db => {
    const [rows] = await db.execute('SELECT id,sort FROM inventory_gallery WHERE code=? ORDER BY sort,id FOR UPDATE',[code])
    const index = rows.findIndex(row => Number(row.id) === id)
    const other = rows[index + step]
    if (index < 0 || !other) return
    // Re-number first so equal sort values can still be swapped.
    const order = rows.map(row => Number(row.id))
    ;[order[index],order[index + step]] = [order[index + step],order[index]]
    for (const [position,photo] of order.entries()) await db.execute('UPDATE inventory_gallery SET sort=? WHERE id=?',[position + 1,photo])
  })
  redirect(adminUrl('rooms',{edit:code}))
}
