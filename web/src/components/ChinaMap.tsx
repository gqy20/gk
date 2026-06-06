"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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

type Position = [number, number];

type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

type GeoJsonFeature = {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

type Bounds = [number, number, number, number];

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
  Object.entries(MAP_PROVINCE_NAMES).map(([shortName, mapName]) => [mapName, shortName]),
);

const CHINA_VIEW_BOUNDS: Bounds = [73, 17, 135.5, 54.5];
const SEA_TEXTURE_COORDINATES: [Position, Position, Position, Position] = [
  [112, 58],
  [148, 58],
  [148, 4],
  [112, 4],
];

const PROVINCE_WATERCOLOR_COLORS = [
  "rgba(204, 226, 221, 0.78)",
  "rgba(216, 229, 199, 0.78)",
  "rgba(225, 211, 175, 0.76)",
  "rgba(202, 222, 238, 0.78)",
  "rgba(220, 202, 232, 0.68)",
  "rgba(232, 190, 198, 0.64)",
  "rgba(184, 218, 196, 0.76)",
  "rgba(221, 228, 211, 0.78)",
] as const;

type MapTheme = {
  name: string;
  land: string;
  landDeep: string;
  border: string;
  borderStrong: string;
  glow: string;
  glowStrong: string;
  shadowDeep: string;
  text: string;
  textMuted: string;
  paper: string;
  paperEdge: string;
};

const BASE_THEME: MapTheme = {
  name: "default",
  land: "rgba(221, 233, 223, 0.76)",
  landDeep: "rgba(189, 219, 212, 0.68)",
  border: "rgba(126, 137, 128, 0.56)",
  borderStrong: "rgba(80, 98, 92, 0.78)",
  glow: "rgba(117, 179, 179, 0.22)",
  glowStrong: "rgba(242, 223, 174, 0.78)",
  shadowDeep: "rgba(112, 93, 67, 0.18)",
  text: "#fdf9ee",
  textMuted: "rgba(74, 82, 76, 0.68)",
  paper: "rgba(255, 250, 240, 0.48)",
  paperEdge: "rgba(84, 76, 61, 0.10)",
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
      land: "rgba(205, 226, 186, 0.78)",
      landDeep: "rgba(151, 196, 158, 0.62)",
      border: "rgba(104, 136, 122, 0.52)",
      borderStrong: "rgba(68, 103, 90, 0.78)",
      glow: "rgba(103, 180, 158, 0.22)",
      glowStrong: "rgba(196, 222, 166, 0.82)",
      shadowDeep: "rgba(1, 15, 20, 0.20)",
      text: "#fffaf0",
      textMuted: "rgba(68, 84, 78, 0.68)",
      paper: "rgba(243, 250, 238, 0.05)",
      paperEdge: "rgba(236, 248, 234, 0.08)",
    },
  },
  {
    name: "central",
    provinces: ["北京", "天津", "河北", "山西", "河南", "山东", "安徽", "陕西"],
    theme: {
      land: "rgba(232, 212, 163, 0.78)",
      landDeep: "rgba(216, 184, 111, 0.58)",
      border: "rgba(141, 126, 96, 0.5)",
      borderStrong: "rgba(105, 88, 60, 0.76)",
      glow: "rgba(188, 160, 92, 0.22)",
      glowStrong: "rgba(241, 216, 145, 0.86)",
      shadowDeep: "rgba(10, 13, 18, 0.18)",
      text: "#fffaf0",
      textMuted: "rgba(85, 76, 61, 0.68)",
      paper: "rgba(255, 248, 232, 0.046)",
      paperEdge: "rgba(255, 250, 240, 0.08)",
    },
  },
  {
    name: "southwest",
    provinces: ["四川", "重庆", "贵州", "云南", "湖北", "湖南"],
    theme: {
      land: "rgba(174, 214, 169, 0.76)",
      landDeep: "rgba(118, 174, 137, 0.58)",
      border: "rgba(93, 127, 105, 0.52)",
      borderStrong: "rgba(62, 101, 78, 0.78)",
      glow: "rgba(90, 147, 116, 0.22)",
      glowStrong: "rgba(178, 219, 181, 0.82)",
      shadowDeep: "rgba(2, 16, 17, 0.18)",
      text: "#fffaf0",
      textMuted: "rgba(65, 86, 70, 0.68)",
      paper: "rgba(242, 249, 239, 0.05)",
      paperEdge: "rgba(237, 248, 232, 0.08)",
    },
  },
  {
    name: "northwest",
    provinces: ["甘肃", "青海", "宁夏", "新疆", "西藏", "内蒙古"],
    theme: {
      land: "rgba(195, 218, 235, 0.72)",
      landDeep: "rgba(143, 184, 213, 0.56)",
      border: "rgba(102, 125, 137, 0.52)",
      borderStrong: "rgba(70, 95, 108, 0.76)",
      glow: "rgba(126, 163, 188, 0.22)",
      glowStrong: "rgba(190, 214, 234, 0.84)",
      shadowDeep: "rgba(7, 15, 20, 0.18)",
      text: "#fffaf0",
      textMuted: "rgba(68, 87, 98, 0.68)",
      paper: "rgba(255, 249, 239, 0.044)",
      paperEdge: "rgba(255, 252, 245, 0.08)",
    },
  },
  {
    name: "northeast",
    provinces: ["辽宁", "吉林", "黑龙江"],
    theme: {
      land: "rgba(202, 222, 234, 0.76)",
      landDeep: "rgba(151, 190, 209, 0.58)",
      border: "rgba(99, 124, 137, 0.52)",
      borderStrong: "rgba(66, 91, 105, 0.78)",
      glow: "rgba(111, 159, 172, 0.22)",
      glowStrong: "rgba(199, 226, 236, 0.84)",
      shadowDeep: "rgba(4, 15, 21, 0.18)",
      text: "#fffaf0",
      textMuted: "rgba(68, 86, 96, 0.68)",
      paper: "rgba(241, 248, 250, 0.045)",
      paperEdge: "rgba(237, 247, 249, 0.08)",
    },
  },
];

function resolveTheme(province?: string | null): MapTheme {
  if (!province) return BASE_THEME;
  const group = PROVINCE_THEME_GROUPS.find((item) => item.provinces.includes(province));
  if (!group) return BASE_THEME;
  return { name: group.name, ...group.theme };
}

function mapProvinceName(province: string): string {
  return MAP_PROVINCE_NAMES[province] || province;
}

function shortProvinceName(name?: string): string | null {
  if (!name) return null;
  return SHORT_PROVINCE_NAMES.get(name) || name;
}

function provinceWatercolor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % PROVINCE_WATERCOLOR_COLORS.length;
  }
  return PROVINCE_WATERCOLOR_COLORS[hash];
}

function walkCoordinates(value: unknown, callback: (position: Position) => void) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    callback([value[0], value[1]]);
    return;
  }
  value.forEach((item) => walkCoordinates(item, callback));
}

function boundsFromGeoJson(data: GeoJsonFeatureCollection): Bounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  data.features.forEach((feature) => {
    walkCoordinates(feature.geometry?.coordinates, ([lng, lat]) => {
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    });
  });

  if (!Number.isFinite(west + south + east + north)) return CHINA_VIEW_BOUNDS;
  return [west, south, east, north];
}

function centroidFromFeature(feature: GeoJsonFeature): Position | null {
  const center = feature.properties.center;
  const centroid = feature.properties.centroid;
  if (Array.isArray(centroid) && typeof centroid[0] === "number" && typeof centroid[1] === "number") {
    return [centroid[0], centroid[1]];
  }
  if (Array.isArray(center) && typeof center[0] === "number" && typeof center[1] === "number") {
    return [center[0], center[1]];
  }
  return null;
}

function fitBounds(map: maplibregl.Map, bounds: Bounds, level: MapLevel) {
  if (!map.loaded()) return;
  const nextBounds: LngLatBoundsLike = [
    [bounds[0], bounds[1]],
    [bounds[2], bounds[3]],
  ];
  map.fitBounds(nextBounds, {
    padding: level === "country" ? 34 : 58,
    duration: 360,
    maxZoom: level === "country" ? 4.15 : 7.2,
  });
}

function normalizeMapData(
  data: GeoJsonFeatureCollection,
  provinces: ProvinceData[],
  selectedProvince: string | null,
) {
  const countByProvince = new Map(provinces.map((province) => [province.name, province.count]));

  const features = data.features.map((feature) => {
    const mapName = String(feature.properties.name || "");
    const shortName = shortProvinceName(mapName) || mapName;
    return {
      ...feature,
      id: String(feature.properties.adcode || mapName),
      properties: {
        ...feature.properties,
        shortName,
        count: countByProvince.get(shortName) ?? 0,
        fillColor: provinceWatercolor(shortName),
        selected: selectedProvince === shortName,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  } as GeoJsonFeatureCollection;
}

function makeLabelData(data: GeoJsonFeatureCollection) {
  return {
    type: "FeatureCollection",
    features: data.features
      .map((feature) => {
        const point = centroidFromFeature(feature);
        if (!point) return null;
        return {
          type: "Feature" as const,
          properties: {
            name: feature.properties.shortName || feature.properties.name,
          },
          geometry: {
            type: "Point",
            coordinates: point,
          },
        };
      })
      .filter(Boolean),
  } as GeoJsonFeatureCollection;
}

function schoolTier(school: School) {
  if (school.is985) return "985";
  if (school.is211) return "211";
  if (school.isDoubleFirstClass) return "doubleFirst";
  return "normal";
}

function schoolColor(school: School, selectedProvince: string | null): string {
  if (selectedProvince && school.province !== selectedProvince) return colors.chart.schoolMuted;
  if (school.is985) return colors.chart.school985;
  if (school.is211) return colors.chart.school211;
  if (school.isDoubleFirstClass) return colors.chart.schoolDoubleFirst;
  return colors.chart.schoolNormal;
}

function makeSchoolData(schools: School[], selectedProvince: string | null) {
  return {
    type: "FeatureCollection",
    features: schools.map((school) => ({
      type: "Feature" as const,
      id: school.name,
      properties: {
        name: school.name,
        province: school.province,
        tier: schoolTier(school),
        color: schoolColor(school, selectedProvince),
        opacity: selectedProvince && school.province !== selectedProvince ? 0.38 : 0.94,
      },
      geometry: {
        type: "Point",
        coordinates: school.coord,
      },
    })),
  } as GeoJsonFeatureCollection;
}

function featureName(feature?: MapGeoJSONFeature): string | null {
  const name = feature?.properties?.name;
  return typeof name === "string" ? name : null;
}

function featureAdcode(feature?: MapGeoJSONFeature): string | null {
  const adcode = feature?.properties?.adcode;
  if (typeof adcode === "number") return String(adcode);
  if (typeof adcode === "string") return adcode;
  return null;
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoveredRegionIdRef = useRef<string | number | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [mapData, setMapData] = useState<GeoJsonFeatureCollection | null>(null);
  const [drill, setDrill] = useState<DrillState>(INITIAL_DRILL_STATE);

  const currentProvince =
    drill.level === "country"
      ? selectedProvince
      : MAP_NAME_TO_PROVINCE[drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name] ||
        selectedProvince;
  const mapTheme = useMemo(() => resolveTheme(currentProvince), [currentProvince]);
  const stageStyle = useMemo(
    () =>
      ({
        "--china-map-land": mapTheme.land,
        "--china-map-land-deep": mapTheme.landDeep,
        "--china-map-border": mapTheme.border,
        "--china-map-border-strong": mapTheme.borderStrong,
        "--china-map-glow": mapTheme.glow,
        "--china-map-glow-strong": mapTheme.glowStrong,
        "--china-map-shadow-deep": mapTheme.shadowDeep,
        "--china-map-text": mapTheme.text,
        "--china-map-text-muted": mapTheme.textMuted,
        "--china-map-paper": mapTheme.paper,
        "--china-map-paper-edge": mapTheme.paperEdge,
      }) as CSSProperties,
    [mapTheme],
  );

  const visibleSchools = useMemo(() => {
    if (drill.level === "country") return schools;
    if (!currentProvince) return schools;
    return schools.filter((school) => school.province === currentProvince);
  }, [schools, drill.level, currentProvince]);

  const normalizedMapData = useMemo(() => {
    if (!mapData) return null;
    return normalizeMapData(mapData, provinces, selectedProvince);
  }, [mapData, provinces, selectedProvince]);

  const labelData = useMemo(() => {
    if (!normalizedMapData) return null;
    return makeLabelData(normalizedMapData);
  }, [normalizedMapData]);

  const schoolData = useMemo(
    () => makeSchoolData(visibleSchools, selectedProvince),
    [visibleSchools, selectedProvince],
  );

  const loadMapData = useCallback(async (adcode: string) => {
    const url = adcode === "100000" ? "/china.json" : `/maps/${adcode}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load map data: ${url}`);
    return (await response.json()) as GeoJsonFeatureCollection;
  }, []);

  const resetHover = useCallback(() => {
    const map = mapRef.current;
    if (!map?.loaded() || !map.getSource("regions") || hoveredRegionIdRef.current === null) return;
    map.setFeatureState(
      { source: "regions", id: hoveredRegionIdRef.current },
      { hover: false },
    );
    hoveredRegionIdRef.current = null;
  }, []);

  const setRegionSourceData = useCallback((data: GeoJsonFeatureCollection, labels: GeoJsonFeatureCollection) => {
    const map = mapRef.current;
    if (!map?.loaded() || !map.getSource("regions") || !map.getSource("region-labels")) return;
    (map.getSource("regions") as GeoJSONSource | undefined)?.setData(data);
    (map.getSource("region-labels") as GeoJSONSource | undefined)?.setData(labels);
  }, []);

  const setSchoolSourceData = useCallback((data: GeoJsonFeatureCollection) => {
    const map = mapRef.current;
    if (!map?.loaded() || !map.getSource("schools")) return;
    (map.getSource("schools") as GeoJSONSource | undefined)?.setData(data);
  }, []);

  const installMapLayers = useCallback(
    (map: maplibregl.Map, initialRegions: GeoJsonFeatureCollection, initialLabels: GeoJsonFeatureCollection) => {
      map.addSource("sea-watercolor", {
        type: "image",
        url: "/textures/sea-wash.webp",
        coordinates: SEA_TEXTURE_COORDINATES,
      });
      map.addSource("regions", {
        type: "geojson",
        data: initialRegions,
        generateId: false,
      });
      map.addSource("region-labels", {
        type: "geojson",
        data: initialLabels,
      });
      map.addSource("schools", {
        type: "geojson",
        data: schoolData,
      });

      map.addLayer({
        id: "paper-background",
        type: "background",
        paint: {
          "background-color": "rgba(246, 239, 226, 0)",
        },
      });
      map.addLayer({
        id: "sea-watercolor",
        type: "raster",
        source: "sea-watercolor",
        paint: {
          "raster-opacity": 0.82,
          "raster-fade-duration": 0,
        },
      });
      map.addLayer({
        id: "region-fill",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "rgba(242, 223, 174, 0.86)",
            ["boolean", ["get", "selected"], false],
            "rgba(242, 223, 174, 0.78)",
            ["coalesce", ["get", "fillColor"], "rgba(221, 233, 223, 0.76)"],
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.9,
            ["boolean", ["get", "selected"], false],
            0.88,
            0.8,
          ],
        },
      });
      map.addLayer({
        id: "region-ink-edge",
        type: "line",
        source: "regions",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "rgba(80, 98, 92, 0.86)",
            "rgba(92, 104, 97, 0.56)",
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 4, 1, 6, 1.5],
          "line-blur": 0.45,
          "line-opacity": 0.78,
        },
      });
      map.addLayer({
        id: "region-labels",
        type: "symbol",
        source: "region-labels",
        minzoom: 2.45,
        layout: {
          "text-field": ["to-string", ["get", "name"]],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2.5, 11, 4.2, 13, 6, 15],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "rgba(74, 82, 76, 0.70)",
          "text-halo-color": "rgba(255, 250, 240, 0.78)",
          "text-halo-width": 1.2,
          "text-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "school-points",
        type: "circle",
        source: "schools",
        paint: {
          "circle-radius": [
            "match",
            ["get", "tier"],
            "985",
            8.5,
            "211",
            7,
            "doubleFirst",
            6,
            4.7,
          ],
          "circle-color": ["coalesce", ["get", "color"], colors.chart.schoolNormal],
          "circle-opacity": ["coalesce", ["get", "opacity"], 0.94],
          "circle-stroke-color": "rgba(255, 250, 240, 0.96)",
          "circle-stroke-width": [
            "match",
            ["get", "tier"],
            "985",
            2,
            "211",
            1.6,
            1.1,
          ],
          "circle-blur": 0.04,
        },
      });

      fitBounds(map, CHINA_VIEW_BOUNDS, "country");
    },
    [schoolData],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMap() {
      try {
        const data = await loadMapData("100000");
        if (!cancelled) setMapData(data);
      } catch {
        if (!cancelled) setMapReady(false);
      }
    }

    loadInitialMap();
    return () => {
      cancelled = true;
    };
  }, [loadMapData]);

  useEffect(() => {
    if (!mapContainerRef.current || !normalizedMapData || !labelData || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {},
        layers: [],
      },
      attributionControl: false,
      center: [104, 35],
      zoom: 3.15,
      minZoom: 2.15,
      maxZoom: 8.8,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
      fadeDuration: 0,
    });

    mapRef.current = map;
    map.doubleClickZoom.disable();
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      "bottom-right",
    );

    map.on("load", () => {
      installMapLayers(map, normalizedMapData, labelData);
      setSchoolSourceData(schoolData);
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [installMapLayers, labelData, normalizedMapData, schoolData, setSchoolSourceData]);

  useEffect(() => {
    if (!normalizedMapData || !labelData) return;
    resetHover();
    setRegionSourceData(normalizedMapData, labelData);
  }, [labelData, normalizedMapData, resetHover, setRegionSourceData]);

  useEffect(() => {
    setSchoolSourceData(schoolData);
  }, [schoolData, setSchoolSourceData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mapData) return;
    const bounds = drill.level === "country" ? CHINA_VIEW_BOUNDS : boundsFromGeoJson(mapData);
    fitBounds(map, bounds, drill.level);
  }, [drill.level, mapData, mapReady]);

  const drillDown = useCallback(
    async (name: string, adcode: string) => {
      setLoadingDrill(true);
      try {
        const data = await loadMapData(adcode);
        const targetLevel: MapLevel = drill.level === "country" ? "province" : "city";
        setMapData(data);
        setDrill((current) => ({
          level: targetLevel,
          mapName: `${targetLevel}_${adcode}`,
          adcode,
          breadcrumbs: [...current.breadcrumbs, { name, adcode, level: targetLevel }],
        }));

        if (targetLevel === "province") {
          const prov = MAP_NAME_TO_PROVINCE[name] || shortProvinceName(name) || name;
          onProvinceSelect(prov);
        }
      } catch {
        console.warn(`[ChinaMap] Failed to load map: ${adcode}`);
      } finally {
        setLoadingDrill(false);
      }
    },
    [drill.level, loadMapData, onProvinceSelect],
  );

  const resetToCountry = useCallback(async () => {
    setLoadingDrill(true);
    try {
      const data = await loadMapData("100000");
      setMapData(data);
      setDrill(INITIAL_DRILL_STATE);
      onProvinceSelect(null);
    } catch {
      console.warn("[ChinaMap] Failed to restore country map");
    } finally {
      setLoadingDrill(false);
    }
  }, [loadMapData, onProvinceSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = (event: MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ["region-fill", "school-points"],
      });
      if (hits.length > 0) return;
      onSchoolPreview(null);
    };

    const handleRegionClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const name = featureName(feature);
      if (!name) return;

      if (drill.level === "country") {
        const province = shortProvinceName(name);
        const adcode = province ? getProvinceAdcode(province) : null;
        if (province && adcode) {
          void drillDown(mapProvinceName(province), adcode);
        }
      } else if (drill.level === "province") {
        const adcode = featureAdcode(feature);
        if (adcode) {
          void drillDown(name, adcode);
        }
      }
    };

    const handleRegionMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const id = feature?.id;
      if (id == null || id === hoveredRegionIdRef.current) return;
      resetHover();
      hoveredRegionIdRef.current = id;
      map.setFeatureState({ source: "regions", id }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
    };

    const handleRegionLeave = () => {
      resetHover();
      map.getCanvas().style.cursor = "";
    };

    const handleSchoolClick = (event: MapLayerMouseEvent) => {
      event.preventDefault();
      const name = featureName(event.features?.[0]);
      if (!name) return;
      const school = schools.find((item) => item.name === name);
      if (!school) return;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        onSchoolPreview(school);
      }, 180);
    };

    const handleSchoolDoubleClick = (event: MapLayerMouseEvent) => {
      event.preventDefault();
      const name = featureName(event.features?.[0]);
      if (!name) return;
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      const school = schools.find((item) => item.name === name);
      if (school) onSchoolClick(school);
    };

    const handleSchoolMove = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleSchoolLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", handleMapClick);
    map.on("click", "region-fill", handleRegionClick);
    map.on("mousemove", "region-fill", handleRegionMove);
    map.on("mouseleave", "region-fill", handleRegionLeave);
    map.on("click", "school-points", handleSchoolClick);
    map.on("dblclick", "school-points", handleSchoolDoubleClick);
    map.on("mousemove", "school-points", handleSchoolMove);
    map.on("mouseleave", "school-points", handleSchoolLeave);

    return () => {
      map.off("click", handleMapClick);
      map.off("click", "region-fill", handleRegionClick);
      map.off("mousemove", "region-fill", handleRegionMove);
      map.off("mouseleave", "region-fill", handleRegionLeave);
      map.off("click", "school-points", handleSchoolClick);
      map.off("dblclick", "school-points", handleSchoolDoubleClick);
      map.off("mousemove", "school-points", handleSchoolMove);
      map.off("mouseleave", "school-points", handleSchoolLeave);
    };
  }, [drill.level, drillDown, mapReady, onSchoolClick, onSchoolPreview, resetHover, schools]);

  const handleClosePopup = useCallback(() => {
    onSchoolPreview(null);
  }, [onSchoolPreview]);

  return (
    <div
      className="china-map-stage relative h-full w-full overflow-hidden"
      role="figure"
      aria-label={EMPTY_MESSAGES.map}
      style={stageStyle}
    >
      <div aria-hidden="true" className="china-map-veil" />

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

      {drill.level !== "country" && (
        <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-2 text-xs text-text-muted">
          <span className="rounded-md border border-border bg-neutral-0/70 px-3 py-1 backdrop-blur-sm">
            {visibleSchools.length} 所高校
          </span>
        </div>
      )}

      {!mapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-text-secondary">
          {EMPTY_MESSAGES.loadingMap}
        </div>
      )}

      <div ref={mapContainerRef} className="china-map-maplibre h-full w-full" />

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
