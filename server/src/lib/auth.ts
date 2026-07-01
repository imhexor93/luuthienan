// ============================================================
// Auth utilities: password hashing + session tokens
// ============================================================
import { createHash, randomBytes } from 'crypto';
import { db } from '../db/schema';
import { User } from '@rd/shared';

type Row = Record<string, unknown>;

// -------------------------
// Password
// -------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  return createHash('sha256').update(password + salt).digest('hex') === hash;
}

// -------------------------
// Session tokens
// -------------------------
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function rowToUser(row: Row): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as User['role'],
    avatarColor: row.avatar_color as string,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

export function createSession(userId: string): string {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 ngày
  db.prepare('INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

export function validateSession(token: string): User | null {
  const session = db.prepare(`
    SELECT u.* FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).get(token) as Row | undefined;
  return session ? rowToUser(session) : null;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
}

export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email) as Row | undefined;
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.password_hash as string };
}
