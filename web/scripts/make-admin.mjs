// Promotes an existing account to admin. The account must already exist
// (register on the website first). Requires the service-role key, so run it
// only from your own machine:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/make-admin.mjs you@example.com
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !url || !key) {
  console.error("Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/make-admin.mjs <email>");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.from("profiles").update({ role: "admin" }).ilike("email", email).select("id,email,role");
if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}
if (!data?.length) {
  console.error(`No account found for ${email}. Register on the website first, confirm the email, then re-run.`);
  process.exit(1);
}
console.log(`✔ ${data[0].email} is now an admin. Sign in and open /admin.`);
