/**
 * 地图下钻 — 省市区三级导航
 *
 * 数据源: 阿里 DataV GeoAtlas
 *   省: https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json
 *   示例: 广东 440000 → https://.../440000_full.json (含21个市)
 */

/** 行政区划代码映射: 短省份名 → adcode */
export const PROVINCE_ADCODES: Record<string, string> = {
  北京: "110000",
  天津: "120000",
  河北: "130000",
  山西: "140000",
  内蒙古: "150000",
  辽宁: "210000",
  吉林: "220000",
  黑龙江: "230000",
  上海: "310000",
  江苏: "320000",
  浙江: "330000",
  安徽: "340000",
  福建: "350000",
  江西: "360000",
  山东: "370000",
  河南: "410000",
  湖北: "420000",
  湖南: "430000",
  广东: "440000",
  广西: "450000",
  海南: "460000",
  重庆: "500000",
  四川: "510000",
  贵州: "520000",
  云南: "530000",
  西藏: "540000",
  陕西: "610000",
  甘肃: "620000",
  青海: "630000",
  宁夏: "640000",
  新疆: "650000",
  香港: "810000",
  澳门: "820000",
  台湾: "710000",
};

/** ECharts 地图名称 → 短省份名（反向映射） */
export const MAP_NAME_TO_PROVINCE: Record<string, string> = {
  北京市: "北京",
  天津市: "天津",
  河北省: "河北",
  山西省: "山西",
  内蒙古自治区: "内蒙古",
  辽宁省: "辽宁",
  吉林省: "吉林",
  黑龙江省: "黑龙江",
  上海市: "上海",
  江苏省: "江苏",
  浙江省: "浙江",
  安徽省: "安徽",
  福建省: "福建",
  江西省: "江西",
  山东省: "山东",
  河南省: "河南",
  湖北省: "湖北",
  湖南省: "湖南",
  广东省: "广东",
  广西壮族自治区: "广西",
  海南省: "海南",
  重庆市: "重庆",
  四川省: "四川",
  贵州省: "贵州",
  云南省: "云南",
  西藏自治区: "西藏",
  陕西省: "陕西",
  甘肃省: "甘肃",
  青海省: "青海",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
  台湾省: "台湾",
};

/** 地图层级 */
export type MapLevel = "country" | "province" | "city";

/** 下钻状态 */
export interface DrillState {
  level: MapLevel;
  /** 当前显示的地图在 ECharts 中注册的名称 */
  mapName: string;
  /** 当前行政区划代码 */
  adcode: string;
  /** 面包屑路径 */
  breadcrumbs: { name: string; adcode: string; level: MapLevel }[];
}

/** 初始状态：中国全图 */
export const INITIAL_DRILL_STATE: DrillState = {
  level: "country",
  mapName: "china",
  adcode: "100000",
  breadcrumbs: [{ name: "全国", adcode: "100000", level: "country" }],
};

/** 根据短省份名获取 adcode */
export function getProvinceAdcode(province: string): string | null {
  return PROVINCE_ADCODES[province] ?? null;
}

/** 根据地图上的名称获取短省份名 */
export function mapNameToProvince(mapName: string): string | null {
  return MAP_NAME_TO_PROVINCE[mapName] ?? null;
}
