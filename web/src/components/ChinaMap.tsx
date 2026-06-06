"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { colors } from "@/lib/theme";
import { EMPTY_MESSAGES } from "@/lib/constants";
import type { School, ProvinceData } from "@/lib/data";
import {
  PROVINCE_ADCODES,
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

const BIG_SCREEN_COLORS = {
  mapBase: "#17313d",
  mapBaseDeep: "#0e222d",
  mapEdge: "rgba(139, 213, 231, 0.55)",
  mapEdgeStrong: "rgba(191, 232, 241, 0.9)",
  mapGlow: "rgba(88, 189, 217, 0.34)",
  shadowDeep: "rgba(0, 15, 23, 0.78)",
  shadowMid: "rgba(6, 35, 45, 0.62)",
  textOnMap: "#d9f5fb",
  textMutedOnMap: "rgba(217, 245, 251, 0.68)",
} as const;

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

export default function ChinaMap({
  schools,
  provinces,
  selectedProvince,
  previewSchool,
  onProvinceSelect,
  onSchoolPreview,
  onSchoolClick,
}: ChinaMapProps) {
  const chartRef = useRef<ReactECharts>(null);
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

  /** 返回上一级 */
  const drillUp = useCallback(() => {
    if (drill.breadcrumbs.length <= 1) return;

    const newBreadcrumbs = drill.breadcrumbs.slice(0, -1);
    const prev = newBreadcrumbs[newBreadcrumbs.length - 1];

    setDrill({
      level: prev.level,
      mapName: prev.level === "country" ? "china" : `${prev.level}_${prev.adcode}`,
      adcode: prev.adcode,
      breadcrumbs: newBreadcrumbs,
    });

    // 如果返回到全国视图，清除省份选择
    if (prev.level === "country") {
      onProvinceSelect(null);
    }
  }, [drill.breadcrumbs, onProvinceSelect]);

  /** 返回全国 */
  const resetToCountry = useCallback(() => {
    setDrill(INITIAL_DRILL_STATE);
    onProvinceSelect(null);
  }, [onProvinceSelect]);

  useEffect(() => {
    let cancelled = false;

    async function registerChina() {
      try {
        const chinaJson = await fetch("/china.json").then((r) => r.json());
        if (!cancelled) {
          echarts.registerMap("china", chinaJson as never);
          setMapReady(true);
        }
      } catch {
        if (!cancelled) setMapReady(false);
      }
    }

    registerChina();
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
    if (school.is985) return "rgba(214, 106, 93, 0.34)";
    if (school.is211) return "rgba(185, 133, 45, 0.32)";
    if (school.isDoubleFirstClass) return "rgba(47, 143, 107, 0.3)";
    return "rgba(126, 211, 233, 0.22)";
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
      value: [...school.coord, school.province],
      symbolSize:
        school.is985 ? 12 : school.is211 ? 10 : school.isDoubleFirstClass ? 8 : 6,
      itemStyle: {
        color: schoolColor(school),
        shadowBlur:
          school.is985 || school.is211 || school.isDoubleFirstClass ? 18 : 8,
        shadowColor: schoolShadow(school),
        borderColor: "rgba(255,255,255,0.72)",
        borderWidth: school.is985 || school.is211 ? 1.2 : 0.6,
      },
    }));

    const mapData = regionData.map((r) => ({
      name: r.name,
      value: r.value,
      adcode: r.adcode,
      selected: selectedProvince === r.rawName,
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
              color: BIG_SCREEN_COLORS.textMutedOnMap,
              fontSize: 11,
            },
            inRange: {
              color: [
                "#14313e",
                "#1c4a59",
                "#2a6975",
                "#4a8c95",
                "#8fc9cb",
              ],
            },
            outOfRange: {
              color: ["#14313e"],
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
        backgroundColor: "rgba(8, 18, 26, 0.94)",
        borderColor: "rgba(129, 221, 239, 0.38)",
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: BIG_SCREEN_COLORS.textOnMap,
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

          // 省级/市级视图：显示区域名称
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
          show: drill.level !== "country", // 省级以下显示标签
          color: BIG_SCREEN_COLORS.textMutedOnMap,
          fontSize: 10,
        },
        itemStyle: {
          areaColor: BIG_SCREEN_COLORS.mapBase,
          borderColor: BIG_SCREEN_COLORS.mapEdge,
          borderWidth: drill.level === "country" ? 1.1 : 0.8,
          shadowBlur: 24,
          shadowColor: BIG_SCREEN_COLORS.mapGlow,
        },
        emphasis: {
          itemStyle: {
            areaColor: "#2b7d8d",
            borderColor: BIG_SCREEN_COLORS.mapEdgeStrong,
            borderWidth: 1.8,
            shadowBlur: 30,
            shadowColor: "rgba(128, 225, 242, 0.5)",
          },
          label: {
            show: true,
            color: BIG_SCREEN_COLORS.textOnMap,
            fontSize: drill.level === "country" ? 12 : 11,
            fontWeight: 600,
          },
        },
        select: {
          itemStyle: {
            areaColor: "#62a9af",
            borderColor: "#e4fbff",
            shadowBlur: 34,
            shadowColor: "rgba(169, 236, 247, 0.62)",
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
          name: "地图底座深影",
          type: "map",
          map: currentMapName,
          selectedMode: false,
          silent: true,
          roam: false,
          zoom: geoZoom,
          center: geoCenter,
          data: mapData,
          itemStyle: {
            areaColor: BIG_SCREEN_COLORS.shadowDeep,
            borderColor: "transparent",
            shadowBlur: 28,
            shadowColor: "rgba(0, 0, 0, 0.72)",
            shadowOffsetX: 10,
            shadowOffsetY: 18,
          },
          emphasis: {
            disabled: true,
          },
          zlevel: 0,
          z: 0,
        },
        {
          name: "地图底座侧光",
          type: "map",
          map: currentMapName,
          selectedMode: false,
          silent: true,
          roam: false,
          zoom: geoZoom,
          center: geoCenter,
          data: mapData,
          itemStyle: {
            areaColor: BIG_SCREEN_COLORS.shadowMid,
            borderColor: "rgba(78, 182, 205, 0.18)",
            shadowBlur: 18,
            shadowColor: "rgba(80, 195, 220, 0.25)",
            shadowOffsetX: 5,
            shadowOffsetY: 9,
          },
          emphasis: {
            disabled: true,
          },
          zlevel: 0,
          z: 1,
        },
        {
          name: drill.level === "country" ? "高校数量" : "行政区划",
          type: "map",
          map: currentMapName,
          geoIndex: 0,
          selectedMode: "single",
          data: mapData,
          itemStyle: {
            areaColor: BIG_SCREEN_COLORS.mapBase,
            borderColor: "rgba(174, 231, 241, 0.5)",
            borderWidth: drill.level === "country" ? 0.9 : 0.7,
            shadowBlur: 16,
            shadowColor: "rgba(80, 195, 220, 0.24)",
          },
          emphasis: {
            itemStyle: {
              areaColor: "#2f8da0",
              borderColor: BIG_SCREEN_COLORS.mapEdgeStrong,
              shadowBlur: 28,
              shadowColor: "rgba(128, 225, 242, 0.48)",
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
          z: 8,
        },
      ],
    };
  };

  const option = useMemo(
    () => getOption(),
    [visibleSchools, provinces, selectedProvince, drill],
  );

  const handleEvents = {
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
    <div className="china-map-stage relative h-full w-full overflow-hidden" role="figure" aria-label={EMPTY_MESSAGES.map}>
      {/* 面包屑导航 + 返回按钮 */}
      {drill.level !== "country" && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">
          <button
            onClick={resetToCountry}
            className="flex items-center gap-1 rounded-full border border-cyan-100/25 bg-cyan-50/10 px-2.5 py-1 text-xs font-medium text-cyan-50 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-100/45 hover:bg-cyan-50/15 hover:shadow-xl"
            title="返回全国"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            全国
          </button>

          <svg className="h-3 w-3 text-cyan-100/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>

          {drill.breadcrumbs.slice(1).map((crumb, i) => (
            <span key={crumb.adcode} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg className="h-3 w-3 text-cyan-100/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              <span className="rounded-full border border-cyan-100/30 bg-cyan-50/10 px-2.5 py-1 text-xs font-semibold text-cyan-50 shadow-sm backdrop-blur-sm">
                {crumb.name}
              </span>
            </span>
          ))}

          {loadingDrill && (
            <span className="ml-1 text-[11px] text-cyan-100/60 animate-pulse">加载中...</span>
          )}
        </div>
      )}

      {/* 当前区域学校数量提示 */}
      {drill.level !== "country" && (
        <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-2 text-xs text-cyan-100/70">
          <span className="rounded-full border border-cyan-100/20 bg-cyan-50/10 px-3 py-1 backdrop-blur-sm">
            {visibleSchools.length} 所高校
          </span>
        </div>
      )}

      <div className="china-map-chart h-full w-full">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: "100%", width: "100%" }}
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
