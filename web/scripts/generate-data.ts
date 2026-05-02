/**
 * 构建时数据生成脚本。
 * 读取 data/92_list.csv + data/output/*.json → 输出 public/data/schools.json
 *
 * 运行方式: npx tsx scripts/generate-data.ts
 */

import fs from "fs";
import path from "path";
import type { School, UniversityInfo } from "../src/lib/data";
import { groupByProvince } from "../src/lib/data";
import { getSchoolCoord } from "../src/lib/provinces";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(PROJECT_ROOT, "..", "data", "92_list.csv");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "..", "data", "output");
const DEST = path.join(__dirname, "..", "public", "data", "schools.json");

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

function main() {
  console.log("=== 生成前端数据 ===");

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
    const detail = detailMap.get(m.name);

    return {
      ...m,
      coord: getSchoolCoord(prov, idx, provinceTotals.get(prov) || 1),
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
  console.log(`输出: ${DEST} (${(Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1)} KB)`);
  console.log("完成!");
}

main();
