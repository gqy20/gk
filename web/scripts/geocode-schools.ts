/**
 * 高德地理编码 — 批量获取学校精确坐标。
 * 输出: data/schools-coords.json (供 generate-data.ts 构建时合并)
 *
 * 运行: npx tsx scripts/geocode-schools.ts
 */

import fs from "node:fs";
import path from "node:path";

// 手动加载 .env
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .forEach((line) => {
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim();
        process.env[key] = val;
      }
    });
}

const AMAP_KEY = process.env.AMAP_GEOCODE_KEY || process.env.NEXT_PUBLIC_AMAP_WEB_SERVICE_KEY || "";
const GEOCODE_URL = "https://restapi.amap.com/v3/geocode/geo";
const CACHE_PATH = path.join(__dirname, "../data/schools-coords.json");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const PROVINCE_ALIASES: Record<string, string[]> = {
  北京: ["北京市", "北京"],
  天津: ["天津市", "天津"],
  河北: ["河北省", "河北"],
  山西: ["山西省", "山西"],
  内蒙古: ["内蒙古", "内蒙古自治区"],
  辽宁: ["辽宁省", "辽宁"],
  吉林: ["吉林省", "吉林"],
  黑龙江: ["黑龙江省", "黑龙江"],
  上海: ["上海市", "上海"],
  江苏: ["江苏省", "江苏"],
  浙江: ["浙江省", "浙江"],
  安徽: ["安徽省", "安徽"],
  福建: ["福建省", "福建"],
  江西: ["江西省", "江西"],
  山东: ["山东省", "山东"],
  河南: ["河南省", "河南"],
  湖北: ["湖北省", "湖北"],
  湖南: ["湖南省", "湖南"],
  广东: ["广东省", "广东"],
  广西: ["广西壮族自治区", "广西"],
  海南: ["海南省", "海南"],
  重庆: ["重庆市", "重庆"],
  四川: ["四川省", "四川"],
  贵州: ["贵州省", "贵州"],
  云南: ["云南省", "云南"],
  西藏: ["西藏自治区", "西藏"],
  陕西: ["陕西省", "陕西"],
  甘肃: ["甘肃省", "甘肃"],
  青海: ["青海省", "青海"],
  宁夏: ["宁夏回族自治区", "宁夏"],
  新疆: ["新疆维吾尔自治区", "新疆"],
};

// 特殊搜索词（用于同名地点匹配错误的学校）
const SPECIAL_QUERIES: Record<string, string> = {
  "北京航空航天大学": "海淀区学院路37号",
  "上海海洋大学": "上海市浦东新区临港新城沪城环路999号",
  "江南大学": "江南大学 无锡",
  "中国美术学院": "中国美术学院 杭州",
  "中国海洋大学": "中国海洋大学 青岛",
  "国防科技大学": "国防科技大学 长沙",
  "暨南大学": "暨南大学 广州",
  "华南师范大学": "华南师范大学石牌",
  "空军军医大学": "第四军医大学 西安",
};

async function geocodeSmart(
  address: string,
  province: string,
): Promise<[number, number] | null> {
  const query = SPECIAL_QUERIES[address] || address;
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(query)}&key=${AMAP_KEY}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    status: string;
    geocodes?: { location: string; level: string; formatted_address: string }[];
  };

  if (json.status !== "1" || !json.geocodes?.length) return null;

  const aliases = PROVINCE_ALIASES[province] || [province];

  // 优先匹配包含省名的结果
  for (const g of json.geocodes) {
    if (aliases.some((a) => g.formatted_address.includes(a))) {
      const [lng, lat] = g.location.split(",").map((v) => parseFloat(v));
      return [lng, lat];
    }
  }

  // 兜底返回第一个
  const first = json.geocodes[0];
  const [lng, lat] = first.location.split(",").map((v) => parseFloat(v));
  return [lng, lat];
}

async function main() {
  // 从 CSV 或已有 schools.json 读取学校列表
  let schools: { name: string; province: string }[] = [];

  // 优先从 schools.json 读（信息更全）
  const schoolsJsonPath = path.join(__dirname, "../public/data/schools.json");
  if (fs.existsSync(schoolsJsonPath)) {
    const raw = JSON.parse(fs.readFileSync(schoolsJsonPath, "utf-8")) as {
      schools?: { name: string; province: string }[];
    };
    if (raw.schools?.length) {
      schools = raw.schools.map((s) => ({ name: s.name, province: s.province }));
    }
  }

  // fallback: 从 CSV 读
  if (schools.length === 0) {
    const csvPath = path.join(__dirname, "../../data/92_list.csv");
    if (!fs.existsSync(csvPath)) {
      console.error("找不到学校数据源（schools.json 或 92_list.csv）");
      process.exit(1);
    }
    const csvText = fs.readFileSync(csvPath, "utf-8");
    for (const line of csvText.trim().split(/\r?\n/).slice(1)) {
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
      if (cols.length >= 2) schools.push({ name: cols[0], province: cols[1] });
    }
  }

  console.log(`校准 ${schools.length} 所学校坐标...\n`);

  const coords: Record<string, [number, number]> = {};
  let success = 0;
  let failed = 0;

  for (let i = 0; i < schools.length; i++) {
    const { name, province } = schools[i];
    process.stdout.write(`[${i + 1}/${schools.length}] ${name} (${province}) ... `);

    try {
      const result = await geocodeSmart(name, province);
      if (result) {
        coords[name] = result;
        success++;
        console.log(`✅ [${result[0].toFixed(6)}, ${result[1].toFixed(6)}]`);
      } else {
        failed++;
        console.log(`❌ 未找到`);
      }
    } catch (e) {
      failed++;
      console.log(`❌ ${(e as Error).message}`);
    }

    if (i < schools.length - 1) await sleep(400);
  }

  // 写入缓存
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(coords, null, 2), "utf-8");

  console.log(`\n========== 完成 ==========`);
  console.log(`成功: ${success} | 失败: ${failed}`);
  console.log(`缓存已写入: ${CACHE_PATH}`);
  console.log("\n提示: 下次运行 pnpm build 时会自动使用此缓存");
}

main().catch(console.error);
