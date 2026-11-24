import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

export function connectDatabase(connectionString = process.env.DATABASE_URL) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: Math.min(8, Math.max(1, Number(process.env.DATABASE_POOL_MAX) || 3)),
    idleTimeoutMillis: 10_000, connectionTimeoutMillis: 7000, allowExitOnIdle: true }) })
}
