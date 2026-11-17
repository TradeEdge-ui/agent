import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const ROOT = join(__dirname, "..", "..");

export const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL;

/** Creates a throwaway database with Supabase stubs + all migrations applied. */
export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  if (!ADMIN_URL) throw new Error("TEST_DATABASE_ADMIN_URL is not set");
  const name = `aryzz_t_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  const files = [
    join(ROOT, "tests/db/supabase-stubs.sql"),
    ...readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(ROOT, "supabase/migrations", f)),
  ];
  for (const file of files) {
    await db.query(readFileSync(file, "utf8"));
  }
  await db.end();

  return {
    url: url.toString(),
    drop: async () => {
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** A connection that can impersonate Supabase roles the way PostgREST does. */
export class TestDb {
  constructor(public client: pg.Client) {}

  static async connect(url: string) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    return new TestDb(client);
  }

  async asSuper<T = unknown>(sql: string, params: unknown[] = []) {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', '', false)");
    return (await this.client.query(sql, params)).rows as T[];
  }

  async as<T = unknown>(role: "anon" | "authenticated" | "service_role", userId: string | null, sql: string, params: unknown[] = []) {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', $1, false)", [
      userId ? JSON.stringify({ sub: userId, role }) : JSON.stringify({ role }),
    ]);
    await this.client.query(`set role ${role}`);
    try {
      return (await this.client.query(sql, params)).rows as T[];
    } finally {
      await this.client.query("reset role");
    }
  }

  /** Inserts an auth user (fires the signup trigger) and optionally makes them admin. */
  async createUser(email: string, opts: { admin?: boolean; confirmed?: boolean; fullName?: string } = {}) {
    const id = randomUUID();
    await this.asSuper(
      "insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, $4)",
      [id, email, JSON.stringify({ full_name: opts.fullName ?? email.split("@")[0] }), opts.confirmed === false ? null : new Date()],
    );
    if (opts.admin) await this.asSuper("update public.profiles set role = 'admin' where id = $1", [id]);
    return id;
  }

  async end() {
    await this.client.end();
  }
}
