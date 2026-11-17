import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { database } from './db'

const cookieName = 'trunkhill_admin'
const hours = 8 * 60 * 60
const digest = value => createHash('sha256').update(value).digest()
const sign = value => createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('hex')
const secretReady = () => Boolean(process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 32)

// Two roles sign in with an account name and a password. The admin's password comes from the server configuration and
// cannot be changed in the app. The manager's is kept hashed in the database, and only the admin can change it.
// A manager opens these sections only; everything else, and every setting, is the admin's.
export const managerSections = ['dashboard','bookings','checkin','checkout','blockedPhones']
export const managerPasswordMin = 8
// Account names typed on the sign-in page (capital letters and spaces around them are ignored).
export const accounts = { admin:'admin', manager:'manager' }

export function hashPassword(password) {
  const salt = randomBytes(16)
  return 'scrypt$' + salt.toString('hex') + '$' + scryptSync(password, salt, 32).toString('hex')
}

function verifyPassword(password, stored) {
  const [kind, salt, hash] = String(stored).split('$')
  if (kind !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(hash || '')) return false
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'hex'), 32), Buffer.from(hash, 'hex'))
}

async function managerHash() {
  const [[row]] = await database().execute("SELECT password_hash FROM staff_accounts WHERE role='manager'")
  return row?.password_hash || null
}

// The manager's session is signed together with the stored password hash, so changing the password signs the manager out.
const managerPayload = (expiry, hash) => 'manager.' + expiry + '.' + hash

export async function sessionRole() {
  if (!secretReady()) return null
  const token = (await cookies()).get(cookieName)?.value
  const match = token && /^(manager\.)?(\d+)\.([a-f0-9]{64})$/.exec(token)
  if (!match || !(Number(match[2]) > Date.now())) return null
  let payload = match[2]
  if (match[1]) {
    const hash = await managerHash().catch(() => null)
    if (!hash) return null
    payload = managerPayload(match[2], hash)
  }
  if (!timingSafeEqual(Buffer.from(match[3], 'hex'), Buffer.from(sign(payload), 'hex'))) return null
  return match[1] ? 'manager' : 'admin'
}

export async function isAdmin() {
  return (await sessionRole()) === 'admin'
}

// Admin or manager: the bookings, check-out and blocked-phone work both of them do.
export async function isStaff() {
  return (await sessionRole()) !== null
}

const isAdminPassword = password => Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 12 &&
  timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD)))

export async function authenticate(account, password) {
  if (!secretReady() || typeof account !== 'string' || typeof password !== 'string' || !password || password.length > 256) return false
  const name = account.trim().toLowerCase()
  const expiry = String(Date.now() + hours * 1000)
  let token
  if (name === accounts.admin) {
    if (!isAdminPassword(password)) return false
    token = expiry + '.' + sign(expiry)
  } else if (name !== accounts.manager) return false
  else {
    // No manager account yet (table not created): only the admin can sign in.
    const hash = await managerHash().catch(() => null)
    if (!hash || !verifyPassword(password, hash)) return false
    token = 'manager.' + expiry + '.' + sign(managerPayload(expiry, hash))
  }
  ;(await cookies()).set(cookieName, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.ADMIN_SECURE_COOKIE !== 'false',
    path: '/admin', maxAge: hours,
  })
  return true
}

// Called by the admin only.
export async function setManagerPassword(password) {
  if (typeof password !== 'string' || password.length < managerPasswordMin || password.length > 256) return false
  await database().execute(
    `INSERT INTO staff_accounts (role,password_hash) VALUES ('manager',?)
     ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),updated_at=UTC_TIMESTAMP()`, [hashPassword(password)])
  return true
}

export async function managerPasswordChangedAt() {
  const [[row]] = await database().execute("SELECT updated_at FROM staff_accounts WHERE role='manager'").catch(() => [[]])
  return row?.updated_at || null
}

export async function clearSession() {
  ;(await cookies()).set(cookieName, '', { path: '/admin', maxAge: 0 })
}
