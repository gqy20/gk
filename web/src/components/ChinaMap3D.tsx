"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import { colors } from "@/lib/theme";
import type { ProvinceData, School } from "@/lib/data";
import { SCHOOL_TIER_STYLES, getProvincePalette } from "@/lib/map-style";
import {
  INITIAL_DRILL_STATE,
  MAP_NAME_TO_PROVINCE,
  type DrillState,
  type MapLevel,
  getProvinceAdcode,
} from "@/lib/map-drill";
import SchoolPopup from "./SchoolPopup";

interface ChinaMap3DProps {
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
type Bounds = [number, number, number, number];

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

type MapHoverInfo =
  | { kind: "region"; x: number; y: number; name: string; count: number }
  | { kind: "school"; x: number; y: number; name: string; tier: string };

type Projector = {
  bounds: Bounds;
  scale: number;
  centerX: number;
  centerY: number;
  project: (position: Position) => THREE.Vector2;
};

type RegionMesh = THREE.Group & {
  userData: {
    kind: "region";
    name: string;
    shortName: string;
    adcode: string | null;
    count: number;
    baseY: number;
    selected: boolean;
    topMaterials: THREE.Material[];
  };
};

type SchoolMesh = THREE.Mesh & {
  userData: {
    kind: "school";
    school: School;
    tier: string;
    highlighted: boolean;
    baseScale: number;
  };
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

const CHINA_BOUNDS: Bounds = [73, 17, 135.5, 54.5];
const SCENE_WIDTH = 18;
const PAPER_DEPTH = 0.18;
const REGION_RAISE = 0.22;
const SCHOOL_Y = 0.34;
const HIDDEN_REGION_LABELS = new Set(["香港", "澳门", "香港特别行政区", "澳门特别行政区"]);

const reusableVector = new THREE.Vector3();

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

  if (!Number.isFinite(west + south + east + north)) return CHINA_BOUNDS;
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

function createProjector(bounds: Bounds, width = SCENE_WIDTH): Projector {
  const [west, south, east, north] = bounds;
  const mapWidth = east - west || 1;
  const mapHeight = north - south || 1;
  const scale = width / Math.max(mapWidth, mapHeight * 1.1);
  const centerX = (west + east) / 2;
  const centerY = (south + north) / 2;
  return {
    bounds,
    scale,
    centerX,
    centerY,
    project: ([lng, lat]) => new THREE.Vector2((lng - centerX) * scale, -(lat - centerY) * scale),
  };
}

function ringArea(points: THREE.Vector2[]) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x * points[i].y) - (points[i].x * points[j].y);
  }
  return area / 2;
}

function toRings(value: unknown): number[][][] | null {
  return Array.isArray(value) ? value as number[][][] : null;
}

function toPolygons(value: unknown): number[][][][] | null {
  return Array.isArray(value) ? value as number[][][][] : null;
}

function shapeFromPolygon(polygon: number[][][], projector: Projector): THREE.Shape | null {
  const outer = simplifyRing(polygon[0]);
  if (!outer || outer.length < 4) return null;
  let outerPoints = outer.map((point) => projector.project([point[0], point[1]]));
  if (ringArea(outerPoints) < 0) outerPoints = outerPoints.reverse();
  const shape = new THREE.Shape(outerPoints);

  for (const rawHole of polygon.slice(1)) {
    const hole = simplifyRing(rawHole);
    if (hole.length < 4) continue;
    let holePoints = hole.map((point) => projector.project([point[0], point[1]]));
    if (ringArea(holePoints) > 0) holePoints = holePoints.reverse();
    shape.holes.push(new THREE.Path(holePoints));
  }

  return shape;
}

function simplifyRing(ring?: number[][]): number[][] {
  if (!ring) return [];
  if (ring.length <= 360) return ring;
  const step = Math.ceil(ring.length / 360);
  const simplified = ring.filter((_, index) => index % step === 0);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    simplified.push(first);
  }
  return simplified;
}

function shapesFromFeature(feature: GeoJsonFeature, projector: Projector) {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const polygon = toRings(geometry.coordinates);
    const shape = polygon ? shapeFromPolygon(polygon, projector) : null;
    return shape ? [shape] : [];
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = toPolygons(geometry.coordinates);
    if (!polygons) return [];
    return polygons.map((polygon) => shapeFromPolygon(polygon, projector)).filter(Boolean) as THREE.Shape[];
  }
  return [];
}

function linePointsFromFeature(feature: GeoJsonFeature, projector: Projector) {
  const geometry = feature.geometry;
  if (!geometry) return [];
  const polygons = geometry.type === "Polygon"
    ? [toRings(geometry.coordinates)].filter(Boolean) as number[][][][]
    : toPolygons(geometry.coordinates) ?? [];
  return polygons.flatMap((polygon) => {
    const outer = simplifyRing(polygon[0]);
    if (outer.length < 2) return [];
    return [outer.map((point) => {
      const projected = projector.project([point[0], point[1]]);
      return new THREE.Vector3(projected.x, 0.04, projected.y);
    })];
  });
}

function normalizeRegionFeature(
  feature: GeoJsonFeature,
  provinces: ProvinceData[],
  selectedProvince: string | null,
  schools: School[],
  level: MapLevel,
) {
  const countByProvince = new Map(provinces.map((province) => [province.name, province.count]));
  const mapName = String(feature.properties.name || "");
  const shortName = shortProvinceName(mapName) || mapName;
  return {
    mapName,
    shortName,
    adcode: feature.properties.adcode == null ? null : String(feature.properties.adcode),
    count: level === "country" ? countByProvince.get(shortName) ?? 0 : countSchoolsInFeature(feature, schools),
    selected: selectedProvince === shortName,
    palette: getProvincePalette(shortName),
  };
}

function countSchoolsInFeature(feature: GeoJsonFeature, schools: School[]) {
  const geometry = feature.geometry;
  if (!geometry) return 0;
  return schools.filter((school) => pointInGeometry(school.coord, geometry)).length;
}

function pointInGeometry(point: Position, geometry: GeoJsonGeometry): boolean {
  if (geometry.type === "Polygon") {
    const polygon = toRings(geometry.coordinates);
    return polygon ? pointInPolygon(point, polygon) : false;
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = toPolygons(geometry.coordinates);
    return polygons ? polygons.some((polygon) => pointInPolygon(point, polygon)) : false;
  }
  return false;
}

function pointInPolygon(point: Position, polygon: number[][][]): boolean {
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

function pointInRing(point: Position, ring: number[][]): boolean {
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

function colorToMaterial(color: string, opacity = 0.9, lit = true) {
  const base = {
    color: new THREE.Color(color),
    transparent: opacity < 1,
    opacity,
  };
  if (!lit) {
    return new THREE.MeshBasicMaterial({
      ...base,
      depthWrite: opacity >= 1,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
  }
  return new THREE.MeshStandardMaterial({
    ...base,
    roughness: 0.82,
    metalness: 0,
  });
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

function schoolScale(school: School, highlighted: boolean) {
  if (!highlighted) return 0.055;
  if (school.is985) return 0.16;
  if (school.is211) return 0.13;
  if (school.isDoubleFirstClass) return 0.11;
  return 0.085;
}

function makeTextSprite(text: string, options: { fontSize?: number; color?: string; stroke?: string } = {}) {
  const fontSize = options.fontSize ?? 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `600 ${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width + 28);
  canvas.height = Math.ceil(fontSize + 26);
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = options.stroke ?? "rgba(48, 62, 58, 0.34)";
  ctx.fillStyle = options.color ?? "rgba(255,255,250,0.96)";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width / 190, canvas.height / 190, 1);
  return sprite;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function screenPoint(
  object: THREE.Object3D,
  camera: THREE.Camera,
  rect: DOMRect,
) {
  reusableVector.setFromMatrixPosition(object.matrixWorld);
  reusableVector.project(camera);
  return {
    x: (reusableVector.x * 0.5 + 0.5) * rect.width,
    y: (-reusableVector.y * 0.5 + 0.5) * rect.height,
  };
}

export default function ChinaMap3D({
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
}: ChinaMap3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const mapGroupRef = useRef<THREE.Group | null>(null);
  const seaMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const regionMeshesRef = useRef<RegionMesh[]>([]);
  const schoolMeshesRef = useRef<SchoolMesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const projectorRef = useRef<Projector>(createProjector(CHINA_BOUNDS));
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRegionRef = useRef<RegionMesh | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [mapData, setMapData] = useState<GeoJsonFeatureCollection | null>(null);
  const [drill, setDrill] = useState<DrillState>(INITIAL_DRILL_STATE);
  const [hoverInfo, setHoverInfo] = useState<MapHoverInfo | null>(null);

  const currentProvince =
    drill.level === "country"
      ? selectedProvince
      : MAP_NAME_TO_PROVINCE[drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name] || selectedProvince;

  const visibleSchools = useMemo(() => {
    if (drill.level === "country") return schools;
    if (!currentProvince) return schools;
    return schools.filter((school) => school.province === currentProvince);
  }, [currentProvince, drill.level, schools]);

  const highlightedSchoolNames = useMemo(
    () => new Set(highlightedSchools.map((school) => school.name)),
    [highlightedSchools],
  );

  const loadMapData = useCallback(async (adcode: string) => {
    const url = adcode === "100000" ? "/china.json" : `/maps/${adcode}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load map data: ${url}`);
    return await response.json() as GeoJsonFeatureCollection;
  }, []);

  const renderScene = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  }, []);

  const fitCameraToMap = useCallback((level: MapLevel) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const mapGroup = mapGroupRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1);

    let viewCenter = new THREE.Vector3();
    let boundsWidth = 0;
    let boundsHeight = 0;
    const box = level !== "country" && mapGroup && mapGroup.children.length > 0
      ? new THREE.Box3().setFromObject(mapGroup)
      : null;

    if (box && !box.isEmpty()) {
      const worldCenter = new THREE.Vector3();
      box.getCenter(worldCenter);
      camera.position.set(worldCenter.x, 14.8, worldCenter.z + 5.8);
      camera.lookAt(worldCenter.x, worldCenter.y, worldCenter.z);
      camera.updateMatrixWorld(true);

      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ].map((point) => point.applyMatrix4(camera.matrixWorldInverse));

      const minX = Math.min(...corners.map((point) => point.x));
      const maxX = Math.max(...corners.map((point) => point.x));
      const minY = Math.min(...corners.map((point) => point.y));
      const maxY = Math.max(...corners.map((point) => point.y));
      viewCenter = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0);
      boundsWidth = maxX - minX;
      boundsHeight = maxY - minY;
    } else {
      const projector = projectorRef.current;
      const [west, south, east, north] = projector.bounds;
      const northWest = projector.project([west, north]);
      const southEast = projector.project([east, south]);
      const worldCenter = new THREE.Vector3((northWest.x + southEast.x) / 2, 0, (northWest.y + southEast.y) / 2);
      camera.position.set(worldCenter.x, 14.8, worldCenter.z + 5.8);
      camera.lookAt(worldCenter.x, 0, worldCenter.z);
      camera.updateMatrixWorld(true);
      boundsWidth = Math.abs(southEast.x - northWest.x);
      boundsHeight = Math.abs(southEast.y - northWest.y);
    }

    const padding = level === "country" ? 1.06 : 1.16;
    const fitHeight = Math.max(boundsHeight * padding, (boundsWidth * padding) / Math.max(aspect, 0.1), 3.8);
    const fitWidth = fitHeight * aspect;

    camera.left = viewCenter.x - fitWidth / 2;
    camera.right = viewCenter.x + fitWidth / 2;
    camera.top = viewCenter.y + fitHeight / 2;
    camera.bottom = viewCenter.y - fitHeight / 2;
    camera.updateProjectionMatrix();
  }, []);

  const resizeScene = useCallback(() => {
    const container = containerRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!container || !renderer || !camera) return;
    const rect = container.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setDrawingBufferSize(rect.width, rect.height, pixelRatio);
    renderer.setViewport(0, 0, rect.width, rect.height);
    fitCameraToMap(drill.level);
    renderScene();
  }, [drill.level, fitCameraToMap, renderScene]);

  const clearMapGroup = useCallback(() => {
    const mapGroup = mapGroupRef.current;
    if (!mapGroup) return;
    for (const child of [...mapGroup.children]) {
      mapGroup.remove(child);
      disposeObject(child);
    }
    regionMeshesRef.current = [];
    schoolMeshesRef.current = [];
  }, []);

  const buildRegions = useCallback((data: GeoJsonFeatureCollection, level: MapLevel) => {
    const mapGroup = mapGroupRef.current;
    if (!mapGroup) return;
    const projector = createProjector(level === "country" ? CHINA_BOUNDS : boundsFromGeoJson(data));
    projectorRef.current = projector;
    const parentProvince = drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name;
    const parentPalette = level === "country"
      ? null
      : getProvincePalette(MAP_NAME_TO_PROVINCE[parentProvince] || shortProvinceName(parentProvince) || currentProvince || "");

    data.features.forEach((feature) => {
      const meta = normalizeRegionFeature(feature, provinces, selectedProvince, visibleSchools, level);
      const shapes = shapesFromFeature(feature, projector);
      const outlinePoints = linePointsFromFeature(feature, projector);
      if (shapes.length === 0 && outlinePoints.length === 0) return;

      const palette = parentPalette ?? meta.palette;
      const fillColor = meta.selected ? palette.selectedFill : palette.fill;
      const topMaterial = colorToMaterial(fillColor, level === "country" ? 0.88 : 0.94, false);
      const localBaseMaterial = level === "country"
        ? null
        : colorToMaterial("rgba(255, 250, 240, 0.74)", 0.74, false);
      const sideMaterial = colorToMaterial("rgba(82, 105, 98, 0.72)", 0.9);
      const group = new THREE.Group() as RegionMesh;
      group.userData = {
        kind: "region",
        name: meta.mapName,
        shortName: meta.shortName,
        adcode: meta.adcode,
        count: meta.count,
        selected: meta.selected,
        baseY: 0,
        topMaterials: [topMaterial],
      };

      for (const shape of shapes) {
        const geometry = level === "country"
          ? new THREE.ExtrudeGeometry(shape, {
              depth: PAPER_DEPTH,
              bevelEnabled: true,
              bevelThickness: 0.025,
              bevelSize: 0.025,
              bevelSegments: 1,
              curveSegments: 2,
            })
          : new THREE.ShapeGeometry(shape);
        geometry.rotateX(Math.PI / 2);
        if (localBaseMaterial) {
          const baseMesh = new THREE.Mesh(geometry.clone(), localBaseMaterial);
          baseMesh.position.y = -0.012;
          baseMesh.receiveShadow = true;
          baseMesh.userData = group.userData;
          group.add(baseMesh);
        }
        const mesh = new THREE.Mesh(geometry, level === "country" ? [topMaterial, sideMaterial] : topMaterial);
        mesh.castShadow = level === "country";
        mesh.receiveShadow = true;
        mesh.userData = group.userData;
        group.add(mesh);
      }

      if (level !== "country") {
        for (const points of outlinePoints) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color: new THREE.Color(palette.edge), transparent: true, opacity: 0.68 }),
          );
          line.userData = group.userData;
          group.add(line);
        }
      }

      const center = centroidFromFeature(feature);
      if (center && !HIDDEN_REGION_LABELS.has(meta.shortName) && !HIDDEN_REGION_LABELS.has(meta.mapName)) {
        const label = makeTextSprite(meta.shortName, {
          fontSize: level === "country" ? 42 : 38,
          color: level === "country" ? undefined : palette.label,
          stroke: level === "country" ? undefined : palette.halo,
        });
        if (label) {
          const position = projector.project(center);
          label.position.set(position.x, (level === "country" ? PAPER_DEPTH : 0.02) + 0.09, position.y);
          label.renderOrder = 2;
          group.add(label);
        }
      }

      mapGroup.add(group);
      regionMeshesRef.current.push(group);
    });
  }, [provinces, selectedProvince, visibleSchools]);

  const buildSchools = useCallback(() => {
    const mapGroup = mapGroupRef.current;
    if (!mapGroup) return;
    const projector = projectorRef.current;

    for (const school of visibleSchools) {
      const matchesFilter = !hasActiveMapFilters || highlightedSchoolNames.has(school.name);
      const highlighted = matchesFilter && (!selectedProvince || school.province === selectedProvince);
      const scale = schoolScale(school, highlighted);
      const tier = schoolTier(school);
      const position = projector.project(school.coord);
      const color = new THREE.Color(schoolColor(school, selectedProvince, highlighted));

      const geometry = new THREE.CylinderGeometry(scale * 0.74, scale * 0.8, scale * 0.12, 28);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0,
        transparent: !highlighted,
        opacity: highlighted ? 1 : 0.18,
      });
      const marker = new THREE.Mesh(geometry, material) as unknown as SchoolMesh;
      marker.position.set(position.x, SCHOOL_Y, position.y);
      marker.castShadow = true;
      marker.userData = { kind: "school", school, tier, highlighted, baseScale: scale };
      mapGroup.add(marker);
      schoolMeshesRef.current.push(marker);

      if (highlighted) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(scale * 1.05, scale * 0.08, 8, 28),
          new THREE.MeshBasicMaterial({ color: "rgba(255,250,240,0.98)" }),
        );
        ring.position.set(position.x, SCHOOL_Y + 0.01, position.y);
        ring.rotation.x = Math.PI / 2;
        mapGroup.add(ring);
      }
    }
  }, [hasActiveMapFilters, highlightedSchoolNames, selectedProvince, visibleSchools]);

  const rebuildMap = useCallback((data: GeoJsonFeatureCollection, level: MapLevel) => {
    setMapReady(false);
    if (seaMaterialRef.current) {
      seaMaterialRef.current.opacity = level === "country" ? 0.3 : 0.16;
    }
    clearMapGroup();
    buildRegions(data, level);
    buildSchools();
    setMapReady(true);
    window.requestAnimationFrame(() => {
      fitCameraToMap(level);
      renderScene();
    });
  }, [buildRegions, buildSchools, clearMapGroup, fitCameraToMap, renderScene]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || rendererRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#cfe9e2");
    scene.fog = new THREE.Fog("#cfe9e2", 20, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 80);
    camera.position.set(0, 14.8, 5.8);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.HemisphereLight("#fff7e8", "#7ca89d", 2.2);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff7e4", 3.4);
    sun.position.set(-6, 12, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const seaTexture = new THREE.TextureLoader().load("/textures/sea-wash.webp", () => {
      renderScene();
    });
    seaTexture.colorSpace = THREE.SRGBColorSpace;
    seaTexture.wrapS = THREE.ClampToEdgeWrapping;
    seaTexture.wrapT = THREE.ClampToEdgeWrapping;
    const seaMaterial = new THREE.MeshBasicMaterial({
      map: seaTexture,
      color: new THREE.Color("#fffaf0"),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    seaMaterialRef.current = seaMaterial;
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 24, 1, 1),
      seaMaterial,
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.08;
    sea.receiveShadow = true;
    scene.add(sea);

    const mapGroup = new THREE.Group();
    mapGroup.rotation.x = -0.04;
    mapGroup.rotation.z = -0.025;
    scene.add(mapGroup);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    mapGroupRef.current = mapGroup;

    const observer = new ResizeObserver(resizeScene);
    observer.observe(container);
    resizeScene();

    return () => {
      observer.disconnect();
      clearMapGroup();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      mapGroupRef.current = null;
      seaMaterialRef.current = null;
    };
  }, [clearMapGroup, resizeScene]);

  useEffect(() => {
    resizeScene();
  }, [drill.level, resizeScene]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialMap() {
      try {
        const data = await loadMapData("100000");
        if (cancelled) return;
        setMapData(data);
        setDrill(INITIAL_DRILL_STATE);
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
    if (!mapData) return;
    const id = window.requestAnimationFrame(() => {
      rebuildMap(mapData, drill.level);
    });
    return () => window.cancelAnimationFrame(id);
  }, [drill.level, hasActiveMapFilters, highlightedSchoolNames, mapData, rebuildMap, selectedProvince]);

  const drillDown = useCallback(async (name: string, adcode: string) => {
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
        const province = MAP_NAME_TO_PROVINCE[name] || shortProvinceName(name) || name;
        onProvinceSelect(province);
      }
    } catch {
      console.warn(`[ChinaMap3D] Failed to load map: ${adcode}`);
    } finally {
      setLoadingDrill(false);
    }
  }, [drill.level, loadMapData, onProvinceSelect]);

  const resetToCountry = useCallback(async () => {
    setLoadingDrill(true);
    try {
      const data = await loadMapData("100000");
      setMapData(data);
      setDrill(INITIAL_DRILL_STATE);
      onProvinceSelect(null);
      onSchoolPreview(null);
    } catch {
      console.warn("[ChinaMap3D] Failed to restore country map");
    } finally {
      setLoadingDrill(false);
    }
  }, [loadMapData, onProvinceSelect, onSchoolPreview]);

  useEffect(() => {
    if (selectedProvince || drill.level === "country" || loadingDrill) return;
    const id = window.setTimeout(() => {
      void resetToCountry();
    }, 0);
    return () => window.clearTimeout(id);
  }, [drill.level, loadingDrill, resetToCountry, selectedProvince]);

  const pickObject = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return null;
    const rect = container.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    const objects: THREE.Object3D[] = [
      ...schoolMeshesRef.current,
      ...regionMeshesRef.current.flatMap((region) => region.children.filter((child) => child instanceof THREE.Mesh)),
    ];
    return raycasterRef.current.intersectObjects(objects, false)[0]?.object ?? null;
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const object = pickObject(event);
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    if (!object) {
      if (hoveredRegionRef.current) {
        hoveredRegionRef.current.position.y = hoveredRegionRef.current.userData.baseY;
        hoveredRegionRef.current = null;
      }
      setHoverInfo(null);
      container.style.cursor = "";
      renderScene();
      return;
    }

    const data = object.userData;
    const rect = container.getBoundingClientRect();
    if (data.kind === "school") {
      const schoolObject = object as SchoolMesh;
      const point = screenPoint(schoolObject, camera, rect);
      setHoverInfo({
        kind: "school",
        x: point.x,
        y: point.y,
        name: data.school.name,
        tier: data.tier,
      });
      container.style.cursor = "pointer";
      return;
    }

    if (data.kind === "region") {
      const region = regionMeshesRef.current.find((item) => item.userData.name === data.name);
      if (region && region !== hoveredRegionRef.current) {
        if (hoveredRegionRef.current) {
          hoveredRegionRef.current.position.y = hoveredRegionRef.current.userData.baseY;
        }
        region.position.y = REGION_RAISE;
        hoveredRegionRef.current = region;
      }
      const point = screenPoint(object, camera, rect);
      setHoverInfo({
        kind: "region",
        x: point.x,
        y: point.y,
        name: data.shortName || data.name,
        count: data.count ?? 0,
      });
      container.style.cursor = "pointer";
      renderScene();
    }
  }, [pickObject, renderScene]);

  const handlePointerLeave = useCallback(() => {
    if (hoveredRegionRef.current) {
      hoveredRegionRef.current.position.y = hoveredRegionRef.current.userData.baseY;
      hoveredRegionRef.current = null;
    }
    setHoverInfo(null);
    if (containerRef.current) containerRef.current.style.cursor = "";
    renderScene();
  }, [renderScene]);

  const handleClick = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const object = pickObject(event);
    if (!object) {
      onSchoolPreview(null);
      return;
    }
    const data = object.userData;
    if (data.kind === "school") {
      const school = data.school as School;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        onSchoolPreview(school);
      }, 180);
      return;
    }
    if (data.kind === "region") {
      if (drill.level === "country") {
        const province = shortProvinceName(data.name) || data.shortName;
        const adcode = province ? getProvinceAdcode(province) : null;
        if (province && adcode) void drillDown(mapProvinceName(province), adcode);
      }
    }
  }, [drill.level, drillDown, onSchoolPreview, pickObject]);

  const handleDoubleClick = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const object = pickObject(event);
    if (!object || object.userData.kind !== "school") return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onSchoolClick(object.userData.school as School);
  }, [onSchoolClick, pickObject]);

  return (
    <div
      className={`china-map-stage ${
        drill.level === "country" ? "china-map-stage-country" : "china-map-stage-local"
      } relative h-full w-full overflow-hidden`}
      role="figure"
      aria-label="中国高校 3D 地图"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div ref={containerRef} className="china-map-three absolute inset-0 z-20" />
      <div className="china-map-veil" />

      <AnimatePresence>
        {!mapReady && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center text-sm text-text-light-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            地图加载中
          </motion.div>
        )}
      </AnimatePresence>

      {hoverInfo && (
        <motion.div
          className="pointer-events-none absolute z-40 rounded-md border border-border/70 bg-surface/92 px-3 py-2 text-xs text-text shadow-xl shadow-neutral-900/12 backdrop-blur-md"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
        >
          {hoverInfo.kind === "region" ? (
            <>
              <div className="font-semibold">{hoverInfo.name}</div>
              <div className="mt-1 text-text-light-muted">高校 {hoverInfo.count} 所</div>
            </>
          ) : (
            <>
              <div className="font-semibold">{hoverInfo.name}</div>
              <div className="mt-1 text-text-light-muted">
                {SCHOOL_TIER_STYLES[hoverInfo.tier as keyof typeof SCHOOL_TIER_STYLES]?.label ?? "普通高校"}
              </div>
            </>
          )}
        </motion.div>
      )}

      <div className="absolute bottom-4 left-4 z-40 flex flex-wrap gap-2 rounded-md border border-border/70 bg-surface/82 p-2 shadow-lg shadow-neutral-900/10 backdrop-blur-md">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle211();
          }}
          className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium leading-none transition ${filter211 ? "bg-brand-50 text-brand-700" : "text-text-light-muted hover:bg-primary-soft"}`}
        >
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colors.chart.school211 }} />
          211
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle985();
          }}
          className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium leading-none transition ${filter985 ? "bg-accent-50 text-accent-700" : "text-text-light-muted hover:bg-primary-soft"}`}
        >
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colors.chart.school985 }} />
          985
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleDoubleFirst();
          }}
          className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium leading-none transition ${filterDoubleFirst ? "bg-primary-soft text-primary" : "text-text-light-muted hover:bg-primary-soft"}`}
        >
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colors.chart.schoolDoubleFirst }} />
          双一流
        </button>
        <span className="inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium leading-none text-text-light-muted">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colors.chart.schoolNormal }} />
          普通高校
        </span>
      </div>

      {loadingDrill && (
        <div className="absolute right-4 top-4 z-40 rounded-md border border-border/70 bg-surface/82 px-3 py-1.5 text-xs text-text-light-muted shadow-lg backdrop-blur-md">
          切换地图中
        </div>
      )}

      <AnimatePresence>
        {previewSchool && (
          <SchoolPopup
            key={previewSchool.name}
            school={previewSchool}
            onClose={() => onSchoolPreview(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
