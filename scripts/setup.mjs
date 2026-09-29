/* One-shot local setup: creates .env with fresh keys, runs migrations, seeds demo data. Safe to re-run. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`\nCommand failed: ${cmd}`);
    process.exit(r.status ?? 1);
  }
};

if (!existsSync(".env")) {
  let env = readFileSync(".env.example", "utf8");
  env = env
    .replace("v1:REPLACE_WITH_BASE64_32_BYTES", "v1:" + randomBytes(32).toString("base64"))
    .replace("REPLACE_WITH_LONG_RANDOM_STRING", randomBytes(48).toString("base64"));
  writeFileSync(".env", env);
  console.log("Created .env with fresh encryption key and session secret.");
} else {
  console.log(".env already exists, keeping it.");
}

run("npx prisma migrate deploy");
run("npx prisma db seed");
console.log("\nDone. Start the app with:  npm run dev   (then open http://localhost:3000)");
