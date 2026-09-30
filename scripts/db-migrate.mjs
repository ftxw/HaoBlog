/**
 * 数据库迁移执行脚本 —— 取代原先「构建期 prisma db push」的做法。
 *
 * 幂等，可反复执行；构建期由 scripts/auto-migrate.mjs 自动调用。
 *
 * 为什么需要这个脚本，而不是直接 `prisma migrate deploy`：
 *
 *  1. 连接降级。DDL 必须在直连/会话连接上跑，Supabase 的 6543 事务池不支持。
 *     这里先把候选连接串统一降级到 5432，再用 pg **实际探通**一个可用的，
 *     然后才把探通的那个写回 DATABASE_URL/DIRECT_URL 交给 Prisma CLI。
 *     （库房直连地址在部分环境下只有 IPv6，Vercel 构建机是纯 IPv4 ——
 *       探通而不是按优先级取，是为了自动回落到池地址。）
 *
 *  2. 存量库自动打基线。本项目此前的表是 `prisma db push` 建的，
 *     数据库里没有 `_prisma_migrations` 表。直接 `migrate deploy` 会在
 *     已有数据的库上重放 0_init 的全部 CREATE TABLE → 报错退出。
 *     所以：**有业务表但基线未登记** → 先把 0_init 标记为「已应用」
 *     （只写迁移记录，不执行 SQL），再 deploy。
 *     这一步没有用官方的 `migrate resolve --applied`，原因见 ensureBaselineRecorded()。
 *
 *  3. 每个子进程都有硬超时，且用「node 直启 CLI 的 JS 入口」单进程调用，
 *     避免 shell/pnpm 套娃 —— 套娃时超时的 SIGKILL 只杀得掉中间壳，
 *     真正卡住的 CLI 会留在后台继续占着。
 *
 *  4. **本脚本自己不留常开连接**。所有校验用的连接都是「开了就用、用完立刻关」。
 *     调 Prisma CLI 之前绝不能占着连接：部分 PG 实例（嵌入式/WASM 版、
 *     连接上限很低的托管库）同时只接受很少的连接，占着不放会让 CLI
 *     以 `P1001: Can't reach database server` 失败，且现象极具误导性。
 *
 * ── 谁在什么时候跑它 ────────────────────────────────────────
 *
 * 用法一（自动）：`pnpm build` 的其中一步，经 `scripts/auto-migrate.mjs` 调用。
 *   目的是**全新空库部署后开箱可用** —— 不需要人工先跑一次迁移。
 *   之所以可以用 `migrate deploy` 而不再怕当年那几个问题：
 *     · 「数据库不可达就让构建失败」是**刻意的**，不再规避。静默跳过会得到
 *       「站点起来了但一张表都没有」的部署 —— 页面全空态、接口 500，
 *       现象分散且极难定位（2026-09-22 实际踩过一次，排查花了一轮）。
 *       宁可构建失败，报错明确。
 *     · 「Preview 改生产库」：`auto-migrate.mjs` 在 `VERCEL_ENV=preview` 时直接跳过。
 *     · 「假漂移」：那是 `db push` 的毛病（它每次比对 schema 与库、表达式规范化差异
 *       会被判成漂移且永不收敛）。`migrate deploy` **不做漂移检测**，
 *       只补「迁移目录里有、`_prisma_migrations` 里没有」的项，不存在这个问题。
 *
 * 用法二（手工）：`pnpm db:migrate`。幂等，可反复执行；
 *   排查问题、或想单独重灌站点配置默认值时用它。
 *   （历史上 `db push` 建的库没有 `_prisma_migrations` 表，本脚本会自动处理 —— 见下）
 *
 * 用法三（跳过）：没有可达数据库的环境里，显式设 `SKIP_DB_MIGRATE=1`
 *   （auto-migrate.mjs 会直接放过，不进本脚本）。
 *   它不会自己"猜"该不该跳过 —— 猜错的代价是一个没有表的部署。
 *
 * schema 变更的流程不变：改 prisma/schema.prisma → 本地生成迁移文件 → 提交 →
 * 部署时自动应用（或手工 `pnpm db:migrate`）。
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import pg from "pg";

/*
 * 本地加载 .env.local / .env（**可选**，装了 dotenv 才生效）。
 *
 * 为什么需要显式加载：这是个裸 node 脚本 —— 只有 Next.js 才会自动读 .env.local。
 * 不加载的话，本机跑 `pnpm db:migrate` 会报"未设置 DATABASE_URL"，
 * 而用户明明已经按 .env.example 的说明写到 .env.local 里了。
 *
 * 为什么用 try/catch 包着：本脚本现在会在 `pnpm build` 里执行，而 dotenv 是
 * devDependency —— 万一某个环境只装了 dependencies，`import "dotenv"` 会直接抛错
 * 把构建搞挂。这里降级为可选：没有它就跳过，Vercel 上的变量由平台注入。
 * （pg 不同，它是真·必需依赖，所以放在 dependencies 里。）
 *
 * 路径顺序与 Next.js 一致：.env.local 覆盖 .env。
 */
try {
  createRequire(import.meta.url)("dotenv").config({
    path: [".env.local", ".env"],
    quiet: true,
  });
} catch {
  // 未安装 dotenv（或读不到 .env*）：忽略，继续用已有的 process.env
}

const { Client } = pg;

const isWin = process.platform === "win32";

/** 基线迁移目录名，须与 prisma/migrations/ 下的目录一致 */
const BASELINE_MIGRATION = "0_init";

/** 判断「库是否已初始化」的哨兵表 —— 有它说明不是空库 */
const SENTINEL_TABLE = "post";

/** Prisma 记录已应用迁移的表 */
const MIGRATIONS_TABLE = "_prisma_migrations";

/** 连接探测超时：远程 PG（Supabase）握手通常 <1s，15s 足够判定「连不通」 */
const PROBE_TIMEOUT_MS = 15_000;
/** migrate deploy：正常只有几百 ms（无待应用迁移时），5 分钟非常宽松 */
const DEPLOY_TIMEOUT_MS = 300_000;
/** seed：写站点配置默认值，逐条 upsert */
const SEED_TIMEOUT_MS = 300_000;

/** 探测通过的连接串，后续所有一次性连接都用它 */
let resolvedUrl = "";

/**
 * Supabase pooler：6543 = 事务连接池（不适合 DDL），5432 = 直连/会话池。
 * 两个端口同 host 同账号，仅改端口即可；其它宿主原样返回。
 */
function toDirectUrl(u) {
  return u.includes(":6543/") ? u.replace(":6543/", ":5432/") : u;
}

/** 日志里只出现 host:port/db，绝不打印连接串（避免密码进日志） */
function describeUrl(u) {
  try {
    const p = new URL(u);
    return `${p.hostname}:${p.port || 5432}${p.pathname}`;
  } catch {
    return "(连接串无法解析)";
  }
}

function firstLine(s) {
  return (
    String(s || "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "(无输出)"
  );
}

/**
 * 生成 Prisma CLI 的启动方式。
 *
 * 优先 `node node_modules/prisma/build/index.js`：进程树只有「本脚本 → CLI」两层，
 * 超时的 SIGKILL 能真正打到 CLI 本身。
 */
function prismaCommand(args) {
  const cliJs = path.join("node_modules", "prisma", "build", "index.js");
  if (existsSync(cliJs)) {
    return { cmd: process.execPath, argv: [cliJs, ...args], shell: false };
  }
  const bin = path.join("node_modules", ".bin", isWin ? "prisma.cmd" : "prisma");
  if (existsSync(bin)) {
    return { cmd: bin, argv: args, shell: isWin };
  }
  return { cmd: "pnpm", argv: ["exec", "prisma", ...args], shell: isWin };
}

/** 跑一条命令，带硬超时。返回 { ok, timedOut, status, out, err, ms }。 */
function run(cmd, argv, { timeoutMs, shell = false } = {}) {
  const started = Date.now();
  const res = spawnSync(cmd, argv, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    shell,
  });
  const ms = Date.now() - started;
  const timedOut = res.error?.code === "ETIMEDOUT" || res.signal === "SIGKILL";
  return {
    ok: !timedOut && !res.error && res.status === 0,
    timedOut,
    status: res.status,
    out: res.stdout || "",
    err: res.stderr || "",
    ms,
  };
}

/** 输出异常时把 stdout/stderr 尾部打出来，便于定位 */
function dumpTail(res, maxLines = 20) {
  for (const [name, text] of [
    ["stdout", res.out],
    ["stderr", res.err],
  ]) {
    const lines = String(text || "").trim().split("\n").filter(Boolean);
    if (!lines.length) continue;
    console.log(`[db-migrate] ${name} 末尾 ${Math.min(lines.length, maxLines)} 行:`);
    for (const l of lines.slice(-maxLines)) console.log("    " + l);
  }
}

/**
 * 依次探测候选连接串，找到第一个**真正连得上**的，返回它的地址。
 *
 * 之所以要探测而不是直接按优先级取：Supabase 的直连地址（db.<ref>.supabase.co:5432）
 * 在部分网络下只有 IPv6，而 Vercel 构建机是纯 IPv4 —— 这种情况在 TCP 层是
 * 「没响应」而不是「被拒绝」，会一路挂到超时。探测一遍就能自动回落到可用的池地址。
 *
 * **探测连接在返回前一定关闭**（见文件头第 4 条）。
 */
async function probeConnection() {
  const candidates = [
    ...new Set(
      [process.env.DIRECT_URL, process.env.DATABASE_URL]
        .map((v) => (v || "").trim())
        .filter(Boolean)
        .map(toDirectUrl)
    ),
  ];

  if (!candidates.length) return "";

  const failures = [];
  for (const candidate of candidates) {
    const client = new Client({
      connectionString: candidate,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    });
    try {
      await client.connect();
      console.log(`[db-migrate] 已连接 ${describeUrl(candidate)}`);
      return candidate;
    } catch (e) {
      failures.push(`${describeUrl(candidate)} → ${firstLine(e.message)}`);
    } finally {
      // 连不上时 end() 也可能抛，统一忽略；关键是**探通的那条也必须关掉**，
      // 否则后面 Prisma CLI 会因为「连接已占满」而报 P1001。
      await client.end().catch(() => {});
    }
  }

  console.error("[db-migrate] 无法连接数据库（候选连接串全部失败）:");
  for (const f of failures) console.error("    - " + f);
  return "";
}

/**
 * 开一条一次性连接执行 fn，无论成败都用完即关。
 * 本脚本的所有数据库读写都必须走这里 —— 不允许有跨 CLI 调用的常开连接。
 */
async function withConnection(fn) {
  const client = new Client({
    connectionString: resolvedUrl,
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function tableExists(client, name) {
  const res = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
    [name]
  );
  return res.rowCount > 0;
}

/** 基线迁移是否已登记为「已应用」 */
async function baselineRecorded(client) {
  const res = await client.query(
    `SELECT 1 FROM "${MIGRATIONS_TABLE}" WHERE migration_name = $1 AND finished_at IS NOT NULL`,
    [BASELINE_MIGRATION]
  );
  return res.rowCount > 0;
}

/**
 * 读取当前库状态。三个信息决定走哪条分支：
 *  - hasAppTables    ：有没有业务表（判断「空库」还是「存量库」）
 *  - hasMigrationsTable：有没有迁移记录表
 *  - baselineDone    ：基线迁移有没有被登记为已应用
 */
async function readState() {
  return withConnection(async (client) => {
    const [hasMigrationsTable, hasAppTables] = await Promise.all([
      tableExists(client, MIGRATIONS_TABLE),
      tableExists(client, SENTINEL_TABLE),
    ]);
    // 记录表不存在时不要去查它，否则会抛 relation does not exist
    const baselineDone = hasMigrationsTable ? await baselineRecorded(client) : false;
    return { hasMigrationsTable, hasAppTables, baselineDone };
  });
}

/** 执行业务表计数，用于落库校验 */
async function countBusinessTables() {
  return withConnection(async (client) => {
    const res = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name <> $1",
      [MIGRATIONS_TABLE]
    );
    return res.rows[0].n;
  });
}

/** 哨兵表是否存在 */
async function sentinelExists() {
  return withConnection((client) => tableExists(client, SENTINEL_TABLE));
}

/** 执行一条 Prisma CLI 命令；失败时打印输出并终止进程 */
function prismaOrDie(label, args, timeoutMs) {
  const { cmd, argv, shell } = prismaCommand(args);
  console.log(`[db-migrate] ${label}…`);
  const res = run(cmd, argv, { timeoutMs, shell });
  if (!res.ok) {
    console.error(
      `[db-migrate] ${label} 失败（${
        res.timedOut ? `超时 ${timeoutMs / 1000}s` : `退出码 ${res.status}`
      }）。`
    );
    dumpTail(res);
    process.exit(1);
  }
  // 正常输出也要可见（迁移列表、待应用数量等）
  for (const l of String(res.out || "").trim().split("\n").filter(Boolean)) {
    console.log("    " + l);
  }
  console.log(`[db-migrate] ${label} 完成（${res.ms}ms）`);
  return res;
}

/**
 * 迁移记录表的标准结构（与 Prisma 自己创建的逐列一致，已对比 information_schema 确认）。
 */
const MIGRATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
    id                    VARCHAR(36) PRIMARY KEY NOT NULL,
    checksum              VARCHAR(64) NOT NULL,
    finished_at           TIMESTAMPTZ,
    migration_name        VARCHAR(255) NOT NULL,
    logs                  TEXT,
    rolled_back_at        TIMESTAMPTZ,
    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count   INTEGER NOT NULL DEFAULT 0
)`;

/**
 * 把基线迁移的 SQL 文件内容做 sha256 —— 这正是 Prisma 写进 checksum 列的值。
 * （已与 `migrate deploy` 实际登记的记录逐字比对确认过。）
 */
function baselineChecksum() {
  const file = path.join("prisma", "migrations", BASELINE_MIGRATION, "migration.sql");
  if (!existsSync(file)) {
    console.error(`[db-migrate] 找不到基线迁移文件：${file}`);
    process.exit(1);
  }
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/**
 * 把基线登记为「已应用」（只写迁移记录，不执行 0_init 的建表 SQL）。
 *
 * 为什么不用 Prisma 官方的 `migrate resolve --applied`：它走 schema-engine 的
 * MarkMigrationApplied 流程，实测在部分环境直接以
 * `Error: unexpected message from server` 失败，而且会把连接一起打掉
 * （连 CREATE DATABASE 都正常的 Postgres 也一样）。现象与数据库本身无关，
 * 属于引擎内部的脆弱路径。
 *
 * 而「打基线」本质上只是往 _prisma_migrations 里写一行：
 *   · checksum    = 迁移文件的 sha256（已与 migrate deploy 实际写入的值逐字比对确认）
 *   · finished_at = 非空即代表已应用（migrate deploy 只读这张表，不做漂移检测）
 *   · 表结构      = 与 Prisma 自己建的逐列一致（已对比 information_schema 确认）
 * 所以手工写入的语义与官方命令完全等价，且不依赖任何引擎内部流程。
 *
 * 全程 `IF NOT EXISTS` + `WHERE NOT EXISTS` 保证幂等，重复执行无副作用。
 */
async function registerBaseline() {
  const checksum = baselineChecksum();
  await withConnection(async (client) => {
    await client.query(MIGRATIONS_TABLE_DDL);
    /**
     * 参数必须显式 cast。$3 在同一句里出现了两次（SELECT 列表 + WHERE 比较），
     * 而 `INSERT ... SELECT` 列表里的参数不会从目标列推导类型 ——
     * PostgreSQL 会分别推出 text 和 varchar(255)，报
     * `inconsistent types deduced for parameter $3`。全部钉成列的精确类型即可。
     */
    await client.query(
      `INSERT INTO "${MIGRATIONS_TABLE}"
         (id, checksum, finished_at, migration_name, applied_steps_count)
       SELECT $1::varchar(36), $2::varchar(64), now(), $3::varchar(255), 1
       WHERE NOT EXISTS (
         SELECT 1 FROM "${MIGRATIONS_TABLE}"
          WHERE migration_name = $3::varchar(255) AND finished_at IS NOT NULL
       )`,
      [randomUUID(), checksum, BASELINE_MIGRATION]
    );
  });
}

/**
 * 登记基线并回查确认。不确认就 deploy，会在已有表上重放建表语句。
 */
async function ensureBaselineRecorded() {
  console.log(
    `[db-migrate] 存量库但基线未登记 —— 将 ${BASELINE_MIGRATION} 标记为已应用` +
      "（只写迁移记录，不执行其建表 SQL）。"
  );
  await registerBaseline();

  if (!(await withConnection(baselineRecorded))) {
    console.error(
      `[db-migrate] ${MIGRATIONS_TABLE} 里仍查不到 ${BASELINE_MIGRATION} 的已应用记录。\n` +
        "            为避免在已有表上重放建表语句，已中止。请把上面的输出发出来定位。"
    );
    process.exit(1);
  }
  console.log("[db-migrate] 基线登记已确认。");
}

function runSeed() {
  const tsxBin = path.join("node_modules", ".bin", isWin ? "tsx.cmd" : "tsx");
  const seed = existsSync(tsxBin)
    ? run(tsxBin, ["prisma/seed.ts"], { timeoutMs: SEED_TIMEOUT_MS, shell: isWin })
    : run("pnpm", ["db:seed"], { timeoutMs: SEED_TIMEOUT_MS, shell: isWin });

  // 种子失败不视为迁移失败：表结构已就绪、站点可用，默认配置可以后补。
  if (!seed.ok) {
    console.warn(
      "[db-migrate] 种子数据写入失败（不阻塞）:",
      seed.timedOut ? `超时（${SEED_TIMEOUT_MS / 1000}s）` : firstLine(seed.err)
    );
    dumpTail(seed, 8);
    return;
  }
  console.log("[db-migrate] 种子数据写入完成。");
}

async function main() {
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
    console.error(
      "[db-migrate] 未设置 DATABASE_URL / DIRECT_URL。\n" +
        "            请在 .env 里配置后重试（可参考 .env.example）。"
    );
    process.exit(1);
  }

  resolvedUrl = await probeConnection();
  if (!resolvedUrl) process.exit(1);

  /**
   * 把两个变量都钉成**探通过的直连地址**。
   * 此后 Prisma CLI 无论读 prisma.config.ts 还是读 schema 里的
   * env("DATABASE_URL")，拿到的都是 5432 直连，不会挂在事务池上。
   * 只影响本脚本进程，不写回任何文件。
   */
  process.env.DATABASE_URL = resolvedUrl;
  process.env.DIRECT_URL = resolvedUrl;

  /**
   * 空库标记。必须在 deploy **之前**读出来 —— deploy 之后表就存在了，
   * 届时无法再判断「这是不是一个刚建好的空库」。只有空库才需要灌种子。
   */
  let freshDatabase = false;

  /**
   * 读状态单独包一层：让「连不上/无权限」和「基线登记失败」报出各自的错误，
   * 而不是都被归成同一句话。
   */
  let state;
  try {
    state = await readState();
  } catch (e) {
    console.error("[db-migrate] 读取数据库状态失败:", firstLine(e.message));
    process.exit(1);
  }

  console.log(
    `[db-migrate] 库状态：${SENTINEL_TABLE} 表=${state.hasAppTables ? "有" : "无"} / ` +
      `${MIGRATIONS_TABLE} 表=${state.hasMigrationsTable ? "有" : "无"} / ` +
      `基线 ${BASELINE_MIGRATION}=${state.baselineDone ? "已登记" : "未登记"}`
  );

  /**
   * 四条分支，按「迁移历史」和「实际有没有表」交叉判定：
   *
   *   历史已应用 + 有表   → 正常，什么都不用做，直接 deploy（无待应用项）
   *   历史已应用 + 无表   → **脱节**：表被单独删过、或从别处部分恢复过。
   *                        这种情况绝不能 deploy —— 它会重放 0_init 的建表语句，
   *                        撞上残留的 enum/类型（42710）后以 P3018 中途失败，
   *                        并留下一条「失败迁移」，后续还要人工 resolve。
   *   历史未登记 + 有表   → 存量库，先打基线再 deploy
   *   历史未登记 + 无表   → 空库，deploy 会建全部表，之后灌种子
   */
  if (state.baselineDone && !state.hasAppTables) {
    console.error(
      `[db-migrate] 迁移记录显示 ${BASELINE_MIGRATION} 已应用，但 ${SENTINEL_TABLE} 表不存在。\n` +
        "            迁移历史与数据库实际状态已脱节（表被单独删过，或从别处部分恢复过）。\n" +
        "            此时 deploy 会重放建表语句并中途失败，故已中止。\n" +
        "            请先执行 `pnpm db:status` 查看；确认该库可以重建后，\n" +
        "            用 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 清空再重跑本脚本。"
    );
    process.exit(1);
  }

  if (!state.baselineDone && state.hasAppTables) {
    try {
      await ensureBaselineRecorded();
    } catch (e) {
      console.error("[db-migrate] 登记基线失败:", firstLine(e.message));
      process.exit(1);
    }
  } else if (!state.hasAppTables) {
    freshDatabase = true;
    console.log("[db-migrate] 判定为空库 —— 将执行全部迁移建表。");
  }

  // deploy 只应用「迁移目录里有、而 _prisma_migrations 里没有」的那些。
  // 没有待应用项时它只是校验一遍，秒级返回 —— 所以本脚本可以反复执行。
  prismaOrDie("migrate deploy", ["migrate", "deploy"], DEPLOY_TIMEOUT_MS);

  /**
   * 最后确认哨兵表真的在。deploy 不做漂移检测，正常路径下这里必定通过；
   * 兜的是「迁移被标记为已应用、但实际什么都没建」这类意外，
   * 把静默空转变成显式失败。
   */
  try {
    if (!(await sentinelExists())) {
      console.error(
        `[db-migrate] 迁移执行完毕，但 ${SENTINEL_TABLE} 表依然不存在。\n` +
          "            迁移历史与数据库实际状态不匹配，请执行 `pnpm db:status` 查看详情。"
      );
      process.exit(1);
    }
    console.log(`[db-migrate] 校验通过：public 下共 ${await countBusinessTables()} 张业务表。`);
  } catch (e) {
    // 校验本身失败不该让已经成功的迁移变成失败
    console.warn("[db-migrate] 落库校验未能完成（忽略）:", firstLine(e.message));
  }

  if (freshDatabase) {
    console.log("[db-migrate] 空库建表完成，开始灌种子数据…");
    runSeed();
  } else {
    console.log(
      "[db-migrate] 数据库已是最新。如需单独重灌站点配置默认值：pnpm db:seed"
    );
  }
}

main();
