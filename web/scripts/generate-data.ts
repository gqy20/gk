/**
 * 构建时数据生成脚本。
 * 读取 data/92_list.csv + data/output/*.json + data/gaokao-output/*.json → 输出 public/data/schools.json
 *
 * 运行方式: npx tsx scripts/generate-data.ts
 */

import fs from "fs";
import path from "path";
import type { School, UniversityInfo, GaokaoBasicInfo, MajorSatisfaction } from "../src/lib/data";
import { groupByProvince } from "../src/lib/data";
import { getSchoolCoord } from "../src/lib/provinces";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(PROJECT_ROOT, "..", "data", "92_list.csv");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "..", "data", "output");
const DEST = path.join(__dirname, "..", "public", "data", "schools.json");
const COORDS_CACHE = path.join(__dirname, "../data/schools-coords.json");

// 阳光高考数据路径
const GAOKAO_OUTPUT_DIR = path.join(PROJECT_ROOT, "..", "data", "gaokao-output");
const GAOKAO_SCHIDS_PATH = path.join(PROJECT_ROOT, "..", "data", "gaokao-schids.json");

const DETAIL_NAME_ALIASES: Record<string, string[]> = {
  上海体育学院: ["上海体育大学"],
  空军军医大学: ["空军军医大学（第四军医大学）"],
};

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cols.push(current.trim());
  return cols;
}

function parseCSV(text: string): Omit<School, "coord" | "status" | "detail">[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((name) =>
    name.replace(/^\uFEFF/, ""),
  );
  const index = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) {
      throw new Error(`CSV 缺少字段: ${name}`);
    }
    return i;
  };

  const nameIndex = index("学校名称");
  const provinceIndex = index("所在省份");
  const urlIndex = index("学校官网");
  const is985Index = index("是否985");
  const is211Index = index("是否211");
  const doubleFirstIndex = index("是否双一流");

  const result: Omit<School, "coord" | "status" | "detail">[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < header.length) continue;
    result.push({
      name: cols[nameIndex],
      province: cols[provinceIndex],
      url: cols[urlIndex],
      is985: cols[is985Index] === "是",
      is211: cols[is211Index] === "是",
      isDoubleFirstClass: cols[doubleFirstIndex] === "是",
    });
  }
  return result;
}

function readDetails(): Map<string, UniversityInfo> {
  const detailMap = new Map<string, UniversityInfo>();

  if (!fs.existsSync(OUTPUT_DIR)) return detailMap;

  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const fullPath = path.join(OUTPUT_DIR, file);
      const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as UniversityInfo;
      const fallbackName = path.basename(file, ".json");
      const name = raw.university || fallbackName;
      detailMap.set(name, raw);
      detailMap.set(fallbackName, raw);
    } catch (error) {
      console.warn(`跳过解析失败文件: ${file}`, error);
    }
  }

  return detailMap;
}

function getExistingDoneCount(): number {
  if (!fs.existsSync(DEST)) return 0;

  try {
    const raw = JSON.parse(fs.readFileSync(DEST, "utf-8")) as {
      schools?: School[];
    };
    if (!Array.isArray(raw.schools)) return 0;
    return raw.schools.filter(
      (school) => school.status === "done" && school.detail,
    ).length;
  } catch {
    return 0;
  }
}

function getDetailForSchool(
  detailMap: Map<string, UniversityInfo>,
  schoolName: string,
): UniversityInfo | undefined {
  const candidates = [schoolName, ...(DETAIL_NAME_ALIASES[schoolName] || [])];
  for (const candidate of candidates) {
    const detail = detailMap.get(candidate);
    if (detail) return detail;
  }
  return undefined;
}

// ── 阳光高考基线数据 ──────────────────────────────────────

interface GaokaoSchId { name: string; sch_id: string; url: string }

/** 加载阳光高考 sch_id → 学校名映射 */
function loadGaokaoSchIds(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(GAOKAO_SCHIDS_PATH)) return map;
  try {
    const raw: GaokaoSchId[] = JSON.parse(fs.readFileSync(GAOKAO_SCHIDS_PATH, "utf-8"));
    for (const s of raw) {
      map.set(s.sch_id, s.name);
      // 也用学校名做反向索引（sch_id 可能是数字字符串）
      map.set(s.name, s.sch_id);
    }
  } catch { /* 静默失败 */ }
  return map;
}

/** 从阳光高考数据中提取 basic_info */
function extractBasicInfo(gaokao: Record<string, unknown>): GaokaoBasicInfo | undefined {
  const bi = gaokao.basic_info as Record<string, unknown> | undefined;
  if (!bi || !bi.location) return undefined;
  return {
    location: String(bi.location || ""),
    address: String(bi.address || ""),
    phone: String(bi.phone || ""),
    website: String(bi.website || ""),
    enrollment_website: String(bi.enrollment_website || ""),
    attributes: Array.isArray(bi.attributes) ? bi.attributes as string[] : [],
  };
}

/** 从阳光高考 major_streaming 提取专业满意度 */
function extractMajorSatisfaction(gaokao: Record<string, unknown>): MajorSatisfaction[] | undefined {
  const items = gaokao.major_streaming as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) return undefined;
  return items
    .filter((item) => item.summary)
    .map((item) => {
      const summary = String(item.summary || "");
      // 解析 "满意度 5.0 (12人投票)" 格式
      const scoreMatch = summary.match(/([\d.]+)\s*[\(（]/);
      const votesMatch = summary.match(/(\d+)\s*[人人]/);
      // 清理 title 中的 markdown 链接
      let title = String(item.title || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
      return {
        title: title.trim(),
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
        votes: votesMatch ? parseInt(votesMatch[1], 10) : 0,
      };
    })
    .filter((s) => s.score > 0);
}

/** 从阳光高考 faq 提取为 DocItem[] */
function extractFaqDocItems(gaokao: Record<string, unknown>): UniversityInfo["faq"] | undefined {
  const items = gaokao.faq as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) return undefined;
  return items
    .filter((item) => item.content && String(item.content).length > 10)
    .map((item) => ({
      title: `Q&A: ${item.topic || ""}`,
      url: "",
      summary: `**${item.topic || ""}**\n${item.content || ""}`,
      attachments: [],
      publish_date: "",
      source_department: "阳光高考平台",
    }));
}

/**
 * 合并阳光高考基线数据到 UniversityInfo。
 * Agent 数据优先，阳光高考作为 fallback/补充。
 */
function mergeGaokaoBaseline(
  detail: UniversityInfo,
  gaokao: Record<string, unknown>,
): UniversityInfo {
  // basic_info：始终注入（100% 覆盖，Agent 通常没有结构化的基础信息）
  const bi = extractBasicInfo(gaokao);
  if (bi && !detail.basic_info) {
    detail.basic_info = bi;
  }

  // faq：仅在 Agent 未抓到时用阳光高考补充
  if ((!detail.faq || detail.faq.length === 0)) {
    const faqItems = extractFaqDocItems(gaokao);
    if (faqItems && faqItems.length > 0) {
      detail.faq = faqItems;
    }
  }

  // major_satisfaction：专业口碑数据（全新字段，无冲突）
  const sat = extractMajorSatisfaction(gaokao);
  if (sat && sat.length > 0 && !detail.major_satisfaction) {
    detail.major_satisfaction = sat;
  }

  return detail;
}

/** 加载高德地理编码缓存（如果存在） */
function loadCoordsCache(): Record<string, [number, number]> | null {
  if (!fs.existsSync(COORDS_CACHE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(COORDS_CACHE, "utf-8"));
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  } catch {}
  return null;
}

async function main() {
  console.log("=== 生成前端数据 ===");

  // 0. 加载坐标缓存
  const coordsCache = loadCoordsCache();
  if (coordsCache) {
    console.log(`坐标缓存: 已加载 ${Object.keys(coordsCache).length} 所学校精确坐标`);
  } else {
    console.log("坐标缓存: 未找到，将使用估算坐标（运行 geocode-schools.ts 可生成精确坐标）");
  }

  // 1. 读 CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV 不存在: ${CSV_PATH}`);
    process.exit(1);
  }
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const metaList = parseCSV(csvText);
  console.log(`CSV: ${metaList.length} 所高校`);

  // 2. 读 output JSON
  const detailMap = readDetails();
  console.log(`Output: ${detailMap.size} 个详情索引`);
  if (detailMap.size === 0) {
    const existingDoneCount = getExistingDoneCount();
    if (existingDoneCount > 0) {
      console.warn(
        `未找到 ${OUTPUT_DIR} 详情源，保留现有 ${DEST}（已采集 ${existingDoneCount} 所）。`,
      );
      return;
    }
  }

  // 2.5 加载阳光高考基线数据
  const schIdMap = loadGaokaoSchIds();
  const gaokaoDirExists = fs.existsSync(GAOKAO_OUTPUT_DIR);
  console.log(`阳光高考: sch_ids=${schIdMap.size}, output_dir_exists=${gaokaoDirExists}`);

  // 3. 合并 + 填充坐标
  const provinceCounter = new Map<string, number>();
  const provinceTotals = new Map<string, number>();
  for (const item of metaList) {
    provinceTotals.set(item.province, (provinceTotals.get(item.province) || 0) + 1);
  }

  const schools: School[] = metaList.map((m) => {
    const prov = m.province;
    const idx = provinceCounter.get(prov) || 0;
    provinceCounter.set(prov, idx + 1);
    let detail = getDetailForSchool(detailMap, m.name);

    // 合并阳光高考基线数据
    if (detail && gaokaoDirExists && schIdMap.size > 0) {
      const schId = schIdMap.get(m.name);
      if (schId) {
        const gaokaoPath = path.join(GAOKAO_OUTPUT_DIR, `${schId}.json`);
        try {
          if (fs.existsSync(gaokaoPath)) {
            const gaokaoRaw = JSON.parse(fs.readFileSync(gaokaoPath, "utf-8"));
            detail = mergeGaokaoBaseline(detail, gaokaoRaw);
          }
        } catch { /* 单校失败不阻断 */ }
      }
    }

    return {
      ...m,
      coord: coordsCache?.[m.name] ?? getSchoolCoord(prov, idx, provinceTotals.get(prov) || 1),
      status: detail ? "done" : "pending",
      detail,
    };
  });

  // 4. 按省份分组
  const provinces = groupByProvince(schools);

  // 5. 写入目标文件
  const output = { schools, provinces };
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, JSON.stringify(output, null, 2), "utf-8");
  const outputSizeKb = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1);
  console.log(`输出: ${DEST} (${outputSizeKb} KB)`);
  console.log("完成!");

  // 6. 导出 SQLite 采集数据
  try {
    await import("./export-crawl-data.js");
  } catch {
    // gk.sqlite 不存在时静默跳过
  }
}

main();
