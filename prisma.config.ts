import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: [".env.local", ".env"], quiet: true });

function cliDdlUrl(): string {
  const direct = (process.env.DIRECT_URL || "").trim();
  if (direct) return direct;
  const url = (process.env.DATABASE_URL || "").trim();
  return url.includes(":6543/") ? url.replace(":6543/", ":5432/") : url;
}

const ddlUrl = cliDdlUrl();

if (ddlUrl) {
  process.env.DATABASE_URL = ddlUrl;
  process.env.DIRECT_URL = ddlUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: ddlUrl,
  },
});
