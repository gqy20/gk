"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { SCHOOL_TIER_STYLES, getMapRegionPalette, getProvincePalette } from "@/lib/map-style";
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
  highlightedSchools: School[];
  provinces: ProvinceData[];
  selectedProvince: string | null;
  previewSchool: School | null;
  hasActiveMapFilters: boolean;
  filter985: boolean;
  filter211: boolean;
  filterDoubleFirst: boolean;
  onProvinceSelect: (province: string | null) => void;
  onSchoolPreview: (school: School | null) => void;
  onSchoolClick: (school: School) => void;
  onToggle985: () => void;
  onToggle211: () => void;
  onToggleDoubleFirst: () => void;
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

type InitialMapPayload = {
  regions: GeoJsonFeatureCollection;
  labels: GeoJsonFeatureCollection;
  schools: GeoJsonFeatureCollection;
};

type PendingCamera = {
  bounds: Bounds;
  level: MapLevel;
};

type MapHoverInfo =
  | {
      kind: "region";
      x: number;
      y: number;
      name: string;
      count: number;
    }
  | {
      kind: "school";
      x: number;
      y: number;
      name: string;
      tier: string;
    };

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
const CHINA_CAMERA_BOUNDS: Bounds = [58, 6, 150, 65];
const MAP_INTERACTION_BOUNDS: Bounds = [58, -2, 154, 64];
const MAP_PITCH_BY_LEVEL: Record<MapLevel, number> = {
  country: 24,
  province: 20,
  city: 16,
};
const SEA_TEXTURE_COORDINATES: [Position, Position, Position, Position] = [
  [-120, 88],
  [260, 88],
  [260, -72],
  [-120, -72],
];

function mapProvinceName(province: string): string {
  return MAP_PROVINCE_NAMES[province] || province;
}

function shortProvinceName(name?: string): string | null {
  if (!name) return null;
  return SHORT_PROVINCE_NAMES.get(name) || name;
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
  const nextBounds: LngLatBoundsLike = [
    [bounds[0], bounds[1]],
    [bounds[2], bounds[3]],
  ];
  const pitch = MAP_PITCH_BY_LEVEL[level];
  if (level !== "country") {
    const camera = map.cameraForBounds(nextBounds, {
      padding:
        level === "province"
          ? { top: 24, right: 170, bottom: 24, left: 24 }
          : { top: 18, right: 110, bottom: 18, left: 22 },
      maxZoom: 8.2,
    });
    if (camera) {
      const zoomOffset = level === "province" ? -0.35 : -0.15;
      const cameraZoom = camera.zoom ?? 6;
      map.easeTo({
        center: camera.center,
        zoom: Math.min(cameraZoom + zoomOffset, 8.45),
        bearing: -5,
        pitch,
        duration: level === "province" ? 520 : 420,
        essential: true,
      });
      return;
    }
  }
  const camera = map.cameraForBounds(nextBounds, {
    padding: 54,
    maxZoom: 4.15,
  });
  if (!camera) return;
  map.easeTo({
    center: camera.center,
    zoom: camera.zoom,
    bearing: -5,
    pitch,
    duration: 420,
    essential: true,
  });
}

function normalizeMapData(
  data: GeoJsonFeatureCollection,
  provinces: ProvinceData[],
  selectedProvince: string | null,
  schools: School[] = [],
  level: MapLevel = "country",
  parentProvince: string | null = null,
) {
  const countByProvince = new Map(provinces.map((province) => [province.name, province.count]));

  const features = data.features.map((feature) => {
    const mapName = String(feature.properties.name || "");
    const shortName = shortProvinceName(mapName) || mapName;
    const palette = getMapRegionPalette(shortName, level, parentProvince);
    return {
      ...feature,
      id: String(feature.properties.adcode || mapName),
      properties: {
        ...feature.properties,
        shortName,
        count: level === "country"
          ? countByProvince.get(shortName) ?? 0
          : countSchoolsInFeature(feature, schools),
        elevationBase: 0,
        colorName: palette.colorName,
        fillColor: palette.fill,
        selectedFillColor: palette.selectedFill,
        hoverFillColor: palette.hoverFill,
        edgeColor: palette.edge,
        labelColor: palette.label,
        haloColor: palette.halo,
        selected: level === "country" && selectedProvince === shortName,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  } as GeoJsonFeatureCollection;
}

function countSchoolsInFeature(feature: GeoJsonFeature, schools: School[]) {
  const geometry = feature.geometry;
  if (!geometry) return 0;
  return schools.filter((school) => pointInGeometry(school.coord, geometry)).length;
}

function pointInGeometry(point: [number, number], geometry: GeoJsonGeometry): boolean {
  if (geometry.type === "Polygon") {
    const polygon = asPolygonCoordinates(geometry.coordinates);
    return polygon ? pointInPolygon(point, polygon) : false;
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = asMultiPolygonCoordinates(geometry.coordinates);
    return polygons ? polygons.some((polygon) => pointInPolygon(point, polygon)) : false;
  }
  return false;
}

function asPolygonCoordinates(value: unknown): number[][][] | null {
  if (!Array.isArray(value)) return null;
  return value as number[][][];
}

function asMultiPolygonCoordinates(value: unknown): number[][][][] | null {
  if (!Array.isArray(value)) return null;
  return value as number[][][][];
}

function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [lng, lat] = point;
  const outerRing = polygon[0];
  if (!outerRing) return false;

  let inside = false;
  for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
    const xi = outerRing[i][0];
    const yi = outerRing[i][1];
    const xj = outerRing[j][0];
    const yj = outerRing[j][1];
    const intersects = yi > lat !== yj > lat
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  if (!inside) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [lng, lat] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > lat !== yj > lat
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
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
            labelColor: feature.properties.labelColor,
            haloColor: feature.properties.haloColor,
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

function schoolColor(school: School, selectedProvince: string | null, highlighted: boolean): string {
  if (!highlighted || (selectedProvince && school.province !== selectedProvince)) return colors.chart.schoolMuted;
  if (school.is985) return colors.chart.school985;
  if (school.is211) return colors.chart.school211;
  if (school.isDoubleFirstClass) return colors.chart.schoolDoubleFirst;
  return colors.chart.schoolNormal;
}

function schoolRadius(school: School, highlighted: boolean): number {
  if (!highlighted) return 2.2;
  if (school.is985) return 10.4;
  if (school.is211) return 8.6;
  if (school.isDoubleFirstClass) return 7.2;
  return 5.4;
}

function makeSchoolData(
  schools: School[],
  selectedProvince: string | null,
  highlightedSchoolNames: Set<string>,
  hasActiveMapFilters: boolean,
) {
  return {
    type: "FeatureCollection",
    features: schools.map((school) => {
      const matchesFilter = !hasActiveMapFilters || highlightedSchoolNames.has(school.name);
      const highlighted = matchesFilter && (!selectedProvince || school.province === selectedProvince);

      return {
        type: "Feature" as const,
        id: school.name,
        properties: {
          name: school.name,
          province: school.province,
          tier: schoolTier(school),
          highlighted,
          color: schoolColor(school, selectedProvince, highlighted),
          opacity: highlighted ? 0.98 : 0.07,
          radius: schoolRadius(school, highlighted),
          strokeWidth: highlighted ? 2.1 : 0.25,
          sortKey: highlighted ? 2 : 1,
        },
        geometry: {
          type: "Point",
          coordinates: school.coord,
        },
      };
    }),
  } as GeoJsonFeatureCollection;
}

function featureName(feature?: MapGeoJSONFeature): string | null {
  const name = feature?.properties?.name;
  return typeof name === "string" ? name : null;
}

function featureString(feature: MapGeoJSONFeature | undefined, key: string): string {
  const value = feature?.properties?.[key];
  return typeof value === "string" ? value : "";
}

function featureNumber(feature: MapGeoJSONFeature | undefined, key: string): number {
  const value = feature?.properties?.[key];
  return typeof value === "number" ? value : 0;
}

function featureAdcode(feature?: MapGeoJSONFeature): string | null {
  const adcode = feature?.properties?.adcode;
  if (typeof adcode === "number") return String(adcode);
  if (typeof adcode === "string") return adcode;
  return null;
}

export default function ChinaMap({
  schools,
  highlightedSchools,
  provinces,
  selectedProvince,
  previewSchool,
  hasActiveMapFilters,
  filter985,
  filter211,
  filterDoubleFirst,
  onProvinceSelect,
  onSchoolPreview,
  onSchoolClick,
  onToggle985,
  onToggle211,
  onToggleDoubleFirst,
}: ChinaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pendingCameraRef = useRef<PendingCamera | null>(null);
  const hoveredRegionIdRef = useRef<string | number | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [mapData, setMapData] = useState<GeoJsonFeatureCollection | null>(null);
  const [initialMapPayload, setInitialMapPayload] = useState<InitialMapPayload | null>(null);
  const [drill, setDrill] = useState<DrillState>(INITIAL_DRILL_STATE);
  const [hoverInfo, setHoverInfo] = useState<MapHoverInfo | null>(null);

  const currentProvince =
    drill.level === "country"
      ? selectedProvince
      : MAP_NAME_TO_PROVINCE[drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name] ||
        selectedProvince;

  const visibleSchools = useMemo(() => {
    if (drill.level === "country") return schools;
    if (!currentProvince) return schools;
    return schools.filter((school) => school.province === currentProvince);
  }, [schools, drill.level, currentProvince]);

  const highlightedSchoolNames = useMemo(
    () => new Set(highlightedSchools.map((school) => school.name)),
    [highlightedSchools],
  );

  const normalizedMapData = useMemo(() => {
    if (!mapData) return null;
    return normalizeMapData(mapData, provinces, selectedProvince, visibleSchools, drill.level, currentProvince);
  }, [currentProvince, drill.level, mapData, provinces, selectedProvince, visibleSchools]);

  const labelData = useMemo(() => {
    if (!normalizedMapData) return null;
    return makeLabelData(normalizedMapData);
  }, [normalizedMapData]);

  const schoolData = useMemo(
    () => makeSchoolData(visibleSchools, selectedProvince, highlightedSchoolNames, hasActiveMapFilters),
    [hasActiveMapFilters, highlightedSchoolNames, selectedProvince, visibleSchools],
  );
  const initialSchoolData = useMemo(
    () => makeSchoolData(schools, null, highlightedSchoolNames, hasActiveMapFilters),
    [hasActiveMapFilters, highlightedSchoolNames, schools],
  );
  const stagePalette = useMemo(
    () => currentProvince ? getProvincePalette(currentProvince) : null,
    [currentProvince],
  );

  const loadMapData = useCallback(async (adcode: string) => {
    const url = adcode === "100000" ? "/china.json" : `/maps/${adcode}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load map data: ${url}`);
    return (await response.json()) as GeoJsonFeatureCollection;
  }, []);

  const resetHover = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("regions") || hoveredRegionIdRef.current === null) return;
    map.setFeatureState(
      { source: "regions", id: hoveredRegionIdRef.current },
      { hover: false },
    );
    hoveredRegionIdRef.current = null;
  }, []);

  const setRegionSourceData = useCallback((data: GeoJsonFeatureCollection, labels: GeoJsonFeatureCollection) => {
    const map = mapRef.current;
    if (!map || !map.getSource("regions") || !map.getSource("region-labels")) return;
    (map.getSource("regions") as GeoJSONSource | undefined)?.setData(data);
    (map.getSource("region-labels") as GeoJSONSource | undefined)?.setData(labels);
  }, []);

  const setSchoolSourceData = useCallback((data: GeoJsonFeatureCollection) => {
    const map = mapRef.current;
    if (!map || !map.getSource("schools")) return;
    (map.getSource("schools") as GeoJSONSource | undefined)?.setData(data);
  }, []);

  const scheduleCameraFit = useCallback((bounds: Bounds, level: MapLevel) => {
    const map = mapRef.current;
    if (!map) return;
    pendingCameraRef.current = { bounds, level };

    const fitPendingCamera = () => {
      const pending = pendingCameraRef.current;
      if (!pending) return;
      pendingCameraRef.current = null;
      fitBounds(map, pending.bounds, pending.level);
    };

    map.once("idle", fitPendingCamera);
    window.requestAnimationFrame(() => {
      fitPendingCamera();
    });
    window.setTimeout(() => {
      map.resize();
      pendingCameraRef.current = { bounds, level };
      fitPendingCamera();
    }, 180);
  }, []);

  const syncSeaWatercolorLayer = useCallback((visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (!visible) {
        if (map.getLayer("sea-watercolor")) {
          map.removeLayer("sea-watercolor");
        }
        if (map.getSource("sea-watercolor")) {
          map.removeSource("sea-watercolor");
        }
        return;
      }

      if (!map.getSource("sea-watercolor")) {
        map.addSource("sea-watercolor", {
          type: "image",
          url: "/textures/sea-wash.webp",
          coordinates: SEA_TEXTURE_COORDINATES,
        });
      }

      if (!map.getLayer("sea-watercolor")) {
        map.addLayer(
          {
            id: "sea-watercolor",
            type: "raster",
            source: "sea-watercolor",
            paint: {
              "raster-opacity": 0.26,
              "raster-fade-duration": 0,
            },
          },
          map.getLayer("region-fill") ? "region-fill" : undefined,
        );
        return;
      }

      map.setLayoutProperty("sea-watercolor", "visibility", "visible");
      map.setPaintProperty("sea-watercolor", "raster-opacity", 0.26);
    } catch {
      // The style can briefly be unavailable while MapLibre is settling after a source update.
    }
  }, []);

  const installMapLayers = useCallback(
    (
      map: maplibregl.Map,
      initialRegions: GeoJsonFeatureCollection,
      initialLabels: GeoJsonFeatureCollection,
      initialSchools: GeoJsonFeatureCollection,
    ) => {
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
        data: initialSchools,
      });

      map.addLayer({
        id: "paper-background",
        type: "background",
        paint: {
          "background-color": "rgba(231, 226, 214, 1)",
        },
      });
      map.addLayer({
        id: "region-underpaint",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": "rgba(255, 250, 240, 0.72)",
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.4,
            0.36,
            4.2,
            0.44,
            6,
            0.5,
          ],
        },
      });
      map.addLayer({
        id: "region-paper-base",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": "rgba(255, 253, 247, 0.88)",
          "fill-opacity": 0.72,
          "fill-translate": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.4,
            ["literal", [4, 6]],
            5,
            ["literal", [8, 11]],
            8,
            ["literal", [12, 16]],
          ],
          "fill-translate-anchor": "viewport",
        },
      });
      map.addLayer({
        id: "region-drop-shadow",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": "rgba(66, 58, 45, 0.42)",
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "count"], 0],
            0,
            0.12,
            8,
            0.18,
            34,
            0.25,
          ],
          "fill-translate": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.4,
            ["literal", [12, 16]],
            5,
            ["literal", [20, 28]],
            8,
            ["literal", [28, 38]],
          ],
          "fill-translate-anchor": "viewport",
        },
      });
      map.addLayer({
        id: "region-paper-side",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "rgba(103, 132, 124, 0.42)",
            ["boolean", ["get", "selected"], false],
            "rgba(100, 124, 115, 0.38)",
            "rgba(92, 113, 106, 0.34)",
          ],
          "fill-opacity": 0.78,
          "fill-translate": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.4,
            ["literal", [8, 10]],
            5,
            ["literal", [13, 16]],
            8,
            ["literal", [18, 22]],
          ],
          "fill-translate-anchor": "viewport",
        },
      });
      map.addLayer({
        id: "region-paper-side-edge",
        type: "line",
        source: "regions",
        paint: {
          "line-color": "rgba(61, 82, 77, 0.38)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.1, 4, 1.55, 6, 2.1],
          "line-blur": 0.45,
          "line-opacity": 0.72,
          "line-translate": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.4,
            ["literal", [8, 10]],
            5,
            ["literal", [13, 16]],
            8,
            ["literal", [18, 22]],
          ],
          "line-translate-anchor": "viewport",
        },
      });
      map.addLayer({
        id: "region-paper-highlight",
        type: "line",
        source: "regions",
        paint: {
          "line-color": "rgba(255, 253, 246, 0.88)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 2.2, 4, 3.2, 6, 4.6],
          "line-blur": 1.1,
          "line-opacity": 0.74,
          "line-translate": ["literal", [-1.4, -1.8]],
          "line-translate-anchor": "viewport",
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
            ["coalesce", ["get", "hoverFillColor"], "rgba(242, 223, 174, 0.86)"],
            ["boolean", ["get", "selected"], false],
            ["coalesce", ["get", "selectedFillColor"], "rgba(242, 223, 174, 0.78)"],
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
            "rgba(70, 88, 82, 0.78)",
            "rgba(76, 92, 86, 0.56)",
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.15, 4, 1.5, 6, 1.9],
          "line-blur": 0.18,
          "line-opacity": 0.82,
        },
      });
      map.addLayer({
        id: "region-labels",
        type: "symbol",
        source: "region-labels",
        minzoom: 2.45,
        layout: {
          "text-field": ["to-string", ["get", "name"]],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2.5, 13, 4.2, 16, 6, 20],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "rgba(255, 255, 251, 0.94)",
          "text-halo-color": "rgba(57, 69, 64, 0.30)",
          "text-halo-width": 1.8,
          "text-opacity": 0.96,
        },
      });
      map.addLayer({
        id: "school-point-shadows",
        type: "circle",
        source: "schools",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "radius"], 4.7],
            2,
            3.6,
            11,
            16,
          ],
          "circle-color": "rgba(49, 44, 35, 0.32)",
          "circle-opacity": ["*", ["coalesce", ["get", "opacity"], 0.94], 0.34],
          "circle-blur": 0.72,
          "circle-translate": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.4,
            ["literal", [3, 5]],
            6,
            ["literal", [6, 9]],
          ],
          "circle-translate-anchor": "viewport",
        },
        layout: {
          "circle-sort-key": ["coalesce", ["get", "sortKey"], 1],
        },
      });
      map.addLayer({
        id: "school-points",
        type: "circle",
        source: "schools",
        paint: {
          "circle-radius": ["coalesce", ["get", "radius"], 4.7],
          "circle-color": ["coalesce", ["get", "color"], colors.chart.schoolNormal],
          "circle-opacity": ["coalesce", ["get", "opacity"], 0.94],
          "circle-stroke-color": "rgba(255, 250, 240, 0.96)",
          "circle-stroke-width": ["coalesce", ["get", "strokeWidth"], 1.1],
          "circle-blur": 0.04,
        },
        layout: {
          "circle-sort-key": ["coalesce", ["get", "sortKey"], 1],
        },
      });

      fitBounds(map, CHINA_CAMERA_BOUNDS, "country");
    },
    [],
  );

  useEffect(() => {
    if (initialMapPayload) return;
    let cancelled = false;

    async function loadInitialMap() {
      try {
        const data = await loadMapData("100000");
        const initialRegions = normalizeMapData(data, provinces, selectedProvince, schools, "country");
        const initialLabels = makeLabelData(initialRegions);
        if (!cancelled) {
          setMapData(data);
          setInitialMapPayload({
            regions: initialRegions,
            labels: initialLabels,
            schools: initialSchoolData,
          });
        }
      } catch {
        if (!cancelled) setMapReady(false);
      }
    }

    loadInitialMap();
    return () => {
      cancelled = true;
    };
  }, [initialMapPayload, initialSchoolData, loadMapData, provinces, schools, selectedProvince]);

  const handleMapContainerRef = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    setMapContainerReady(Boolean(node));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !initialMapPayload || mapRef.current) return;

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
      zoom: 2.95,
      bearing: -5,
      pitch: MAP_PITCH_BY_LEVEL.country,
      minZoom: 2.45,
      maxZoom: 8.8,
      maxBounds: [
        [MAP_INTERACTION_BOUNDS[0], MAP_INTERACTION_BOUNDS[1]],
        [MAP_INTERACTION_BOUNDS[2], MAP_INTERACTION_BOUNDS[3]],
      ],
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
      installMapLayers(map, initialMapPayload.regions, initialMapPayload.labels, initialMapPayload.schools);
      setMapReady(true);
      syncSeaWatercolorLayer(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialMapPayload, installMapLayers, mapContainerReady, syncSeaWatercolorLayer]);

  useEffect(() => {
    if (!normalizedMapData || !labelData) return;
    resetHover();
    setRegionSourceData(normalizedMapData, labelData);
    const bounds = drill.level === "country" ? CHINA_CAMERA_BOUNDS : boundsFromGeoJson(normalizedMapData);
    scheduleCameraFit(bounds, drill.level);
  }, [drill.level, labelData, normalizedMapData, resetHover, scheduleCameraFit, setRegionSourceData]);

  useEffect(() => {
    const node = mapContainerRef.current;
    const map = mapRef.current;
    if (!node || !map || !normalizedMapData) return;

    const observer = new ResizeObserver(() => {
      map.resize();
      const bounds = drill.level === "country" ? CHINA_CAMERA_BOUNDS : boundsFromGeoJson(normalizedMapData);
      scheduleCameraFit(bounds, drill.level);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [drill.level, mapReady, normalizedMapData, scheduleCameraFit]);

  useEffect(() => {
    setSchoolSourceData(schoolData);
  }, [schoolData, setSchoolSourceData]);

  useEffect(() => {
    syncSeaWatercolorLayer(drill.level === "country");
  }, [drill.level, mapReady, syncSeaWatercolorLayer]);

  const drillDown = useCallback(
    async (name: string, adcode: string) => {
      setLoadingDrill(true);
      syncSeaWatercolorLayer(false);
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
    [drill.level, loadMapData, onProvinceSelect, syncSeaWatercolorLayer],
  );

  const resetToCountry = useCallback(async () => {
    setLoadingDrill(true);
    try {
      const data = await loadMapData("100000");
      setMapData(data);
      setDrill(INITIAL_DRILL_STATE);
      syncSeaWatercolorLayer(true);
      onProvinceSelect(null);
    } catch {
      console.warn("[ChinaMap] Failed to restore country map");
    } finally {
      setLoadingDrill(false);
    }
  }, [loadMapData, onProvinceSelect, syncSeaWatercolorLayer]);

  useEffect(() => {
    if (selectedProvince || drill.level === "country" || loadingDrill) return;
    const id = window.setTimeout(() => {
      void resetToCountry();
    }, 0);
    return () => window.clearTimeout(id);
  }, [drill.level, loadingDrill, resetToCountry, selectedProvince]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = (event: MapMouseEvent) => {
      const schoolFeature = map.queryRenderedFeatures(event.point, {
        layers: ["school-points"],
      })[0];
      const schoolName = featureName(schoolFeature);
      if (schoolName) {
        const school = schools.find((item) => item.name === schoolName);
        if (school) {
          if (clickTimer.current) clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(() => {
            onSchoolPreview(school);
          }, 180);
          return;
        }
      }

      const regionFeature = map.queryRenderedFeatures(event.point, {
        layers: ["region-fill", "region-underpaint"],
      })[0];
      const name = featureName(regionFeature);
      if (!name) {
        setHoverInfo(null);
        onSchoolPreview(null);
        return;
      }

      if (drill.level === "country") {
        const province = shortProvinceName(name);
        const adcode = province ? getProvinceAdcode(province) : null;
        if (province && adcode) {
          void drillDown(mapProvinceName(province), adcode);
        }
      } else if (drill.level === "province") {
        const adcode = featureAdcode(regionFeature);
        if (adcode) {
          void drillDown(name, adcode);
        }
      }
    };

    const handleRegionMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const id = feature?.id;
      const name = featureString(feature, "shortName") || featureName(feature);
      if (!name) return;
      if (id != null && id !== hoveredRegionIdRef.current) {
        resetHover();
        hoveredRegionIdRef.current = id;
        map.setFeatureState({ source: "regions", id }, { hover: true });
      }
      setHoverInfo({
        kind: "region",
        x: event.point.x,
        y: event.point.y,
        name,
        count: featureNumber(feature, "count"),
      });
      map.getCanvas().style.cursor = "pointer";
    };

    const handleRegionLeave = () => {
      resetHover();
      setHoverInfo(null);
      map.getCanvas().style.cursor = "";
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

    const handleSchoolMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const name = featureName(feature);
      if (name) {
        setHoverInfo({
          kind: "school",
          x: event.point.x,
          y: event.point.y,
          name,
          tier: featureString(feature, "tier") || "normal",
        });
      }
      map.getCanvas().style.cursor = "pointer";
    };

    const handleSchoolLeave = () => {
      setHoverInfo(null);
      map.getCanvas().style.cursor = "";
    };

    map.on("click", handleMapClick);
    map.on("mousemove", "region-fill", handleRegionMove);
    map.on("mouseleave", "region-fill", handleRegionLeave);
    map.on("dblclick", "school-points", handleSchoolDoubleClick);
    map.on("mousemove", "school-points", handleSchoolMove);
    map.on("mouseleave", "school-points", handleSchoolLeave);

    return () => {
      map.off("click", handleMapClick);
      map.off("mousemove", "region-fill", handleRegionMove);
      map.off("mouseleave", "region-fill", handleRegionLeave);
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
      className={`china-map-stage ${
        drill.level === "country" ? "china-map-stage-country" : "china-map-stage-local"
      } relative h-full w-full overflow-hidden`}
      style={stagePalette ? {
        "--map-local-fill": stagePalette.fill,
        "--map-local-selected-fill": stagePalette.selectedFill,
        "--map-local-hover-fill": stagePalette.hoverFill,
        "--map-local-edge": stagePalette.edge,
      } as CSSProperties : undefined}
      role="figure"
      aria-label={EMPTY_MESSAGES.map}
    >
      <div aria-hidden="true" className="china-map-veil" />

      {loadingDrill && drill.level !== "country" && (
        <div className="absolute left-3 top-3 z-20 rounded-md bg-neutral-0/70 px-2.5 py-1 text-[11px] text-text-muted shadow-sm backdrop-blur-sm">
          加载中...
        </div>
      )}

      {!mapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-text-secondary">
          {EMPTY_MESSAGES.loadingMap}
        </div>
      )}

      <div ref={handleMapContainerRef} className="china-map-maplibre h-full w-full" />

      <MapHoverTooltip hoverInfo={hoverInfo} />
      <MapLegend
        filter985={filter985}
        filter211={filter211}
        filterDoubleFirst={filterDoubleFirst}
        onToggle985={onToggle985}
        onToggle211={onToggle211}
        onToggleDoubleFirst={onToggleDoubleFirst}
      />

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

function MapHoverTooltip({ hoverInfo }: { hoverInfo: MapHoverInfo | null }) {
  if (!hoverInfo) return null;

  const tierStyle =
    hoverInfo.kind === "school"
      ? SCHOOL_TIER_STYLES[hoverInfo.tier] || SCHOOL_TIER_STYLES.normal
      : null;

  return (
    <div
      className="pointer-events-none absolute z-30 min-w-[132px] rounded-md border border-border bg-neutral-0/88 px-3 py-2 text-xs text-text shadow-lg shadow-neutral-900/10 backdrop-blur-md"
      style={{
        left: Math.min(hoverInfo.x + 14, 520),
        top: Math.max(12, hoverInfo.y + 14),
      }}
    >
      {hoverInfo.kind === "region" ? (
        <>
          <div className="font-semibold leading-tight">{hoverInfo.name}</div>
          <div className="mt-1.5 text-[11px] text-text-secondary">高校 {hoverInfo.count} 所</div>
        </>
      ) : (
        <>
          <div className="max-w-[180px] truncate font-semibold leading-tight">{hoverInfo.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
            {tierStyle && (
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tierStyle.color }}
                />
                {tierStyle.label}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const activeLegendClasses: Record<"985" | "211" | "doubleFirst", string> = {
  "985": "border-danger-600/30 bg-danger-500 text-text-inverse shadow-danger-500/20",
  "211": "border-accent-700/25 bg-accent-500 text-text-inverse shadow-accent-500/18",
  doubleFirst: "border-brand-700/25 bg-success text-text-inverse shadow-brand-500/18",
};

function MapLegend({
  filter985,
  filter211,
  filterDoubleFirst,
  onToggle985,
  onToggle211,
  onToggleDoubleFirst,
}: {
  filter985: boolean;
  filter211: boolean;
  filterDoubleFirst: boolean;
  onToggle985: () => void;
  onToggle211: () => void;
  onToggleDoubleFirst: () => void;
}) {
  const activeByTier = {
    "985": filter985,
    "211": filter211,
    doubleFirst: filterDoubleFirst,
  };
  const actionByTier = {
    "985": onToggle985,
    "211": onToggle211,
    doubleFirst: onToggleDoubleFirst,
  };

  return (
    <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1.5 rounded-md border border-border bg-neutral-0/72 px-2.5 py-2 text-[11px] text-text-muted shadow-sm backdrop-blur-sm">
      {Object.entries(SCHOOL_TIER_STYLES).map(([tier, style]) => {
        const filterTier = tier as "985" | "211" | "doubleFirst";
        const isFilterable = tier !== "normal";
        const isActive = isFilterable ? activeByTier[filterTier] : false;

        if (!isFilterable) {
          return (
            <span key={tier} className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full border border-neutral-0"
                style={{ backgroundColor: style.color }}
              />
              {style.label}
            </span>
          );
        }

        return (
          <motion.button
            key={tier}
            type="button"
            aria-pressed={isActive}
            onClick={actionByTier[filterTier]}
            initial={isActive ? { scale: 0.9 } : false}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.04, borderColor: "rgba(63,143,155,0.48)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: isActive ? 500 : 400, damping: isActive ? 25 : 22 }}
            className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 font-semibold shadow-sm ${
              isActive
                ? activeLegendClasses[filterTier]
                : "border-transparent bg-transparent text-text-muted shadow-white/35"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full border border-neutral-0"
              style={{ backgroundColor: isActive ? "currentColor" : style.color }}
            />
            {style.label}
          </motion.button>
        );
      })}
    </div>
  );
}
