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

interface SchoolSource {
  name: string;
  province: string;
  detail?: {
    basic_info?: {
      address?: string;
      location?: string;
    };
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const PROVINCE_ALIASES: Record<string, string[]> = {
  北京: ["北京市"],
  天津: ["天津市"],
  河北: ["河北省"],
  山西: ["山西省"],
  内蒙古: ["内蒙古", "内蒙古自治区"],
  辽宁: ["辽宁省"],
  吉林: ["吉林省"],
  黑龙江: ["黑龙江省"],
  上海: ["上海市"],
  江苏: ["江苏省"],
  浙江: ["浙江省"],
  安徽: ["安徽省"],
  福建: ["福建省"],
  江西: ["江西省"],
  山东: ["山东省"],
  河南: ["河南省"],
  湖北: ["湖北省"],
  湖南: ["湖南省"],
  广东: ["广东省"],
  广西: ["广西壮族自治区", "广西"],
  海南: ["海南省"],
  重庆: ["重庆市"],
  四川: ["四川省"],
  贵州: ["贵州省"],
  云南: ["云南省"],
  西藏: ["西藏自治区", "西藏"],
  陕西: ["陕西省"],
  甘肃: ["甘肃省"],
  青海: ["青海省"],
  宁夏: ["宁夏回族自治区", "宁夏"],
  新疆: ["新疆维吾尔自治区", "新疆"],
};

// 特殊搜索词（用于同名地点匹配错误的学校，或阳光高考地址缺失的学校）
const SPECIAL_QUERIES: Record<string, string> = {
  "北京中医药大学": "北京市朝阳区北三环东路11号",
  "中国农业大学": "北京市海淀区清华东路17号",
  "北京航空航天大学": "海淀区学院路37号",
  "中国矿业大学（北京）": "北京市海淀区学院路丁11号",
  "中国石油大学（北京）": "北京市昌平区府学路18号",
  "华北电力大学": "北京市昌平区北农路2号",
  "华北电力大学（保定）": "河北省保定市永华北大街619号",
  "南开大学": "天津市南开区卫津路94号",
  "华东理工大学": "上海市徐汇区梅陇路130号",
  "上海海洋大学": "上海市浦东新区临港新城沪城环路999号",
  "南京大学": "江苏省南京市栖霞区仙林大道163号",
  "南京农业大学": "江苏省南京市玄武区卫岗1号",
  "中国药科大学": "江苏省南京市鼓楼区中央路童家巷24号",
  "江南大学": "江南大学 无锡",
  "中国美术学院": "中国美术学院 杭州",
  "中国海洋大学": "中国海洋大学 青岛",
  "中国石油大学（华东）": "山东省青岛市黄岛区长江西路66号",
  "中国地质大学（武汉）": "湖北省武汉市洪山区鲁磨路388号",
  "国防科技大学": "国防科技大学 长沙",
  "暨南大学": "暨南大学 广州",
  "华南师范大学": "华南师范大学石牌",
  "空军军医大学": "第四军医大学 西安",
};

const ADDRESS_STOP_WORDS = [
  "邮编",
  "邮政编码",
  "咨询电话",
  "电话",
  "传真",
  "邮箱",
  "网址",
  "招生网",
  "部门",
];

function normalizeAddressText(value: string | undefined): string {
  return (value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\([^)]*(?:电话|fax|Fax|FAX|邮编|招生)[^)]*\)/g, " ")
    .replace(/（[^）]*(?:电话|fax|Fax|FAX|邮编|招生)[^）]*）/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimAddressFragment(value: string): string {
  let result = value.trim();
  for (const word of ADDRESS_STOP_WORDS) {
    const index = result.indexOf(word);
    if (index > 0) result = result.slice(0, index);
  }
  return result
    .replace(/[，,；;。].*$/g, "")
    .replace(/[（(]$/g, "")
    .trim();
}

function getAddressCandidates(school: SchoolSource): string[] {
  const explicit = SPECIAL_QUERIES[school.name];
  const address = normalizeAddressText(school.detail?.basic_info?.address);
  const location = normalizeAddressText(school.detail?.basic_info?.location);
  const source = address || location;
  const candidates: string[] = [];

  if (explicit) candidates.push(explicit);

  if (source) {
    const mainCampus = source.match(/(?:学校)?主校区地址[：:\s]*([^；;。]+)/);
    if (mainCampus) candidates.push(trimAddressFragment(mainCampus[1]));

    const schoolBase = source.match(/(?:校本部|本部校区)(?:地址)?[：:\s]*([^；;。]+)/);
    if (schoolBase) candidates.push(trimAddressFragment(schoolBase[1]));

    const campus = source.match(
      /(?:[^\s，,；;。]{1,12}(?:校区|校园)(?:地址)?[：:\s]*)?((?:北京市|天津市|上海市|重庆市|河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省|湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|广西壮族自治区|宁夏回族自治区|新疆维吾尔自治区|西藏自治区)[^；;。]{6,90})/,
    );
    if (campus) candidates.push(trimAddressFragment(campus[1]));

    const cityAddress = source.match(
      /((?:[^\s，,；;。]{2,12}市|[^\s，,；;。]{2,12}自治州)[^；;。]{6,80})/,
    );
    if (cityAddress) candidates.push(trimAddressFragment(cityAddress[1]));
  }

  candidates.push(school.name);

  return [...new Set(candidates.filter((item) => item.length > 0))];
}

async function geocodeSmart(
  school: SchoolSource,
  province: string,
): Promise<[number, number] | null> {
  const aliases = PROVINCE_ALIASES[province] || [province];
  const queries = getAddressCandidates(school);

  for (const query of queries) {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(query)}&key=${AMAP_KEY}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      status: string;
      geocodes?: { location: string; level: string; formatted_address: string }[];
    };

    if (json.status !== "1" || !json.geocodes?.length) {
      await sleep(80);
      continue;
    }

    // 必须匹配学校所在省份，避免“海南大学”命中青海海南州这类结果。
    for (const g of json.geocodes) {
      if (aliases.some((a) => g.formatted_address.includes(a))) {
        const [lng, lat] = g.location.split(",").map((v) => parseFloat(v));
        return [lng, lat];
      }
    }

    await sleep(80);
  }

  return null;
}

async function main() {
  // 从 CSV 或已有 schools.json 读取学校列表
  let schools: SchoolSource[] = [];

  // 优先从 schools.json 读（信息更全）
  const schoolsJsonPath = path.join(__dirname, "../public/data/schools.json");
  if (fs.existsSync(schoolsJsonPath)) {
    const raw = JSON.parse(fs.readFileSync(schoolsJsonPath, "utf-8")) as {
      schools?: { name: string; province: string }[];
    };
    if (raw.schools?.length) {
      schools = raw.schools;
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
      const result = await geocodeSmart(schools[i], province);
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
