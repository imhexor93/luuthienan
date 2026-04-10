import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

// Bảo vệ tất cả route, ngoại trừ /login và các tài nguyên static
export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)',
  ],
}
