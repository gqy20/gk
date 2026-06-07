"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { School } from "@/lib/data";
import { colors } from "@/lib/theme";
import { EMPTY_MESSAGES } from "@/lib/constants";

interface SchoolMapProps {
  school: School;
  compact?: boolean;
}

interface PoiItem {
  name: string;
  address: string;
  distance: number;
  location: [number, number];
  type: string;
}

const POI_CATEGORIES = [
  { key: "subway", label: "地铁", type: "150500", keyword: "地铁", icon: "🚇", color: colors.brand[300] },
  { key: "hospital", label: "医疗", type: "090100|090200|090300|090400", keyword: "", icon: "🏥", color: colors.accentScale[400] },
  { key: "shopping", label: "商圈", type: "060100|060400|060600", keyword: "", icon: "🛒", color: colors.primary },
  { key: "food", label: "美食", type: "050000", keyword: "", icon: "🍜", color: colors.brand[100] },
] as const;

// AMap 标记 / InfoWindow 共用样式常量（AMap API 需要原始字符串）
const AMAP = {
  schoolMarker: `background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover}); width: 28px; height: 28px; border-radius: 50%; border: 3px solid ${colors.neutral[0]}; box-shadow: 0 8px 18px rgba(17,24,32,0.22); display: flex; align-items: center; justify-content: center; font-size: 14px;`,
  infoWindow: (title: string, subtitle: string) => `
    background:${colors.surfaceElevated};border:1px solid ${colors.primaryBorder};
    padding:10px 14px;border-radius:8px;color:${colors.text};font-size:13px;
    min-width:140px;box-shadow:0 8px 24px rgba(17,24,32,0.14);
    <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:${colors.primaryHover}">${title}</div>
    <div style="color:${colors.textSecondary};font-size:12px">${subtitle}</div>`,
  poiMarker: (color: string, icon: string) =>
    `background:${color};width:22px;height:22px;border-radius:50%;
     border:2px solid ${colors.surface};display:flex;align-items:center;
     justify-content:center;font-size:11px;opacity:0.85;">${icon}</div>`,
  poiInfoWindow: (name: string, address: string, distance: string, color: string) => `
    background:${colors.surfaceElevated};border:1px solid ${color}40;
    padding:10px 14px;border-radius:8px;color:${colors.text};font-size:12px;
    min-width:160px;box-shadow:0 8px 24px rgba(17,24,32,0.14);
    <div style="font-weight:600;margin-bottom:2px;">${name}</div>
    <div style="color:${colors.textMuted};margin-bottom:2px;">${address}</div>
    <div style="color:${color}">${distance}</div>`,
} as const;

type PoiCategoryKey = (typeof POI_CATEGORIES)[number]["key"];

export default function SchoolMap({ school, compact = true }: SchoolMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<AMap.Map | null>(null);
  const [activeCategory, setActiveCategory] = useState<PoiCategoryKey | "all">("all");
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  const [pois, setPois] = useState<Record<string, PoiItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [lng, lat] = school.coord;

  // 初始化地图
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    let cancelled = false;

    async function initMap() {
      try {
        const amapKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY;
        const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
        if (!amapKey) return;

        if (securityCode) {
          (window as unknown as Record<string, unknown>)._AMapSecurityConfig = {
            securityJsCode: securityCode,
          };
        }

        const loader = (await import("@amap/amap-jsapi-loader")).default;
        await loader.load({
          key: amapKey,
          version: "2.0",
          plugins: [],
        });

        if (cancelled) return;

        const mapOptions = {
          zoom: 15,
          center: [lng, lat],
          mapStyle: "amap://styles/normal",
          viewMode: "2D",
        } as AMap.MapOptions;

        const map = new AMap.Map(mapRef.current!, mapOptions);

        // 学校标记
        const marker = new AMap.Marker({
          position: [lng, lat],
          title: school.name,
          content: `<div style="${AMAP.schoolMarker}">🎓</div>`,
          offset: new AMap.Pixel(-14, -14),
        });
        marker.setMap(map);

        // 信息窗体
        const infoWindow = new AMap.InfoWindow({
          isCustom: true,
          offset: new AMap.Pixel(0, -40),
          closeWhenClickMap: true,
        });

        marker.on("click", () => {
          infoWindow.setContent(AMAP.infoWindow(school.name, school.province));
          infoWindow.open(map, marker.getPosition());
        });

        mapInstance.current = map;
        setMapReady(true);
      } catch (e) {
        console.error("地图加载失败:", e);
      }
    }

    initMap();
    return () => {
      cancelled = true;
      mapInstance.current?.destroy();
      mapInstance.current = null;
    };
  }, [school.name, school.province, lng, lat]);

  // 搜索周边POI（使用高德REST API）
  const amapKey = process.env.NEXT_PUBLIC_AMAP_WEB_SERVICE_KEY || "";
  const searchPois = useCallback(
    async (category: typeof POI_CATEGORIES[number]) => {
      if (!amapKey) return [];

      setLoading(true);
      try {
        const url = `https://restapi.amap.com/v3/place/around?key=${amapKey}&location=${lng},${lat}&radius=1200&types=${encodeURIComponent(category.type)}&output=JSON&offset=10`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === "1" && data.pois) {
          let pois = data.pois;
          if (category.keyword) {
            pois = pois.filter((p: Record<string, unknown>) =>
              String(p.name || "").includes(category.keyword),
            );
          }
          return pois.map((p: Record<string, unknown>) => {
            const loc = String(p.location || "").split(",");
            return {
              name: p.name,
              address: p.address,
              distance: p.distance,
              location: [parseFloat(loc[0] || "0"), parseFloat(loc[1] || "0")] as [number, number],
              type: p.type,
            };
          });
        }
        return [];
      } finally {
        setLoading(false);
      }
    },
    [lng, lat, amapKey],
  );

  // 渲染POI标记
  const renderMarkers = useCallback((allPois: Partial<Record<string, PoiItem[]>>) => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // 清除旧标记（保留学校标记）
    map.clearMap();

    // 重新添加学校标记
    const schoolMarker = new AMap.Marker({
      position: [lng, lat],
      content: `<div style="${AMAP.schoolMarker}">🎓</div>`,
      offset: new AMap.Pixel(-14, -14),
      zIndex: 100,
    });
    schoolMarker.setMap(map);

    // 添加POI标记
    const categoriesToShow =
      activeCategory === "all"
        ? POI_CATEGORIES
        : POI_CATEGORIES.filter((c) => c.key === activeCategory);

    for (const cat of categoriesToShow) {
      const items = allPois[cat.key] || [];
      for (const item of items.slice(0, 8)) {
        const marker = new AMap.Marker({
          position: item.location,
          content: `<div style="${AMAP.poiMarker(cat.color, cat.icon)}"`,
          offset: new AMap.Pixel(-11, -11),
          zIndex: 50,
        });

        marker.on("click", () => {
          setSelectedPoi(`${cat.key}:${item.name}`);
          const infoWindow = new AMap.InfoWindow({
            isCustom: true,
            offset: new AMap.Pixel(0, -32),
            closeWhenClickMap: true,
          });
          const distLabel = item.distance < 1000
            ? `${Math.round(item.distance)}m`
            : `${(item.distance / 1000).toFixed(1)}km`;
          infoWindow.setContent(AMAP.poiInfoWindow(item.name, item.address, distLabel, cat.color));
          infoWindow.open(map, marker.getPosition());
        });

        marker.setMap(map);
      }
    }
  }, [activeCategory, lng, lat]);

  // 切换分类时搜索
  useEffect(() => {
    if (!mapReady) return;

    let cancelled = false;

    async function loadPois() {
      if (activeCategory === "all") {
        const results = await Promise.all(
          POI_CATEGORIES.map(async (cat) => {
            try {
              return await searchPois(cat);
            } catch {
              return [];
            }
          }),
        );
        if (cancelled) return;
        const nextPois: Record<string, PoiItem[]> = {};
        POI_CATEGORIES.forEach((cat, i) => {
          nextPois[cat.key] = results[i] ?? [];
        });
        setPois(nextPois);
        renderMarkers(nextPois);
        return;
      }

      const cat = POI_CATEGORIES.find((c) => c.key === activeCategory);
      if (!cat) return;
      const result = await searchPois(cat);
      if (cancelled) return;
      setPois((prev) => {
        const next = { ...prev, [cat.key]: result } as Record<string, PoiItem[]>;
        renderMarkers(next);
        return next;
      });
    }

    loadPois();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, mapReady, renderMarkers, searchPois]);

  const totalPois = Object.values(pois).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="paper-shell flex h-full w-full flex-col gap-2.5 p-2.5">
      {/* 地图容器 */}
      <div
        ref={mapRef}
        className={`relative w-full overflow-hidden rounded-md border border-border-light bg-neutral-100 shadow-sm shadow-neutral-900/6 ${
          compact ? "h-[220px] shrink-0" : "min-h-[360px] flex-[1.75]"
        }`}
      >
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            {EMPTY_MESSAGES.loadingMap}
          </div>
        )}
      </div>

      {/* 分类筛选 + POI列表 */}
      <div className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-border-light bg-neutral-0/38 ${
        compact ? "flex-1" : "h-[30%] max-h-[280px] min-h-[190px] shrink-0"
      }`}>
        {/* 分类按钮 */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border-light bg-neutral-0/55 px-2 py-2">
          <button
            type="button"
            onClick={() => {
              setActiveCategory("all");
              setSelectedPoi(null);
            }}
            className={`h-8 shrink-0 rounded-md px-3 text-xs font-medium transition ${
              activeCategory === "all"
                ? "bg-brand-500 text-text-inverse shadow-sm shadow-brand-900/10"
                : "text-text-light-muted hover:bg-brand-50 hover:text-brand-600"
            }`}
          >
            全部
            {totalPois > 0 && (
              <span className="ml-1 opacity-70">{totalPois}</span>
            )}
          </button>
          {POI_CATEGORIES.map((cat) => {
            const count = pois[cat.key]?.length ?? 0;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.key);
                  setSelectedPoi(null);
                }}
                className={`h-8 shrink-0 rounded-md px-3 text-xs font-medium transition ${
                  activeCategory === cat.key
                    ? "bg-brand-500 text-text-inverse shadow-sm shadow-brand-900/10"
                    : "text-text-light-muted hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
                {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="poi-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {/* 加载状态 */}
          {loading && (
            <p className="py-4 text-center text-xs text-text-muted">{EMPTY_MESSAGES.searchingPoi}</p>
          )}

          {/* POI列表 */}
          {!loading &&
            POI_CATEGORIES.map((cat) => {
              const items = pois[cat.key];
              if (!items?.length) return null;
              if (activeCategory !== "all" && activeCategory !== cat.key) return null;

              return (
                <div key={cat.key} className="space-y-1.5">
                  {activeCategory === "all" && (
                    <div className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-semibold text-text-light-muted">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      <span>({items.length})</span>
                    </div>
                  )}
                  {items.map((item, i) => {
                    const id = `${cat.key}:${item.name}`;
                    const isSelected = selectedPoi === id;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedPoi(id);
                          mapInstance.current?.setCenter(item.location);
                          mapInstance.current?.setZoom(17);
                        }}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-2.5 py-2 text-left text-xs transition ${
                          isSelected
                            ? "border-brand-300 bg-brand-50/55 shadow-sm shadow-brand-900/6"
                            : "border-transparent bg-neutral-0/62 hover:border-brand-200/70 hover:bg-brand-50/35"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-text">
                            {item.name}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-text-muted">
                            {item.address || "暂无地址"}
                          </div>
                        </div>
                        <span
                          className="rounded-sm bg-neutral-0/86 px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                          style={{ color: cat.color }}
                        >
                          {formatDistance(item.distance)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {!loading && !mapReady && (
            <p className="py-8 text-center text-sm text-text-muted">
              {EMPTY_MESSAGES.loadingMap}
            </p>
          )}

          {!loading && totalPois === 0 && mapReady && (
            <p className="py-8 text-center text-sm text-text-muted">
              {EMPTY_MESSAGES.clickPoiCategory}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDistance(distance: number) {
  return distance < 1000
    ? `${Math.round(distance)}m`
    : `${(distance / 1000).toFixed(1)}km`;
}
