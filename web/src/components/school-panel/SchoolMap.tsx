"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { School } from "@/lib/data";

interface SchoolMapProps {
  school: School;
}

interface PoiItem {
  name: string;
  address: string;
  distance: number;
  location: [number, number];
  type: string;
}

const POI_CATEGORIES = [
  { key: "subway", label: "地铁", type: "150100|150200", icon: "🚇", color: "#6fc0a5" },
  { key: "hospital", label: "医疗", type: "090100|090200|090300|090400", icon: "🏥", color: "#f2c45f" },
  { key: "shopping", label: "商圈", type: "060100|060400|060600", icon: "🛒", color: "#d8b75d" },
  { key: "food", label: "美食", type: "050000", icon: "🍜", color: "#b9f1df" },
] as const;

type PoiCategoryKey = (typeof POI_CATEGORIES)[number]["key"];

export default function SchoolMap({ school }: SchoolMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<AMap.Map | null>(null);
  const [activeCategory, setActiveCategory] = useState<PoiCategoryKey | "all">("all");
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
          (window as Record<string, unknown>)._AMapSecurityConfig = {
            securityJsCode: securityCode,
          };
        }

        const loader = (await import("@amap/amap-jsapi-loader")).default;
        await loader.load({
          key: amapKey,
          version: "2.0",
          plugins: ["AMap.PlaceSearch"],
        });

        if (cancelled) return;

        const map = new AMap.Map(mapRef.current!, {
          zoom: 15,
          center: [lng, lat],
          mapStyle: "amap://styles/dark",
          viewMode: "2D",
        });

        // 学校标记
        const marker = new AMap.Marker({
          position: [lng, lat],
          title: school.name,
          content: `<div style="
            background: linear-gradient(135deg, #d8b75d, #f1c15f);
            width: 28px; height: 28px; border-radius: 50%;
            border: 3px solid #10120f;
            box-shadow: 0 0 12px rgba(242,196,95,0.5);
            display: flex; align-items: center; justify-content: center;
            font-size: 14px;
          ">🎓</div>`,
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
          infoWindow.setContent(`
            <div style="
              background:#171c18;border:1px solid rgba(216,183,93,0.4);
              padding:10px 14px;border-radius:8px;color:#fff9ec;font-size:13px;
              min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,0.4);
            ">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#f1c15f">${school.name}</div>
              <div style="color:#bdb5a4;font-size:12px">${school.province}</div>
            </div>
          `);
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

  // 搜索周边POI
  const searchPois = useCallback(
    async (category: typeof POI_CATEGORIES[number]) => {
      if (!mapInstance.current || !window.AMap) return;

      setLoading(true);
      try {
        const placeSearch = new window.AMap.PlaceSearch({
          type: category.type,
          pageSize: 10,
          pageIndex: 1,
          map: undefined, // 不自动标注，我们自己处理
        });

        return new Promise<PoiItem[]>((resolve) => {
          placeSearch.searchNearBy("", [lng, lat], 1200, (
            status: string,
            result: { poiList?: { pois: Array<{ name: string; address: string; distance: number; location: { lng: number; lat: number }; type: string }> } },
          ) => {
            if (status === "complete" && result.poiList?.pois) {
              resolve(
                result.poiList.pois.map((p) => ({
                  name: p.name,
                  address: p.address,
                  distance: p.distance,
                  location: [p.location.lng, p.location.lat],
                  type: p.type,
                })),
              );
            } else {
              resolve([]);
            }
          });
        });
      } finally {
        setLoading(false);
      }
    },
    [lng, lat],
  );

  // 切换分类时搜索
  useEffect(() => {
    if (!mapReady) return;

    if (activeCategory === "all") {
      // 全部加载
      Promise.all(
        POI_CATEGORIES.map(async (cat) => {
          const existing = pois[cat.key];
          if (existing && existing.length > 0) return existing;
          return searchPois(cat);
        }),
      ).then((results) => {
        const nextPois: Record<string, PoiItem[]> = {};
        POI_CATEGORIES.forEach((cat, i) => {
          nextPois[cat.key] = results[i] ?? [];
        });
        setPois(nextPois);
        renderMarkers(nextPois);
      });
    } else {
      const cat = POI_CATEGORIES.find((c) => c.key === activeCategory)!;
      searchPois(cat).then((result) => {
        setPois((prev) => ({ ...prev, [cat.key]: result }) as Record<string, PoiItem[]>);
        renderMarkers({ ...pois, [cat.key]: result } as Partial<Record<string, PoiItem[]>>);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, mapReady]);

  // 渲染POI标记
  function renderMarkers(allPois: Partial<Record<string, PoiItem[]>>) {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // 清除旧标记（保留学校标记）
    map.clearMap();

    // 重新添加学校标记
    const schoolMarker = new AMap.Marker({
      position: [lng, lat],
      content: `<div style="
        background: linear-gradient(135deg, #d8b75d, #f1c15f);
        width: 28px; height: 28px; border-radius: 50%;
        border: 3px solid #10120f;
        box-shadow: 0 0 12px rgba(242,196,95,0.5);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
      ">🎓</div>`,
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
          content: `<div style="
            background:${cat.color};width:22px;height:22px;border-radius:50%;
            border:2px solid #10120f;display:flex;align-items:center;
            justify-content:center;font-size:11px;opacity:0.85;
          ">${cat.icon}</div>`,
          offset: new AMap.Pixel(-11, -11),
          zIndex: 50,
        });

        marker.on("click", () => {
          const infoWindow = new AMap.InfoWindow({
            isCustom: true,
            offset: new AMap.Pixel(0, -32),
            closeWhenClickMap: true,
          });
          infoWindow.setContent(`
            <div style="
              background:#171c18;border:1px solid ${cat.color}40;
              padding:10px 14px;border-radius:8px;color:#fff9ec;font-size:12px;
              min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.4);
            ">
              <div style="font-weight:600;margin-bottom:2px;">${item.name}</div>
              <div style="color:#81786a;margin-bottom:2px;">${item.address}</div>
              <div style="color:${cat.color}">${item.distance < 1000 ? Math.round(item.distance) + 'm' : (item.distance / 1000).toFixed(1) + 'km'}</div>
            </div>
          `);
          infoWindow.open(map, marker.getPosition());
        });

        marker.setMap(map);
      }
    }
  }

  const totalPois = Object.values(pois).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="flex h-full flex-col">
      {/* 地图容器 */}
      <div ref={mapRef} className="relative h-[280px] w-full shrink-0 overflow-hidden rounded-lg border border-border-light bg-ink-800">
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-dark-500">
            地图加载中...
          </div>
        )}
      </div>

      {/* 分类筛选 + POI列表 */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {/* 分类按钮 */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activeCategory === "all"
                ? "bg-green-500 text-text"
                : "bg-base-50 text-dark-900 hover:bg-ink-600 hover:text-green-400"
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
                onClick={() => setActiveCategory(cat.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeCategory === cat.key
                    ? "bg-green-500 text-text"
                    : "bg-base-50 text-dark-900 hover:bg-ink-600 hover:text-green-400"
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
                {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* 加载状态 */}
        {loading && (
          <p className="py-4 text-center text-xs text-dark-500">搜索中...</p>
        )}

        {/* POI列表 */}
        {!loading &&
          POI_CATEGORIES.map((cat) => {
            const items = pois[cat.key];
            if (!items?.length) return null;
            if (activeCategory !== "all" && activeCategory !== cat.key) return null;

            return (
              <div key={cat.key} className="mb-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <span>{cat.icon}</span>
                  <span style={{ color: cat.color }}>{cat.label}</span>
                  <span className="text-dark-500">({items.length})</span>
                </div>
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        mapInstance.current?.setCenter(item.location);
                        mapInstance.current?.setZoom(17);
                      }}
                      className="flex w-full items-center justify-between rounded-md bg-base-50 px-3 py-2 text-left text-xs transition hover:bg-ink-600"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-dark-100">
                          {item.name}
                        </div>
                        <div className="truncate text-dark-500">
                          {item.address}
                        </div>
                      </div>
                      <span
                        className="shrink-0 ml-2 text-[11px]"
                        style={{ color: cat.color }}
                      >
                        {item.distance < 1000
                          ? `${Math.round(item.distance)}m`
                          : `${(item.distance / 1000).toFixed(1)}km`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

        {!loading && totalPois === 0 && mapReady && (
          <p className="py-8 text-center text-sm text-dark-500">
            点击上方分类查看周边信息
          </p>
        )}
      </div>
    </div>
  );
}
