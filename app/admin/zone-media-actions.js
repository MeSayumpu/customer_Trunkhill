'use server'

import { redirect } from 'next/navigation'
import { isAdmin } from '../../lib/auth'
import { database } from '../../lib/db'
import {campZones} from '../../lib/camp-options'
import { adminUrl } from './navigation'
import { revalidatePath } from 'next/cache'
import { normalizeZoneFeatures, zoneFeaturesError } from '../../lib/zone-features'

export async function saveZoneText(form) {
  if (!(await isAdmin())) redirect('/admin')
  const zone = form.get('zone')
  const description = form.get('description')
  const rules = form.get('rules')
  const caption = form.get('galleryCaption')
  if (!(await campZones()).includes(zone) || typeof description !== 'string' || description.length > 2000 ||
    typeof rules !== 'string' || rules.length > 2000 ||
    typeof caption !== 'string' || caption.length > 3000) redirect(adminUrl('zoneMedia',{error:'invalid'}))
  await database().execute('UPDATE zone_details SET description=?,rules=?,gallery_caption=? WHERE zone=?',
    [description.trim(),rules.trim(),caption.trim(),zone])
  redirect(adminUrl('zoneMedia',{zone,saved:'zoneMedia'}))
}

export async function removeZoneMedia(form) {
  if (!(await isAdmin())) redirect('/admin')
  const zone = form.get('zone')
  const id = form.get('id')
  if (!(await campZones()).includes(zone) || typeof id !== 'string' || !/^\d{1,10}$/.test(id)) redirect(adminUrl('zoneMedia',{error:'invalid'}))
  await database().execute('DELETE FROM zone_media WHERE zone=? AND id=?',[zone,id])
  redirect(adminUrl('zoneMedia',{zone,saved:'zoneMedia'}))
}

export async function saveZoneFeatures(form) {
  if (!(await isAdmin())) redirect('/admin')
  const zone = form.get('zone')
  const raw = form.get('features')
  if (!(await campZones()).includes(zone) || typeof raw !== 'string' || raw.length > 20000) redirect(adminUrl('zoneMedia',{error:'invalid'}))
  let value = null
  try { value = JSON.parse(raw) } catch {}
  if (zoneFeaturesError(value)) redirect(adminUrl('zoneMedia',{zone,error:'zoneFeatures'}))
  const features = normalizeZoneFeatures(value)
  await database().execute('UPDATE zone_details SET features=? WHERE zone=?',[JSON.stringify(features),zone])
  revalidatePath('/')
  redirect(adminUrl('zoneMedia',{zone,saved:'zoneMedia'}))
}
