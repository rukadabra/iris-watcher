import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"
import * as schema from "./schema"

let sql: Sql | null = null
let database: PostgresJsDatabase<typeof schema> | null = null

export function getSql(): Sql {
  if (sql) return sql
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  sql = postgres(url, { max: 5, connect_timeout: 5 })
  return sql
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!database) database = drizzle(getSql(), { schema })
  return database
}

export async function closeDb(): Promise<void> {
  if (!sql) return
  await sql.end({ timeout: 5 })
  sql = null
  database = null
}
