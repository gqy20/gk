"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { colors } from "@/lib/theme";
import type { School, ProvinceData } from "@/lib/data";

interface ChinaMapProps {
  schools: School[];
  provinces: ProvinceData[];
  selectedProvince: string | null;
  onProvinceSelect: (province: string | null) => void;
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

type TooltipParam = {
  name?: string;
  seriesType?: string;
  data?: {
    name?: string;
    province?: string;
    value?: unknown[];
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
  onProvinceSelect,
  onSchoolClick,
}: ChinaMapProps) {
  const chartRef = useRef<ReactECharts>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function registerMap() {
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

    registerMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const getOption = (): echarts.EChartsOption => {
    const scatterData = schools.map((school) => ({
      name: school.name,
      province: school.province,
      value: [...school.coord, school.province],
      symbolSize: school.status === "done" ? 9 : 6,
      itemStyle: {
        color:
          school.status === "done"
            ? selectedProvince && school.province !== selectedProvince
              ? "rgba(216, 183, 93, 0.22)"
              : colors.primaryLight
            : selectedProvince && school.province !== selectedProvince
              ? "rgba(127, 136, 128, 0.18)"
              : "#8b948a",
        shadowBlur: school.status === "done" ? 10 : 0,
        shadowColor: "rgba(242, 196, 95, 0.45)",
      },
    }));

    const mapData = provinces.map((province) => ({
      name: mapProvinceName(province.name),
      province: province.name,
      value: province.count,
      selected: selectedProvince === province.name,
    }));

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      animationDurationUpdate: 520,
      animationEasingUpdate: "cubicOut",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(16, 18, 15, 0.94)",
        borderColor: colors.primaryBorder,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: colors.text,
          fontSize: 12,
        },
        extraCssText:
          "box-shadow:0 18px 45px rgba(0,0,0,.32);border-radius:8px;",
        formatter: (params: unknown) => {
          const item = tooltipParam(params);
          if (item.seriesType === "effectScatter") {
            const data = item.data;
            const name = data?.name || item.name || "";
            const province = data?.province || String(data?.value?.[2] || "");
            return `<b>${escapeHtml(name)}</b><br/>${escapeHtml(province)}`;
          }

          const province = shortProvinceName(item.name);
          const count = provinces.find((p) => p.name === province)?.count ?? 0;
          return `<b>${escapeHtml(item.name || "")}</b><br/>高校: ${count} 所`;
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(...provinces.map((p) => p.count), 1),
        left: 16,
        bottom: 18,
        text: ["多", "少"],
        calculable: false,
        itemWidth: 12,
        itemHeight: 90,
        textStyle: {
          color: colors.textSecondary,
          fontSize: 11,
        },
        inRange: {
          color: ["#202821", "#345246", "#5f8265", "#bca356", "#f1d37b"],
        },
        outOfRange: {
          color: ["#202821"],
        },
      },
      geo: {
        map: "china",
        roam: true,
        zoom: 1.16,
        center: [104, 35.8],
        label: {
          show: false,
        },
        itemStyle: {
          areaColor: "#202821",
          borderColor: "rgba(255, 249, 236, 0.18)",
          borderWidth: 0.8,
        },
        emphasis: {
          itemStyle: {
            areaColor: colors.accentGreen,
            borderColor: colors.primary,
            borderWidth: 1.2,
          },
          label: {
            show: true,
            color: colors.text,
            fontSize: 12,
            fontWeight: 600,
          },
        },
        select: {
          itemStyle: {
            areaColor: colors.primary,
            borderColor: colors.text,
          },
          label: {
            show: true,
            color: colors.surface,
            fontWeight: 700,
          },
        },
      },
      series: [
        {
          name: "高校数量",
          type: "map",
          map: "china",
          geoIndex: 0,
          selectedMode: "single",
          data: mapData,
          itemStyle: {
            borderColor: "rgba(255, 249, 236, 0.16)",
            borderWidth: 0.7,
          },
          emphasis: {
            itemStyle: {
              areaColor: colors.accentGreen,
            },
          },
        },
        {
          name: "高校分布",
          type: "effectScatter",
          coordinateSystem: "geo",
          data: scatterData,
          showEffectOn: "render",
          rippleEffect: {
            brushType: "stroke",
            scale: 2.8,
            period: 4.2,
          },
          label: {
            show: false,
          },
          emphasis: {
            scale: true,
            itemStyle: {
              color: "#fff1b8",
              borderColor: colors.surface,
              borderWidth: 1,
              shadowBlur: 18,
              shadowColor: "rgba(242, 196, 95, 0.72)",
            },
          },
          zlevel: 2,
        },
      ],
    };
  };

  const option = useMemo(
    () => getOption(),
    [schools, provinces, selectedProvince],
  );

  const handleEvents = {
    click: (params: unknown) => {
      const item = params as TooltipParam;

      if (item.seriesType === "effectScatter" && item.name) {
        const school = schools.find((s) => s.name === item.name);
        if (school) onSchoolClick(school);
        return;
      }

      const province = shortProvinceName(item.name);
      if (province) onProvinceSelect(province);
    },
  };

  if (!mapReady) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-dark-200">
        地图加载中
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: "100%", width: "100%" }}
        onEvents={handleEvents}
        lazyUpdate
      />
    </div>
  );
}
