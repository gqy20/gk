"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import type { ProvinceData, School } from "@/lib/data";
import { SCHOOL_TIER_STYLES, getMapRegionPalette } from "@/lib/map-style";
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
  onTransitionChange?: (transitioning: boolean) => void;
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
    seal: THREE.Mesh | null;
  };
};

type SchoolVisualMesh = THREE.Object3D & {
  userData: {
    kind: "schoolVisual";
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
const LOCAL_REGION_DEPTH = 0.11;
const REGION_RAISE = 0.22;
const SCHOOL_Y = 0.34;
const HIDDEN_REGION_LABELS = new Set(["香港", "澳门", "香港特别行政区", "澳门特别行政区"]);
const SCHOOL_SEAL_COLORS = {
  "985": "#d85b50",
  "211": "#c7953e",
  doubleFirst: "#3f9a73",
  normal: "#5da7b2",
} as const;

const reusableVector = new THREE.Vector3();

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

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

function linePointsFromFeature(feature: GeoJsonFeature, projector: Projector, y = 0.04) {
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
      return new THREE.Vector3(projected.x, y, projected.y);
    })];
  });
}

function normalizeRegionFeature(
  feature: GeoJsonFeature,
  provinces: ProvinceData[],
  selectedProvince: string | null,
  schools: School[],
  level: MapLevel,
  parentProvince: string | null = null,
) {
  const countByProvince = new Map(provinces.map((province) => [province.name, province.count]));
  const mapName = String(feature.properties.name || "");
  const shortName = shortProvinceName(mapName) || mapName;
  return {
    mapName,
    shortName,
    adcode: feature.properties.adcode == null ? null : String(feature.properties.adcode),
    count: level === "country" ? countByProvince.get(shortName) ?? 0 : countSchoolsInFeature(feature, schools),
    selected: level === "country" && selectedProvince === shortName,
    palette: getMapRegionPalette(shortName, level, parentProvince),
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

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function parseRgbaColor(color: string): RgbaColor {
  const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
  if (color.startsWith("rgba") || color.startsWith("rgb")) {
    return {
      r: values[0] ?? 204,
      g: values[1] ?? 226,
      b: values[2] ?? 221,
      a: values[3] ?? 1,
    };
  }

  const parsed = new THREE.Color(color);
  return {
    r: Math.round(parsed.r * 255),
    g: Math.round(parsed.g * 255),
    b: Math.round(parsed.b * 255),
    a: 1,
  };
}

function rgbaString(color: RgbaColor, alpha = color.a) {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

function threeColorFromRgba(color: RgbaColor) {
  return new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
}

function mixColor(color: RgbaColor, target: RgbaColor, amount: number): RgbaColor {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
    a: color.a + (target.a - color.a) * amount,
  };
}

function mapSceneColors(level: MapLevel) {
  return {
    background: new THREE.Color("#cfe9e2"),
    fog: new THREE.Color("#cfe9e2"),
    sea: new THREE.Color("#fffaf0"),
    seaOpacity: level === "country" ? 0.3 : 0.16,
  };
}

function colorToMaterial(color: string, opacity = 0.9, lit = true) {
  const parsedColor = parseRgbaColor(color);
  const materialOpacity = opacity * parsedColor.a;
  const base = {
    color: threeColorFromRgba(parsedColor),
    transparent: materialOpacity < 1,
    opacity: materialOpacity,
  };
  if (!lit) {
    return new THREE.MeshBasicMaterial({
      ...base,
      depthWrite: materialOpacity >= 1,
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

function createProvinceWatercolorMaterial(color: string, seed: string, opacity = 0.92) {
  const baseColor = parseRgbaColor(color);
  const paperColor: RgbaColor = { r: 255, g: 250, b: 240, a: 1 };
  const deepColor = mixColor(baseColor, { r: 45, g: 60, b: 54, a: 1 }, 0.12);
  const paleColor = mixColor(baseColor, paperColor, 0.04);
  const random = seededRandom(`province-watercolor:${seed}:${color}`);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) return colorToMaterial(color, opacity, false);

  ctx.fillStyle = rgbaString(paperColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = rgbaString(baseColor, Math.min(baseColor.a + 0.14, 1));
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 7; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 110 + random() * 210;
    const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    const washColor = random() > 0.36 ? paleColor : deepColor;
    gradient.addColorStop(0, rgbaString(washColor, 0.34 + random() * 0.18));
    gradient.addColorStop(0.62, rgbaString(washColor, 0.12 + random() * 0.08));
    gradient.addColorStop(1, rgbaString(washColor, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let index = 0; index < 34; index += 1) {
    const y = random() * canvas.height;
    const width = 90 + random() * 240;
    const x = random() * canvas.width - width * 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((random() - 0.5) * 0.38);
    ctx.fillStyle = rgbaString(random() > 0.56 ? paperColor : deepColor, 0.028 + random() * 0.04);
    ctx.fillRect(0, 0, width, 2 + random() * 8);
    ctx.restore();
  }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const grain = (random() - 0.5) * 18;
    const fiber = random() > 0.988 ? 22 : 0;
    data[index] = Math.max(0, Math.min(255, data[index] + grain + fiber));
    data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + grain + fiber));
    data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + grain + fiber));
  }
  ctx.putImageData(image, 0, 0);

  for (let index = 0; index < 46; index += 1) {
    ctx.strokeStyle = rgbaString(paperColor, 0.03 + random() * 0.06);
    ctx.lineWidth = 0.5 + random() * 1.6;
    ctx.beginPath();
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + (random() - 0.5) * 90,
      y + 40 + random() * 70,
      x + (random() - 0.5) * 120,
      y + 90 + random() * 120,
      x + (random() - 0.5) * 160,
      y + 140 + random() * 170,
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: opacity >= 1,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  material.fog = false;
  return material;
}

function applyWatercolorUv(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const position = geometry.getAttribute("position");
  if (!box || !position) return;

  const width = Math.max(box.max.x - box.min.x, 0.0001);
  const height = Math.max(box.max.z - box.min.z, 0.0001);
  const uv = new Float32Array(position.count * 2);

  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = (position.getX(index) - box.min.x) / width;
    uv[index * 2 + 1] = (position.getZ(index) - box.min.z) / height;
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function schoolTier(school: School) {
  if (school.is985) return "985";
  if (school.is211) return "211";
  if (school.isDoubleFirstClass) return "doubleFirst";
  return "normal";
}

function schoolColor(school: School, selectedProvince: string | null, highlighted: boolean): string {
  if (!highlighted || (selectedProvince && school.province !== selectedProvince)) return "rgba(117, 106, 86, 0.16)";
  if (school.is985) return SCHOOL_SEAL_COLORS["985"];
  if (school.is211) return SCHOOL_SEAL_COLORS["211"];
  if (school.isDoubleFirstClass) return SCHOOL_SEAL_COLORS.doubleFirst;
  return SCHOOL_SEAL_COLORS.normal;
}

function schoolScale(school: School, highlighted: boolean) {
  if (!highlighted) return 0.055;
  if (school.is985) return 0.18;
  if (school.is211) return 0.15;
  if (school.isDoubleFirstClass) return 0.12;
  return 0.105;
}

function drawIrregularCircle(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  random: () => number,
) {
  ctx.beginPath();
  for (let index = 0; index < 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2;
    const localRadius = radius * (0.92 + random() * 0.14);
    const x = center + Math.cos(angle) * localRadius;
    const y = center + Math.sin(angle) * localRadius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawIrregularPolygon(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  random: () => number,
  jitter = 4,
) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const nextX = x + (random() - 0.5) * jitter;
    const nextY = y + (random() - 0.5) * jitter;
    if (index === 0) ctx.moveTo(nextX, nextY);
    else ctx.lineTo(nextX, nextY);
  });
  ctx.closePath();
}

function createSchoolSealTexture(tier: string, color: string, seed: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const random = seededRandom(`school-seal:${tier}:${seed}`);
  const baseColor = parseRgbaColor(color);
  const brightColor = mixColor(baseColor, { r: 255, g: 248, b: 232, a: 1 }, tier === "normal" ? 0.1 : 0.06);
  const center = canvas.width / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.shadowColor = "rgba(55, 44, 31, 0.22)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = rgbaString(brightColor, tier === "normal" ? 0.82 : 0.88);

  if (tier === "985") {
    drawIrregularPolygon(ctx, [[34, 30], [96, 34], [92, 98], [30, 92]], random, 7);
  } else if (tier === "211") {
    drawIrregularCircle(ctx, center, 33, random);
  } else if (tier === "doubleFirst") {
    drawIrregularPolygon(ctx, [[64, 25], [101, 62], [65, 101], [27, 66]], random, 6);
  } else {
    drawIrregularCircle(ctx, center, 27, random);
  }
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.24)";
  ctx.lineCap = "round";
  for (let index = 0; index < (tier === "normal" ? 3 : 10); index += 1) {
    const x = 28 + random() * 72;
    const y = 28 + random() * 72;
    ctx.lineWidth = 1 + random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 22, y + (random() - 0.5) * 22);
    ctx.stroke();
  }
  for (let index = 0; index < (tier === "normal" ? 4 : 16); index += 1) {
    ctx.beginPath();
    ctx.arc(24 + random() * 80, 24 + random() * 80, 0.6 + random() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "rgba(255, 248, 232, 0.86)";
  ctx.lineWidth = tier === "normal" ? 3.5 : 4.5;
  if (tier === "985") {
    drawIrregularPolygon(ctx, [[34, 30], [96, 34], [92, 98], [30, 92]], random, 3);
  } else if (tier === "211") {
    drawIrregularCircle(ctx, center, 33, random);
  } else if (tier === "doubleFirst") {
    drawIrregularPolygon(ctx, [[64, 25], [101, 62], [65, 101], [27, 66]], random, 3);
  } else {
    drawIrregularCircle(ctx, center, 27, random);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSchoolSealMaterial(tier: string, color: string, seed: string, opacity: number) {
  const texture = createSchoolSealTexture(tier, color, seed);
  if (!texture) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    });
  }
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function SealLegendIcon({ tier }: { tier: "985" | "211" | "doubleFirst" | "normal" }) {
  const shapeClass = tier === "985"
    ? "rounded-[2px]"
    : tier === "doubleFirst"
      ? "rotate-45 rounded-[2px]"
      : "rounded-full";
  const sizeClass = tier === "normal" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span
      className={`inline-block shrink-0 border border-surface-elevated/80 shadow-sm shadow-neutral-900/10 ${sizeClass} ${shapeClass}`}
      style={{ background: SCHOOL_SEAL_COLORS[tier] }}
    />
  );
}

function makeTextSprite(
  text: string,
  options: { fontSize?: number; color?: string; stroke?: string; vertical?: boolean } = {},
) {
  const fontSize = options.fontSize ?? 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fontFamily = `"Songti SC", "Noto Serif CJK SC", "STKaiti", "KaiTi", serif`;
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  const chars = Array.from(text);
  const vertical = options.vertical && chars.length > 1;
  const metrics = ctx.measureText(text);
  canvas.width = vertical ? Math.ceil(fontSize + 34) : Math.ceil(metrics.width + 36);
  canvas.height = vertical ? Math.ceil(chars.length * fontSize * 1.04 + 34) : Math.ceil(fontSize + 30);
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(48, 58, 50, 0.20)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1;
  ctx.lineWidth = 5;
  ctx.strokeStyle = options.stroke ?? "rgba(58, 74, 66, 0.30)";
  ctx.fillStyle = options.color ?? "rgba(255,255,250,0.95)";

  if (vertical) {
    const startY = (canvas.height - (chars.length - 1) * fontSize * 1.04) / 2;
    chars.forEach((char, index) => {
      const y = startY + index * fontSize * 1.04;
      ctx.strokeText(char, canvas.width / 2, y);
      ctx.fillText(char, canvas.width / 2, y);
    });
  } else {
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width / 198, canvas.height / 198, 1);
  return sprite;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => {
        if ("map" in item && item.map instanceof THREE.Texture) item.map.dispose();
        item.dispose();
      });
    } else if (material) {
      if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
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
  onTransitionChange,
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
  const localProvince =
    drill.level === "country"
      ? selectedProvince
      : MAP_NAME_TO_PROVINCE[drill.breadcrumbs[1]?.name] || shortProvinceName(drill.breadcrumbs[1]?.name) || currentProvince;

  const visibleSchools = useMemo(() => {
    if (drill.level === "country") return schools;
    if (!currentProvince) return schools;
    return schools.filter((school) => school.province === currentProvince);
  }, [currentProvince, drill.level, schools]);

  const highlightedSchoolNames = useMemo(
    () => new Set(highlightedSchools.map((school) => school.name)),
    [highlightedSchools],
  );
  const syncScenePalette = useCallback((level: MapLevel) => {
    const scene = sceneRef.current;
    const seaMaterial = seaMaterialRef.current;
    const colorsForLevel = mapSceneColors(level);

    if (scene) {
      scene.background = colorsForLevel.background;
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(colorsForLevel.fog);
      }
    }
    if (seaMaterial) {
      seaMaterial.color.copy(colorsForLevel.sea);
      seaMaterial.opacity = colorsForLevel.seaOpacity;
      seaMaterial.needsUpdate = true;
    }
  }, []);

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

  const clearSchools = useCallback(() => {
    const mapGroup = mapGroupRef.current;
    if (!mapGroup) return;
    for (const child of [...mapGroup.children]) {
      if (child.userData.kind !== "school" && child.userData.kind !== "schoolVisual") {
        continue;
      }
      mapGroup.remove(child);
      disposeObject(child);
    }
    schoolMeshesRef.current = [];
  }, []);

  const buildRegions = useCallback((data: GeoJsonFeatureCollection, level: MapLevel) => {
    const mapGroup = mapGroupRef.current;
    if (!mapGroup) return;
    const projector = createProjector(level === "country" ? CHINA_BOUNDS : boundsFromGeoJson(data));
    projectorRef.current = projector;
    const parentProvince = drill.breadcrumbs[drill.breadcrumbs.length - 1]?.name;
    const regionProvince = level === "country"
      ? null
      : localProvince || MAP_NAME_TO_PROVINCE[parentProvince] || shortProvinceName(parentProvince) || currentProvince;

    data.features.forEach((feature) => {
      const meta = normalizeRegionFeature(feature, provinces, selectedProvince, visibleSchools, level, regionProvince);
      const shapes = shapesFromFeature(feature, projector);
      const regionDepth = level === "country" ? PAPER_DEPTH : LOCAL_REGION_DEPTH;
      const outlineY = regionDepth + 0.0015;
      const outlinePoints = linePointsFromFeature(feature, projector, outlineY);
      if (shapes.length === 0 && outlinePoints.length === 0) return;

      const palette = meta.palette;
      const fillColor = level === "country"
        ? meta.selected ? palette.selectedFill : palette.fill
        : palette.selectedFill;
      const topMaterial = createProvinceWatercolorMaterial(
        fillColor,
        `${level}:${meta.shortName}:${meta.mapName}`,
        level === "country" ? 0.9 : 1,
      );
      const localBaseMaterial = null;
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
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: regionDepth,
          bevelEnabled: true,
          bevelThickness: level === "country" ? 0.025 : 0.016,
          bevelSize: level === "country" ? 0.025 : 0.014,
          bevelSegments: 1,
          curveSegments: 2,
        });
        geometry.rotateX(Math.PI / 2);
        applyWatercolorUv(geometry);
        if (localBaseMaterial) {
          const baseMesh = new THREE.Mesh(geometry.clone(), localBaseMaterial);
          baseMesh.position.y = -0.012;
          baseMesh.receiveShadow = true;
          baseMesh.userData = group.userData;
          group.add(baseMesh);
        }
        const mesh = new THREE.Mesh(geometry, [topMaterial, sideMaterial]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = group.userData;
        group.add(mesh);
      }

      for (const points of outlinePoints) {
        const shadowGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const shadowColor = parseRgbaColor(level === "country" ? "rgba(65, 82, 73, 0.44)" : palette.edge);
        const shadowLine = new THREE.Line(
          shadowGeometry,
          new THREE.LineBasicMaterial({
            color: threeColorFromRgba(shadowColor),
            transparent: true,
            opacity: (level === "country" ? 0.42 : 0.58) * shadowColor.a,
          }),
        );
        shadowLine.userData = group.userData;
        group.add(shadowLine);

      }

      const center = centroidFromFeature(feature);
      if (center && !HIDDEN_REGION_LABELS.has(meta.shortName) && !HIDDEN_REGION_LABELS.has(meta.mapName)) {
        const shouldUseVerticalLabel = level === "country" && meta.shortName.length >= 2 && meta.shortName.length <= 3;
        const label = makeTextSprite(meta.shortName, {
          fontSize: level === "country" ? 38 : 36,
          color: level === "country" ? "rgba(255, 255, 250, 0.92)" : palette.label,
          stroke: level === "country" ? "rgba(54, 67, 59, 0.26)" : palette.halo,
          vertical: shouldUseVerticalLabel,
        });
        if (label) {
          const position = projector.project(center);
          label.position.set(position.x, regionDepth + 0.09, position.y);
          label.renderOrder = 2;
          group.add(label);
        }
      }

      mapGroup.add(group);
      regionMeshesRef.current.push(group);
    });
  }, [currentProvince, drill.breadcrumbs, localProvince, provinces, selectedProvince, visibleSchools]);

  /* eslint-disable react-hooks/immutability -- Three.js scene objects are updated imperatively. */
  const updateSchoolStyles = useCallback((
    highlightedNames: Set<string>,
    activeSelectedProvince: string | null,
    activeMapFilters: boolean,
  ) => {
    for (const marker of schoolMeshesRef.current) {
      const { school, tier, seal } = marker.userData;
      const matchesFilter = !activeMapFilters || highlightedNames.has(school.name);
      const highlighted = matchesFilter && (!activeSelectedProvince || school.province === activeSelectedProvince);
      const scale = schoolScale(school, highlighted);
      const markerColor = schoolColor(school, activeSelectedProvince, highlighted);
      const material = marker.material;

      marker.scale.set(scale * 0.72, scale * 0.08, scale * 0.72);

      if (material instanceof THREE.MeshBasicMaterial) {
        material.color.set(markerColor);
        material.opacity = highlighted ? 0.001 : 0.08;
        material.needsUpdate = true;
      }

      if (seal) {
        const sealSize = scale * (tier === "985" ? 1.65 : tier === "211" ? 1.52 : tier === "doubleFirst" ? 1.44 : 1.26);
        seal.visible = highlighted;
        seal.scale.set(sealSize, sealSize, 1);
      }
    }
  }, []);
  /* eslint-enable react-hooks/immutability */

  const buildSchools = useCallback((schoolsForLevel: School[]) => {
    const mapGroup = mapGroupRef.current;
    if (!mapGroup) return;
    clearSchools();
    const projector = projectorRef.current;

    for (const school of schoolsForLevel) {
      const tier = schoolTier(school);
      const position = projector.project(school.coord);
      const markerColor = schoolColor(school, null, true);

      const hitGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
      const hitMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(markerColor),
        transparent: true,
        opacity: 0.001,
      });
      const marker = new THREE.Mesh(hitGeometry, hitMaterial) as unknown as SchoolMesh;
      marker.position.set(position.x, SCHOOL_Y, position.y);
      marker.castShadow = false;
      marker.userData = { kind: "school", school, tier, highlighted: true, baseScale: 1, seal: null };
      mapGroup.add(marker);
      schoolMeshesRef.current.push(marker);

      const seal = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        createSchoolSealMaterial(tier, markerColor, school.name, 0.96),
      );
      (seal as unknown as SchoolVisualMesh).userData = { kind: "schoolVisual" };
      seal.position.set(position.x, SCHOOL_Y + 0.084, position.y);
      seal.rotation.x = -Math.PI / 2;
      seal.rotation.z = (seededRandom(`school-seal-rotation:${school.name}`)() - 0.5) * 0.34;
      seal.renderOrder = 3;
      mapGroup.add(seal);
      marker.userData.seal = seal;
    }
  }, [clearSchools]);

  const rebuildMap = useCallback((data: GeoJsonFeatureCollection, level: MapLevel) => {
    setMapReady(false);
    syncScenePalette(level);
    clearMapGroup();
    buildRegions(data, level);
    buildSchools(visibleSchools);
    updateSchoolStyles(highlightedSchoolNames, selectedProvince, hasActiveMapFilters);
    setMapReady(true);
    window.requestAnimationFrame(() => {
      fitCameraToMap(level);
      renderScene();
    });
  }, [
    buildRegions,
    buildSchools,
    clearMapGroup,
    fitCameraToMap,
    hasActiveMapFilters,
    highlightedSchoolNames,
    renderScene,
    selectedProvince,
    syncScenePalette,
    updateSchoolStyles,
    visibleSchools,
  ]);
  const rebuildMapRef = useRef(rebuildMap);

  useEffect(() => {
    rebuildMapRef.current = rebuildMap;
  }, [rebuildMap]);

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
  }, [clearMapGroup, renderScene, resizeScene]);

  useEffect(() => {
    resizeScene();
  }, [drill.level, resizeScene]);

  useEffect(() => {
    syncScenePalette(drill.level);
    renderScene();
  }, [drill.level, renderScene, syncScenePalette]);

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
      rebuildMapRef.current(mapData, drill.level);
    });
    return () => window.cancelAnimationFrame(id);
  }, [drill.level, mapData]);

  useEffect(() => {
    if (!mapData || !mapReady) return;
    const id = window.requestAnimationFrame(() => {
      updateSchoolStyles(highlightedSchoolNames, selectedProvince, hasActiveMapFilters);
      renderScene();
    });
    return () => window.cancelAnimationFrame(id);
  }, [
    hasActiveMapFilters,
    highlightedSchoolNames,
    mapData,
    mapReady,
    renderScene,
    selectedProvince,
    updateSchoolStyles,
  ]);

  const drillDown = useCallback(async (name: string, adcode: string) => {
    setLoadingDrill(true);
    onTransitionChange?.(true);
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
      onTransitionChange?.(false);
    }
  }, [drill.level, loadMapData, onProvinceSelect, onTransitionChange]);

  const resetToCountry = useCallback(async () => {
    setLoadingDrill(true);
    onTransitionChange?.(true);
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
      onTransitionChange?.(false);
    }
  }, [loadMapData, onProvinceSelect, onSchoolPreview, onTransitionChange]);

  useEffect(() => {
    if (selectedProvince || drill.level === "country" || loadingDrill) return;
    const id = window.setTimeout(() => {
      void resetToCountry();
    }, 0);
    return () => window.clearTimeout(id);
  }, [drill.level, loadingDrill, resetToCountry, selectedProvince]);

  useEffect(() => {
    if (!selectedProvince || drill.level !== "country" || loadingDrill) return;
    const adcode = getProvinceAdcode(selectedProvince);
    if (!adcode) return;
    const id = window.setTimeout(() => {
      void drillDown(mapProvinceName(selectedProvince), adcode);
    }, 0);
    return () => window.clearTimeout(id);
  }, [drill.level, drillDown, loadingDrill, selectedProvince]);

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
          <SealLegendIcon tier="211" />
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
          <SealLegendIcon tier="985" />
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
          <SealLegendIcon tier="doubleFirst" />
          双一流
        </button>
        <span className="inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium leading-none text-text-light-muted">
          <SealLegendIcon tier="normal" />
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
