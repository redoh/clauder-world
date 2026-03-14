import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins/admin"
import { bearer } from "better-auth/plugins/bearer"
import { magicLink } from "better-auth/plugins/magic-link"
import { nextCookies } from "better-auth/next-js"
import { getDb } from "./db"
import { Resend } from "resend"

const prisma = getDb()
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await getResend().emails.send({
        from: "noreply@yourdomain.com",
        to: user.email,
        subject: "Reset your password",
        html: `<a href="${url}">Click here to reset your password</a>`,
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await getResend().emails.send({
        from: "noreply@yourdomain.com",
        to: user.email,
        subject: "Verify your email address",
        html: `<a href="${url}">Click here to verify your email</a>`,
      })
    },
    sendOnSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },
  plugins: [
    admin(),
    bearer(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await getResend().emails.send({
          from: "noreply@yourdomain.com",
          to: email,
          subject: "Your magic link",
          html: `<a href="${url}">Click here to sign in</a>`,
        })
      },
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
