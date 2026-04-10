import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { timingSafeEqual } from 'crypto'

// ─── User definitions ─────────────────────────────────────────────────────────
// Thêm/xóa user ở đây. Mật khẩu lưu trong biến môi trường (Vercel → Settings → Env Vars).

const APP_USERS = [
  { id: '1', name: 'Admin',   username: 'admin',   passwordKey: 'AUTH_PASSWORD_ADMIN'   },
  { id: '2', name: 'Quản lý', username: 'manager', passwordKey: 'AUTH_PASSWORD_MANAGER' },
  { id: '3', name: 'Viewer',  username: 'viewer',  passwordKey: 'AUTH_PASSWORD_VIEWER'  },
]

// ─── Timing-safe comparison (prevents brute-force timing attacks) ─────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

// ─── NextAuth options ─────────────────────────────────────────────────────────

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Tên đăng nhập', type: 'text'     },
        password: { label: 'Mật khẩu',      type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = APP_USERS.find((u) => u.username === credentials.username)
        if (!user) return null

        const storedPassword = process.env[user.passwordKey]
        if (!storedPassword) return null

        const isValid = safeCompare(credentials.password, storedPassword)
        if (!isValid) return null

        return { id: user.id, name: user.name }
      },
    }),
  ],

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 giờ
  },

  secret: process.env.NEXTAUTH_SECRET,
}
