import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

let prisma: InstanceType<typeof PrismaClient> | null = null

export function getDb() {
  if (prisma) return prisma
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  prisma = new PrismaClient({ adapter })
  return prisma
}
