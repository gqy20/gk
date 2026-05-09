/**
 * 从 gk.sqlite 导出采集数据为静态 JSON。
 * 输出: public/data/crawl-status.json, crawl-sources.json, crawl-runs.json
 *
 * 运行: npx tsx scripts/export-crawl-data.ts
 * 或由 generate-data.ts 自动调用
 */

import fs from "node:fs";
import path from "node:path";
// @ts-ignore -- node:sqlite is experimental in Node 24
import { DatabaseSync } from "node:sqlite";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(PROJECT_ROOT, "..", "data", "gk.sqlite");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "data");

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.warn(`SQLite 不存在: ${DB_PATH}，跳过导出`);
    return;
  }

  const db = new DatabaseSync(DB_PATH, { readonly: true });

  // ── 1. 构建 id → name_zh 映射 ──
  const uniMap = new Map<string, string>();
  for (const row of db
    .prepare("SELECT id, name_zh FROM university")
    .all() as { id: string; name_zh: string }[]) {
    uniMap.set(row.id, row.name_zh);
  }

  // ── 2. 导出 crawl-status.json ──
  const statusRows = db
    .prepare(
      "SELECT university_id, category, status, attempts, urls_collected, last_error FROM categorystatus",
    )
    .all() as {
    university_id: string;
    category: string;
    status: string;
    attempts: number;
    urls_collected: number;
    last_error: string | null;
  }[];

  const crawlStatus: Record<string, Record<string, object>> = {};
  for (const r of statusRows) {
    const name = uniMap.get(r.university_id);
    if (!name) continue;
    if (!crawlStatus[name]) crawlStatus[name] = {};
    crawlStatus[name][r.category] = {
      status: r.status,
      attempts: r.attempts,
      urls_collected: r.urls_collected,
      ...(r.last_error ? { last_error: r.last_error } : {}),
    };
  }

  writeJson(path.join(OUTPUT_DIR, "crawl-status.json"), crawlStatus);

  // ── 3. 导出 crawl-sources.json ──
  const sourceRows = db
    .prepare(
      "SELECT university_id, category, url, title, relevance_note, source_type, agent_confidence, http_status FROM source",
    )
    .all() as {
    university_id: string;
    category: string;
    url: string;
    title: string | null;
    relevance_note: string;
    source_type: string;
    agent_confidence: number;
    http_status: number | null;
  }[];

  const crawlSources: Record<string, Record<string, object[]>> = {};
  for (const r of sourceRows) {
    const name = uniMap.get(r.university_id);
    if (!name) continue;
    if (!crawlSources[name]) crawlSources[name] = {};
    if (!crawlSources[name][r.category]) crawlSources[name][r.category] = [];
    (crawlSources[name][r.category] as object[]).push({
      url: r.url,
      title: r.title,
      relevance_note: r.relevance_note,
      source_type: r.source_type,
      agent_confidence: r.agent_confidence,
      http_status: r.http_status,
    });
  }

  writeJson(path.join(OUTPUT_DIR, "crawl-sources.json"), crawlSources);

  // ── 4. 导出 crawl-runs.json ──
  const runRows = db
    .prepare(
      "SELECT id, started_at, finished_at, status, universities_planned, categories_completed, total_input_tokens, total_output_tokens, total_cost_usd, notes FROM run ORDER BY started_at DESC",
    )
    .all() as Record<string, unknown>[];

  writeJson(path.join(OUTPUT_DIR, "crawl-runs.json"), runRows);

  db.close();

  const statusCount = Object.keys(crawlStatus).length;
  const sourcesCount = Object.keys(crawlSources).length;
  console.log(
    `采集数据导出: status(${statusCount}校) sources(${sourcesCount}校) runs(${runRows.length})`,
  );
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
  const sizeKB = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1);
  console.log(`  ${path.basename(filePath)} (${sizeKB} KB)`);
}

main();
