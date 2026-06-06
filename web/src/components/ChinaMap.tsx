"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { colors } from "@/lib/theme";
import { EMPTY_MESSAGES } from "@/lib/constants";
import type { School, ProvinceData } from "@/lib/data";
import {
  MAP_NAME_TO_PROVINCE,
  type MapLevel,
  type DrillState,
  INITIAL_DRILL_STATE,
  getProvinceAdcode,
} from "@/lib/map-drill";
import SchoolPopup from "./SchoolPopup";

interface ChinaMapProps {
  schools: School[];
  provinces: ProvinceData[];
  selectedProvince: string | null;
  previewSchool: School | null;
  onProvinceSelect: (province: string | null) => void;
  onSchoolPreview: (school: School | null) => void;
  onSchoolClick: (school: School) => void;
}

const MAP_PROVINCE_NAMES: Record<string, string> = {
  北京: "北京市",
  天津: "天津市",
  河北: "河北省",
  山西: "山西省",
  内蒙古: "内蒙古自治区",
  辽宁: "辽宁省",
  吉林: "吉林省",
  黑龙江: "黑龙江省",
  上海: "上海市",
  江苏: "江苏省",
  浙江: "浙江省",
  安徽: "安徽省",
  福建: "福建省",
  江西: "江西省",
  山东: "山东省",
  河南: "河南省",
  湖北: "湖北省",
  湖南: "湖南省",
  广东: "广东省",
  广西: "广西壮族自治区",
  海南: "海南省",
  重庆: "重庆市",
  四川: "四川省",
  贵州: "贵州省",
  云南: "云南省",
  西藏: "西藏自治区",
  陕西: "陕西省",
  甘肃: "甘肃省",
  青海: "青海省",
  宁夏: "宁夏回族自治区",
  新疆: "新疆维吾尔自治区",
  香港: "香港特别行政区",
  澳门: "澳门特别行政区",
  台湾: "台湾省",
};

const SHORT_PROVINCE_NAMES = new Map(
  Object.entries(MAP_PROVINCE_NAMES).map(([shortName, mapName]) => [
    mapName,
    shortName,
  ]),
);

const MAP_CENTER_COUNTRY: [number, number] = [104, 35.8];
const MAP_ZOOM_COUNTRY = 1.16;

const GEO_SEA_TEXTURE_BOUNDS = {
  west: 113,
  east: 146,
  north: 60,
  south: 5,
} as const;

const GEO_ART_LAYERS = [
  {
    id: "sea",
    className: "china-map-geo-sea",
    bounds: GEO_SEA_TEXTURE_BOUNDS,
    opacity: 1,
  },
  {
    id: "mountains",
    className: "china-map-geo-mountains",
    bounds: { west: 72, east: 102, north: 52, south: 25 },
    opacity: 0.42,
  },
  {
    id: "waves",
    className: "china-map-geo-waves",
    bounds: { west: 113, east: 131, north: 28, south: 11 },
    opacity: 0.30,
  },
] as const;

const PROVINCE_WATERCOLOR_COLORS = [
  "rgba(204, 226, 221, 0.72)",
  "rgba(216, 229, 199, 0.72)",
  "rgba(225, 211, 175, 0.70)",
  "rgba(202, 222, 238, 0.72)",
  "rgba(220, 202, 232, 0.62)",
  "rgba(232, 190, 198, 0.58)",
  "rgba(184, 218, 196, 0.70)",
  "rgba(221, 228, 211, 0.72)",
] as const;

type MapTheme = {
  name: string;
  sea: string;
  seaDeep: string;
  land: string;
  landDeep: string;
  border: string;
  borderStrong: string;
  glow: string;
  glowStrong: string;
  shadowDeep: string;
  shadowMid: string;
  text: string;
  textMuted: string;
  visualMap: string[];
  paper: string;
  paperEdge: string;
  vignette: string;
};

const BASE_THEME: MapTheme = {
  name: "default",
  sea: "#68b7c1",
  seaDeep: "#3f8f9b",
  land: "rgba(221, 233, 223, 0.76)",
  landDeep: "rgba(189, 219, 212, 0.68)",
  border: "rgba(126, 137, 128, 0.56)",
  borderStrong: "rgba(80, 98, 92, 0.78)",
  glow: "rgba(117, 179, 179, 0.22)",
  glowStrong: "rgba(242, 223, 174, 0.78)",
  shadowDeep: "rgba(112, 93, 67, 0.18)",
  shadowMid: "rgba(90, 150, 150, 0.14)",
  text: "#fdf9ee",
  textMuted: "rgba(74, 82, 76, 0.68)",
  visualMap: ["#dce9df", "#bddbd4", "#94c8c6", "#72b6b7", "#d9bd75"],
  paper: "rgba(255, 250, 240, 0.48)",
  paperEdge: "rgba(84, 76, 61, 0.10)",
  vignette: "rgba(85, 68, 45, 0.14)",
};

const PROVINCE_THEME_GROUPS: Array<{
  name: string;
  provinces: string[];
  theme: Omit<MapTheme, "name">;
}> = [
  {
    name: "jiangnan",
    provinces: ["江苏", "浙江", "福建", "上海", "广东", "广西", "海南"],
    theme: {
      sea: "#102230",
      seaDeep: "#08121b",
      land: "rgba(205, 226, 186, 0.78)",
      landDeep: "rgba(151, 196, 158, 0.62)",
      border: "rgba(104, 136, 122, 0.52)",
      borderStrong: "rgba(68, 103, 90, 0.78)",
      glow: "rgba(103, 180, 158, 0.22)",
      glowStrong: "rgba(196, 222, 166, 0.82)",
      shadowDeep: "rgba(1, 15, 20, 0.78)",
      shadowMid: "rgba(12, 46, 48, 0.58)",
      text: "#fffaf0",
      textMuted: "rgba(68, 84, 78, 0.68)",
      visualMap: ["#cce2dd", "#a7d3cf", "#82c4c5", "#8fcda4", "#d8c577"],
      paper: "rgba(243, 250, 238, 0.05)",
      paperEdge: "rgba(236, 248, 234, 0.08)",
      vignette: "rgba(7, 17, 19, 0.36)",
    },
  },
  {
    name: "central",
    provinces: ["北京", "天津", "河北", "山西", "河南", "山东", "安徽", "陕西"],
    theme: {
      sea: "#101d2a",
      seaDeep: "#071018",
      land: "rgba(232, 212, 163, 0.78)",
      landDeep: "rgba(216, 184, 111, 0.58)",
      border: "rgba(141, 126, 96, 0.5)",
      borderStrong: "rgba(105, 88, 60, 0.76)",
      glow: "rgba(188, 160, 92, 0.22)",
      glowStrong: "rgba(241, 216, 145, 0.86)",
      shadowDeep: "rgba(10, 13, 18, 0.8)",
      shadowMid: "rgba(44, 53, 54, 0.6)",
      text: "#fffaf0",
      textMuted: "rgba(85, 76, 61, 0.68)",
      visualMap: ["#e6dcc5", "#e0cc9c", "#d8b872", "#bad0c7", "#9fc9db"],
      paper: "rgba(255, 248, 232, 0.046)",
      paperEdge: "rgba(255, 250, 240, 0.08)",
      vignette: "rgba(7, 12, 17, 0.4)",
    },
  },
  {
    name: "southwest",
    provinces: ["四川", "重庆", "贵州", "云南", "湖北", "湖南"],
    theme: {
      sea: "#0e1d28",
      seaDeep: "#071219",
      land: "rgba(174, 214, 169, 0.76)",
      landDeep: "rgba(118, 174, 137, 0.58)",
      border: "rgba(93, 127, 105, 0.52)",
      borderStrong: "rgba(62, 101, 78, 0.78)",
      glow: "rgba(90, 147, 116, 0.22)",
      glowStrong: "rgba(178, 219, 181, 0.82)",
      shadowDeep: "rgba(2, 16, 17, 0.78)",
      shadowMid: "rgba(10, 40, 36, 0.58)",
      text: "#fffaf0",
      textMuted: "rgba(65, 86, 70, 0.68)",
      visualMap: ["#d1e7cf", "#a9d5b9", "#77b78d", "#bad49a", "#e8b5bb"],
      paper: "rgba(242, 249, 239, 0.05)",
      paperEdge: "rgba(237, 248, 232, 0.08)",
      vignette: "rgba(6, 13, 14, 0.38)",
    },
  },
  {
    name: "northwest",
    provinces: ["甘肃", "青海", "宁夏", "新疆", "西藏", "内蒙古"],
    theme: {
      sea: "#12212c",
      seaDeep: "#08121a",
      land: "rgba(195, 218, 235, 0.72)",
      landDeep: "rgba(143, 184, 213, 0.56)",
      border: "rgba(102, 125, 137, 0.52)",
      borderStrong: "rgba(70, 95, 108, 0.76)",
      glow: "rgba(126, 163, 188, 0.22)",
      glowStrong: "rgba(190, 214, 234, 0.84)",
      shadowDeep: "rgba(7, 15, 20, 0.8)",
      shadowMid: "rgba(35, 53, 61, 0.6)",
      text: "#fffaf0",
      textMuted: "rgba(68, 87, 98, 0.68)",
      visualMap: ["#dce8ef", "#bad5e8", "#92bfdc", "#cfc487", "#e6d5a0"],
      paper: "rgba(255, 249, 239, 0.044)",
      paperEdge: "rgba(255, 252, 245, 0.08)",
      vignette: "rgba(8, 13, 17, 0.42)",
    },
  },
  {
    name: "northeast",
    provinces: ["辽宁", "吉林", "黑龙江"],
    theme: {
      sea: "#10202c",
      seaDeep: "#071119",
      land: "rgba(202, 222, 234, 0.76)",
      landDeep: "rgba(151, 190, 209, 0.58)",
      border: "rgba(99, 124, 137, 0.52)",
      borderStrong: "rgba(66, 91, 105, 0.78)",
      glow: "rgba(111, 159, 172, 0.22)",
      glowStrong: "rgba(199, 226, 236, 0.84)",
      shadowDeep: "rgba(4, 15, 21, 0.8)",
      shadowMid: "rgba(15, 42, 48, 0.58)",
      text: "#fffaf0",
      textMuted: "rgba(68, 86, 96, 0.68)",
      visualMap: ["#dcebf0", "#badbe8", "#95c6dc", "#a9d3cf", "#d7dfbe"],
      paper: "rgba(241, 248, 250, 0.045)",
      paperEdge: "rgba(237, 247, 249, 0.08)",
      vignette: "rgba(6, 11, 16, 0.4)",
    },
  },
];

function resolveTheme(province?: string | null): MapTheme {
  if (!province) return BASE_THEME;
  const group = PROVINCE_THEME_GROUPS.find((item) => item.provinces.includes(province));
  if (!group) return BASE_THEME;
  return { name: group.name, ...group.theme };
}

/** 各省份地图的中心坐标和缩放级别 */
const PROVINCE_MAP_CONFIG: Record<string, { center: [number, number]; zoom: number }> = {
  北京: { center: [116.4, 40.0], zoom: 1.5 },
  天津: { center: [117.2, 39.1], zoom: 1.5 },
  河北: { center: [115.5, 38.0], zoom: 1.2 },
  山西: { center: [112.5, 37.5], zoom: 1.3 },
  内蒙古: { center: [118.0, 43.5], zoom: 0.8 },
  辽宁: { center: [123.4, 41.8], zoom: 1.2 },
  吉林: { center: [126.5, 43.8], zoom: 1.3 },
  黑龙江: { center: [128.0, 46.5], zoom: 1.0 },
  上海: { center: [121.5, 31.2], zoom: 1.6 },
  江苏: { center: [119.8, 33.0], zoom: 1.3 },
  浙江: { center: [120.2, 29.0], zoom: 1.3 },
  安徽: { center: [117.3, 31.8], zoom: 1.3 },
  福建: { center: [118.0, 26.0], zoom: 1.3 },
  江西: { center: [116.0, 27.5], zoom: 1.3 },
  山东: { center: [118.0, 36.5], zoom: 1.2 },
  河南: { center: [113.7, 34.0], zoom: 1.3 },
  湖北: { center: [112.3, 30.8], zoom: 1.3 },
  湖南: { center: [112.0, 27.8], zoom: 1.3 },
  广东: { center: [113.5, 23.3], zoom: 1.2 },
  广西: { center: [108.5, 23.7], zoom: 1.3 },
  海南: { center: [109.5, 19.2], zoom: 1.5 },
  重庆: { center: [107.5, 29.6], zoom: 1.5 },
  四川: { center: [104.0, 30.5], zoom: 1.1 },
  贵州: { center: [106.7, 26.7], zoom: 1.4 },
  云南: { center: [102.5, 25.0], zoom: 1.1 },
  西藏: { center: [89.5, 31.5], zoom: 0.9 },
  陕西: { center: [109.0, 35.0], zoom: 1.2 },
  甘肃: { center: [104.0, 36.0], zoom: 1.1 },
  青海: { center: [96.0, 35.8], zoom: 1.1 },
  宁夏: { center: [106.2, 38.0], zoom: 1.5 },
  新疆: { center: [85.5, 41.0], zoom: 0.7 },
  香港: { center: [114.17, 22.28], zoom: 2.0 },
  澳门: { center: [113.54, 22.19], zoom: 2.0 },
  台湾: { center: [120.9, 23.8], zoom: 1.3 },
};

type TooltipParam = {
  name?: string;
  seriesType?: string;
  data?: {
    name?: string;
    province?: string;
    value?: unknown[];
    adcode?: string;
  };
};

function mapProvinceName(province: string): string {
  return MAP_PROVINCE_NAMES[province] || province;
}

function shortProvinceName(name?: string): string | null {
  if (!name) return null;
  return SHORT_PROVINCE_NAMES.get(name) || name;
}

function tooltipParam(params: unknown): TooltipParam {
  return (Array.isArray(params) ? params[0] : params) as TooltipParam;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function provinceWatercolor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % PROVINCE_WATERCOLOR_COLORS.length;
  }
  return PROVINCE_WATERCOLOR_COLORS[hash];
}

type GeoArtLayerId = (typeof GEO_ART_LAYERS)[number]["id"];

export default function ChinaMap({
  schools,
  provinces,
  selectedProvince,
  previewSchool,
  onProvinceSelect,
  onSchoolPreview,
  onSchoolClick: _onSchoolClick,
}: ChinaMapProps) {
  const chartRef = useRef<ReactECharts>(null);
  const geoArtRefs = useRef<Partial<Record<GeoArtLayerId, HTMLDivElement | null>>>({});
  const geoArtFrameRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // 下钻状态
  const [drill, setDrill] = useState<DrillState>(INITIAL_DRILL_STATE);

  // 已注册的地图名称集合（避免重复注册）
  const registeredMaps = useRef(new Set(["china"]));

  /** 加载并注册指定 adcode 的地图 */
  const loadMap = useCallback(async (adcode: string, mapName: string) => {
    if (registeredMaps.current.has(mapName)) return true;

    try {
      const json = await fetch(`/maps/${adcode}.json`).then((r) => r.json());
      echarts.registerMap(mapName, json as never);
      registeredMaps.current.add(mapName);
      return true;
    } catch {
      console.warn(`[ChinaMap] Failed to load map: ${adcode}`);
      return false;
    }
  }, []);

  /** 下钻到下一级 */
  const drillDown = useCallback(
    async (name: string, adcode: string) => {
      setLoadingDrill(true);

      // 判断当前层级，决定目标层级和地图名
      let targetLevel: MapLevel;
      let targetMapName: string;
      let targetAdcode: string;

      if (drill.level === "country") {
        // 全国 → 省级（市级视图）
        targetLevel = "province";
        targetMapName = `province_${adcode}`;
        targetAdcode = adcode;
      } else if (drill.level === "province") {
        // 省级 → 市级（区县视图）
        targetLevel = "city";
        targetMapName = `city_${adcode}`;
        targetAdcode = adcode;
      } else {
        setLoadingDrill(false);
        return;
      }

      const ok = await loadMap(targetAdcode, targetMapName);
      if (!ok) {
        setLoadingDrill(false);
        return;
      }

      const newBreadcrumbs = [
        ...drill.breadcrumbs,
        { name, adcode: targetAdcode, level: targetLevel },
      ];

      setDrill({
        level: targetLevel,
        mapName: targetMapName,
        adcode: targetAdcode,
        breadcrumbs: newBreadcrumbs,
      });

      // 同步通知父组件选中该省份
      if (targetLevel === "province") {
        const prov = MAP_NAME_TO_PROVINCE[name] || name;
        onProvinceSelect(prov);
      }

      setLoadingDrill(false);
    },
    [drill, loadMap, onProvinceSelect],
  );

  /** 返回全国 */
  const resetToCountry = useCallback(() => {
    setDrill(INITIAL_DRILL_STATE);
    onProvinceSelect(null);
  }, [onProvinceSelect]);

  useEffect(() => {
    let cancelled = false;

    async function registerMaps() {
      try {
        const chinaJson = await fetch("/china.json").then((r) => r.json());
        if (!cancelled) {
          echarts.registerMap("china", chinaJson as never);
        }
      } catch {
        if (!cancelled) {
          setMapReady(false);
          return;
        }
      }

      if (!cancelled) {
        setMapReady(true);
      }
    }

    registerMaps();
    return () => {
      cancelled = true;
    };
  }, []);

  // 根据当前下钻状态筛选学校
  const visibleSchools = useMemo(() => {
    if (drill.level === "country") return schools;
    // 省级或市级视图：只显示当前省份的学校
    const currentProv =
      drill.level === "province"
        ? MAP_NAME_TO_PROVINCE[drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name] ||
          selectedProvince
        : selectedProvince;

    if (!currentProv) return schools;
    return schools.filter((s) => s.province === currentProv);
  }, [schools, drill.level, drill.breadcrumbs, selectedProvince]);

  const currentProvince =
    drill.level === "country"
      ? selectedProvince
      : MAP_NAME_TO_PROVINCE[drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name] ||
        selectedProvince;
  const mapTheme = useMemo(() => resolveTheme(currentProvince), [currentProvince]);
  const stageStyle = useMemo(
    () =>
      ({
        "--china-map-sea": mapTheme.sea,
        "--china-map-sea-deep": mapTheme.seaDeep,
        "--china-map-land": mapTheme.land,
        "--china-map-land-deep": mapTheme.landDeep,
        "--china-map-border": mapTheme.border,
        "--china-map-border-strong": mapTheme.borderStrong,
        "--china-map-glow": mapTheme.glow,
        "--china-map-glow-strong": mapTheme.glowStrong,
        "--china-map-shadow-deep": mapTheme.shadowDeep,
        "--china-map-shadow-mid": mapTheme.shadowMid,
        "--china-map-text": mapTheme.text,
        "--china-map-text-muted": mapTheme.textMuted,
        "--china-map-paper": mapTheme.paper,
        "--china-map-paper-edge": mapTheme.paperEdge,
        "--china-map-vignette": mapTheme.vignette,
      }) as CSSProperties,
    [mapTheme],
  );

  // 根据当前下钻状态计算区域聚合数据
  const regionData = useMemo(() => {
    if (drill.level === "country") {
      return provinces.map((p) => ({
        name: mapProvinceName(p.name),
        rawName: p.name,
        value: p.count,
        adcode: getProvinceAdcode(p.name) || "",
      }));
    }
    // 省级视图：按城市聚合（暂时用省份计数的简化版）
    // TODO: 接入城市数据后改为真正的城市聚合
    return [];
  }, [drill.level, provinces]);

  // 学校标记颜色
  function schoolColor(school: School): string {
    if (selectedProvince && school.province !== selectedProvince)
      return colors.chart.schoolMuted;
    if (school.is985) return colors.chart.school985;
    if (school.is211) return colors.chart.school211;
    if (school.isDoubleFirstClass) return colors.chart.schoolDoubleFirst;
    return colors.chart.schoolNormal;
  }

  function schoolShadow(school: School): string {
    if (school.is985) return "rgba(201, 71, 67, 0.38)";
    if (school.is211) return "rgba(185, 133, 55, 0.36)";
    if (school.isDoubleFirstClass) return "rgba(63, 143, 118, 0.34)";
    return "rgba(63, 143, 155, 0.30)";
  }

  const getOption = (): echarts.EChartsOption => {
    const currentMapName = drill.mapName;

    // 根据当前层级确定中心点和缩放
    let geoCenter: [number, number];
    let geoZoom: number;

    if (drill.level === "country") {
      geoCenter = MAP_CENTER_COUNTRY;
      geoZoom = MAP_ZOOM_COUNTRY;
    } else {
      // 从面包屑获取当前区域名称
      const currentName = drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name;
      const shortProv = MAP_NAME_TO_PROVINCE[currentName] || currentName;
      const config = PROVINCE_MAP_CONFIG[shortProv];
      if (config) {
        geoCenter = config.center;
        geoZoom = config.zoom;
      } else {
        geoCenter = MAP_CENTER_COUNTRY;
        geoZoom = MAP_ZOOM_COUNTRY;
      }
    }

    const scatterData = visibleSchools.map((school) => ({
      name: school.name,
      province: school.province,
      tier: school.is985 ? "985" : school.is211 ? "211" : school.isDoubleFirstClass ? "doubleFirst" : "normal",
      value: [...school.coord, school.province],
      itemStyle: {
        color: schoolColor(school),
        opacity: selectedProvince && school.province !== selectedProvince ? 0.42 : 0.96,
        shadowBlur:
          school.is985 || school.is211 || school.isDoubleFirstClass ? 22 : 12,
        shadowColor: schoolShadow(school),
        borderColor: "rgba(255,250,240,0.96)",
        borderWidth: school.is985 || school.is211 ? 2 : 1.2,
      },
    }));

    const mapData = regionData.map((r) => ({
      name: r.name,
      value: r.value,
      adcode: r.adcode,
      selected: selectedProvince === r.rawName,
      itemStyle: {
        areaColor: provinceWatercolor(r.rawName),
      },
    }));

    // visualMap 只在全国视图显示
    const visualMapConfig =
      drill.level === "country"
        ? {
            min: 0,
            max: Math.max(...provinces.map((p) => p.count), 1),
            left: 16,
            bottom: 18,
            text: ["多", "少"],
            calculable: false,
            itemWidth: 12,
            itemHeight: 90,
            textStyle: {
              color: mapTheme.textMuted,
              fontSize: 11,
            },
            inRange: {
              color: mapTheme.visualMap,
            },
            outOfRange: {
              color: [mapTheme.visualMap[0]],
            },
          }
        : undefined;

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      animationDurationUpdate: 520,
      animationEasingUpdate: "cubicOut",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(11, 18, 24, 0.94)",
        borderColor: mapTheme.border,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: mapTheme.text,
          fontSize: 12,
        },
        extraCssText:
          "box-shadow:0 18px 45px rgba(0,12,18,.45);border-radius:8px;backdrop-filter:blur(10px);",
        formatter: (params: unknown) => {
          const item = tooltipParam(params);
          if (item.seriesType === "scatter") {
            const data = item.data;
            const name = data?.name || item.name || "";
            const province = data?.province || String(data?.value?.[2] || "");
            return `<b>${escapeHtml(name)}</b><br/>${escapeHtml(province)}`;
          }

          if (drill.level === "country") {
            const province = shortProvinceName(item.name);
            const count =
              provinces.find((p) => p.name === province)?.count ?? 0;
            return `<b>${escapeHtml(item.name || "")}</b><br/>高校: ${count} 所`;
          }

          return `<b>${escapeHtml(item.name || "")}</b>`;
        },
      },
      ...(visualMapConfig ? { visualMap: visualMapConfig } : {}),
      geo: {
        map: currentMapName,
        roam: true,
        zoom: geoZoom,
        center: geoCenter,
        label: {
          show: drill.level !== "country",
          color: mapTheme.textMuted,
          fontSize: 10,
        },
        itemStyle: {
          areaColor: mapTheme.landDeep,
          borderColor: mapTheme.border,
          borderWidth: drill.level === "country" ? 1.1 : 0.8,
          shadowBlur: 0,
          shadowColor: "transparent",
        },
        emphasis: {
          itemStyle: {
            areaColor: mapTheme.glowStrong,
            borderColor: mapTheme.borderStrong,
            borderWidth: 1.8,
            shadowBlur: 8,
            shadowColor: mapTheme.glowStrong,
          },
          label: {
            show: true,
            color: mapTheme.text,
            fontSize: drill.level === "country" ? 12 : 11,
            fontWeight: 600,
          },
        },
        select: {
          itemStyle: {
            areaColor: mapTheme.glowStrong,
            borderColor: mapTheme.borderStrong,
            shadowBlur: 34,
            shadowColor: mapTheme.glowStrong,
          },
          label: {
            show: true,
            color: "#06141b",
            fontWeight: 700,
          },
        },
      },
      series: [
        {
          name: drill.level === "country" ? "高校数量" : "行政区划",
          type: "map",
          map: currentMapName,
          geoIndex: 0,
          selectedMode: "single",
          data: mapData,
          itemStyle: {
            areaColor: mapTheme.land,
            borderColor: mapTheme.border,
            borderWidth: drill.level === "country" ? 0.9 : 0.7,
            shadowBlur: 16,
            shadowColor: mapTheme.glow,
          },
          emphasis: {
            itemStyle: {
              areaColor: mapTheme.glowStrong,
              borderColor: mapTheme.borderStrong,
              shadowBlur: 28,
              shadowColor: mapTheme.glowStrong,
            },
          },
          zlevel: 1,
          z: 3,
        },
        {
          name: "高校分布",
          type: "scatter",
          coordinateSystem: "geo",
          data: scatterData,
          symbol: "circle",
          symbolSize: (_value: unknown, params: { data?: { tier?: string } }) => {
            switch (params.data?.tier) {
              case "985":
                return 17;
              case "211":
                return 14;
              case "doubleFirst":
                return 12;
              default:
                return 9;
            }
          },
          label: {
            show: false,
          },
          emphasis: {
            scale: true,
            itemStyle: {
              color: colors.primaryHover,
              borderColor: "#e9fbff",
              borderWidth: 1,
              shadowBlur: 28,
              shadowColor: "rgba(128, 225, 242, 0.72)",
            },
          },
          zlevel: 3,
          z: 12,
        },
      ],
    };
  };

  const option = useMemo(
    () => getOption(),
    [visibleSchools, provinces, selectedProvince, drill, mapTheme],
  );

  const hideGeoArtLayer = useCallback((id: GeoArtLayerId) => {
    const element = geoArtRefs.current[id];
    if (!element) return;
    element.style.opacity = "0";
  }, []);

  const updateGeoArtNow = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (!chart || drill.level !== "country") {
      GEO_ART_LAYERS.forEach((layer) => hideGeoArtLayer(layer.id));
      return;
    }

    try {
      GEO_ART_LAYERS.forEach((layer) => {
        const element = geoArtRefs.current[layer.id];
        if (!element) return;

        const northWest = chart.convertToPixel({ geoIndex: 0 }, [
          layer.bounds.west,
          layer.bounds.north,
        ]) as number[] | undefined;
        const southEast = chart.convertToPixel({ geoIndex: 0 }, [
          layer.bounds.east,
          layer.bounds.south,
        ]) as number[] | undefined;

        if (!northWest || !southEast) {
          hideGeoArtLayer(layer.id);
          return;
        }

        const left = Math.min(northWest[0], southEast[0]);
        const top = Math.min(northWest[1], southEast[1]);
        const width = Math.abs(southEast[0] - northWest[0]);
        const height = Math.abs(southEast[1] - northWest[1]);

        if (!Number.isFinite(left + top + width + height) || width < 12 || height < 12) {
          hideGeoArtLayer(layer.id);
          return;
        }

        const roundedLeft = Math.round(left * 10) / 10;
        const roundedTop = Math.round(top * 10) / 10;
        const roundedWidth = Math.round(width * 10) / 10;
        const roundedHeight = Math.round(height * 10) / 10;

        element.style.transform = `translate3d(${roundedLeft}px, ${roundedTop}px, 0)`;
        element.style.width = `${roundedWidth}px`;
        element.style.height = `${roundedHeight}px`;
        element.style.opacity = String(layer.opacity);
      });
    } catch {
      GEO_ART_LAYERS.forEach((layer) => hideGeoArtLayer(layer.id));
    }
  }, [drill.level, hideGeoArtLayer]);

  const scheduleGeoArtUpdate = useCallback(() => {
    if (geoArtFrameRef.current !== null) return;
    geoArtFrameRef.current = requestAnimationFrame(() => {
      geoArtFrameRef.current = null;
      updateGeoArtNow();
    });
  }, [updateGeoArtNow]);

  useEffect(() => {
    scheduleGeoArtUpdate();
    const timeout = window.setTimeout(scheduleGeoArtUpdate, 120);
    return () => {
      window.clearTimeout(timeout);
      if (geoArtFrameRef.current !== null) {
        cancelAnimationFrame(geoArtFrameRef.current);
        geoArtFrameRef.current = null;
      }
    };
  }, [option, scheduleGeoArtUpdate]);

  const handleEvents = {
    finished: () => {
      scheduleGeoArtUpdate();
    },
    georoam: () => {
      scheduleGeoArtUpdate();
    },
    click: (params: unknown) => {
      const item = params as TooltipParam;

      // 点击学校散点
      if (item.seriesType === "scatter" && item.name) {
        const school = schools.find((s) => s.name === item.name);
        if (school) {
          clickTimer.current = setTimeout(() => {
            onSchoolPreview(school);
          }, 280);
        }
        return;
      }

      // 点击地图区域 → 下钻
      if (item.seriesType === "map" && item.name) {
        if (drill.level === "country") {
          // 全国视图：点击省份 → 下钻到省级
          const province = shortProvinceName(item.name);
          if (province) {
            const adcode = getProvinceAdcode(province);
            if (adcode) {
              drillDown(mapProvinceName(province), adcode);
            }
          }
        } else if (drill.level === "province") {
          // 省级视图：点击城市 → 下钻到市级（暂未实现区县级数据）
          // 可以在这里扩展为加载城市的区县 GeoJSON
          const cityAdcode = item.data?.adcode;
          if (cityAdcode) {
            drillDown(item.name!, cityAdcode);
          }
        }
        return;
      }

      // 点击空白区域关闭悬浮窗
      onSchoolPreview(null);
    },
    dblclick: (params: unknown) => {
      const item = params as TooltipParam;
      if (item.seriesType === "scatter" && item.name) {
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
        }
        const school = schools.find((s) => s.name === item.name);
        if (school) router.push(`/school/${encodeURIComponent(school.name)}`);
      }
    },
  };

  const handleChartReady = useCallback(() => {
    scheduleGeoArtUpdate();
    window.setTimeout(scheduleGeoArtUpdate, 80);
  }, [scheduleGeoArtUpdate]);

  const handleClosePopup = useCallback(() => {
    onSchoolPreview(null);
  }, [onSchoolPreview]);

  if (!mapReady) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-text-secondary">
        {EMPTY_MESSAGES.loadingMap}
      </div>
    );
  }

  return (
    <div
      className="china-map-stage relative h-full w-full overflow-hidden"
      role="figure"
      aria-label={EMPTY_MESSAGES.map}
      style={stageStyle}
    >
      {GEO_ART_LAYERS.map((layer) => (
        <div
          key={layer.id}
          aria-hidden="true"
          className={layer.className}
          ref={(element) => {
            geoArtRefs.current[layer.id] = element;
          }}
        />
      ))}
      <div aria-hidden="true" className="china-map-veil" />
      {/* 面包屑导航 + 返回按钮 */}
      {drill.level !== "country" && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">
          <button
            onClick={resetToCountry}
            className="flex items-center gap-1 rounded-md border border-border bg-neutral-0/75 px-2.5 py-1 text-xs font-medium text-text shadow-sm backdrop-blur-sm transition-all hover:border-primary/45 hover:bg-brand-50"
            title="返回全国"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            全国
          </button>

          <svg className="h-3 w-3 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>

          {drill.breadcrumbs.slice(1).map((crumb, i) => (
            <span key={crumb.adcode} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg className="h-3 w-3 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              <span className="rounded-md border border-border bg-neutral-0/72 px-2.5 py-1 text-xs font-semibold text-text shadow-sm backdrop-blur-sm">
                {crumb.name}
              </span>
            </span>
          ))}

          {loadingDrill && (
            <span className="ml-1 text-[11px] text-text-muted animate-pulse">加载中...</span>
          )}
        </div>
      )}

      {/* 当前区域学校数量提示 */}
      {drill.level !== "country" && (
        <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-2 text-xs text-text-muted">
          <span className="rounded-md border border-border bg-neutral-0/70 px-3 py-1 backdrop-blur-sm">
            {visibleSchools.length} 所高校
          </span>
        </div>
      )}

      <div className="china-map-chart h-full w-full">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: "100%", width: "100%" }}
          onChartReady={handleChartReady}
          onEvents={handleEvents}
          lazyUpdate
        />
      </div>
      <AnimatePresence>
        {previewSchool && (
          <SchoolPopup
            key={previewSchool.name}
            school={previewSchool}
            onClose={handleClosePopup}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
