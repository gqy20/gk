"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SCHOOL_TIER_STYLES, getProvincePalette } from "@/lib/map-style";
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
      province: string;
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
const MAP_INTERACTION_BOUNDS: Bounds = [58, -2, 154, 64];
const SEA_TEXTURE_COORDINATES: [Position, Position, Position, Position] = [
  [48, 70],
  [166, 70],
  [166, -12],
  [48, -12],
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
  if (level !== "country") {
    const camera = map.cameraForBounds(nextBounds, {
      padding: 10,
      maxZoom: 8.2,
    });
    if (camera) {
      const zoomBoost = level === "province" ? 0.9 : 0.45;
      const cameraZoom = camera.zoom ?? 6;
      map.easeTo({
        center: camera.center,
        zoom: Math.min(cameraZoom + zoomBoost, 8.45),
        duration: 460,
        essential: true,
      });
      return;
    }
  }
  map.fitBounds(nextBounds, {
    padding: level === "country" ? 34 : 18,
    duration: 420,
    maxZoom: level === "country" ? 4.15 : 8.2,
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
    const palette = getProvincePalette(shortName);
    return {
      ...feature,
      id: String(feature.properties.adcode || mapName),
      properties: {
        ...feature.properties,
        shortName,
        count: countByProvince.get(shortName) ?? 0,
        colorName: palette.colorName,
        fillColor: palette.fill,
        selectedFillColor: palette.selectedFill,
        hoverFillColor: palette.hoverFill,
        edgeColor: palette.edge,
        labelColor: palette.label,
        haloColor: palette.halo,
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
  const hoveredRegionIdRef = useRef<string | number | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [mapData, setMapData] = useState<GeoJsonFeatureCollection | null>(null);
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
    return normalizeMapData(mapData, provinces, selectedProvince);
  }, [mapData, provinces, selectedProvince]);

  const labelData = useMemo(() => {
    if (!normalizedMapData) return null;
    return makeLabelData(normalizedMapData);
  }, [normalizedMapData]);

  const schoolData = useMemo(
    () => makeSchoolData(visibleSchools, selectedProvince, highlightedSchoolNames, hasActiveMapFilters),
    [hasActiveMapFilters, highlightedSchoolNames, selectedProvince, visibleSchools],
  );

  const currentProvinceCount =
    currentProvince
      ? provinces.find((province) => province.name === currentProvince)?.count ?? visibleSchools.length
      : null;

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
              "raster-opacity": 0.34,
              "raster-fade-duration": 0,
            },
          },
          map.getLayer("region-fill") ? "region-fill" : undefined,
        );
        return;
      }

      map.setLayoutProperty("sea-watercolor", "visibility", "visible");
      map.setPaintProperty("sea-watercolor", "raster-opacity", 0.34);
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
          "background-color": "rgba(246, 239, 226, 0)",
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
            ["coalesce", ["get", "edgeColor"], "rgba(80, 98, 92, 0.86)"],
            ["coalesce", ["get", "edgeColor"], "rgba(92, 104, 97, 0.56)"],
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
          "text-color": ["coalesce", ["get", "labelColor"], "rgba(74, 82, 76, 0.70)"],
          "text-halo-color": ["coalesce", ["get", "haloColor"], "rgba(255, 250, 240, 0.78)"],
          "text-halo-width": 1.2,
          "text-opacity": 0.92,
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

      fitBounds(map, CHINA_VIEW_BOUNDS, "country");
    },
    [],
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
      installMapLayers(map, normalizedMapData, labelData, schoolData);
      setMapReady(true);
      syncSeaWatercolorLayer(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [installMapLayers, labelData, normalizedMapData, schoolData, syncSeaWatercolorLayer]);

  useEffect(() => {
    if (!normalizedMapData || !labelData) return;
    resetHover();
    setRegionSourceData(normalizedMapData, labelData);
  }, [labelData, normalizedMapData, resetHover, setRegionSourceData]);

  useEffect(() => {
    setSchoolSourceData(schoolData);
  }, [schoolData, setSchoolSourceData]);

  useEffect(() => {
    syncSeaWatercolorLayer(drill.level === "country");
  }, [drill.level, mapReady, syncSeaWatercolorLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mapData) return;
    const bounds = drill.level === "country" ? CHINA_VIEW_BOUNDS : boundsFromGeoJson(mapData);
    const frame = window.requestAnimationFrame(() => {
      fitBounds(map, bounds, drill.level);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [drill.level, mapData, mapReady]);

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
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = (event: MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ["region-fill", "school-points"],
      });
      if (hits.length > 0) return;
      setHoverInfo(null);
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

    const handleSchoolMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const name = featureName(feature);
      if (name) {
        setHoverInfo({
          kind: "school",
          x: event.point.x,
          y: event.point.y,
          name,
          province: featureString(feature, "province"),
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
      className={`china-map-stage ${
        drill.level === "country" ? "china-map-stage-country" : "china-map-stage-local"
      } relative h-full w-full overflow-hidden`}
      role="figure"
      aria-label={EMPTY_MESSAGES.map}
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
        <div className="pointer-events-none absolute right-4 top-3 z-20 max-w-[220px] rounded-md border border-border bg-neutral-0/76 px-3 py-2 text-xs text-text shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{currentProvince}</span>
            <span className="text-text-muted">{currentProvinceCount} 所</span>
          </div>
        </div>
      )}

      {!mapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-text-secondary">
          {EMPTY_MESSAGES.loadingMap}
        </div>
      )}

      <div ref={mapContainerRef} className="china-map-maplibre h-full w-full" />

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
            <span>{hoverInfo.province}</span>
            {tierStyle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tierStyle.color }}
                  />
                  {tierStyle.label}
                </span>
              </>
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
