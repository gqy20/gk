/**
 * 叙事模式相机关键帧配置
 *
 * 每个 key 是全局滚动进度 (0..1)，value 定义该时刻的相机状态。
 * 相邻关键帧之间线性插值（lerp）。
 *
 * 调参说明：
 * - position: 相机世界坐标 [x, y, z]，y 为高度，z 为前后距离
 * - lookAt: 相机注视点
 * - zoom: 正交相机的缩放值（越大 = 放大越多）
 *
 * 基于当前 ChinaMap3D 默认相机 position=(0, 14.8, 5.8), zoom=1 设计
 */

export interface StoryCameraKeyframe {
  position: [number, number, number];
  lookAt: [number, number, number];
  zoom: number;
}

/** 排序后的关键帧进度点 + 数据 */
export type StoryCameraEntry = [number, StoryCameraKeyframe];

/** 完整相机关键帧时间线 */
export const STORY_CAMERA_KEYFRAMES: Record<number, StoryCameraKeyframe> = {
  // ── Phase 1: 开场远景 ──
  0.00: { position: [0, 20, 8], lookAt: [0, 0, 0], zoom: 0.75 },  // 更远的开场视角
  0.10: { position: [0, 18, 7], lookAt: [0, 0, 0], zoom: 0.85 },
  0.18: { position: [0, 16.5, 6.4], lookAt: [0, 0, 0], zoom: 0.95 },

  // ── Phase 2: 缓慢推进，标记浮现 ──
  0.22: { position: [0, 15.5, 5.9], lookAt: [0, 0, 0], zoom: 1.1 },
  0.30: { position: [0, 15, 5.8], lookAt: [0, 0, 0], zoom: 1.3 },
  0.42: { position: [0, 14.8, 5.8], lookAt: [0, 0, 0], zoom: 1.55 },

  // ── Phase 3: 继续推进 + 微移向东（高校密集区）──
  0.47: { position: [0.8, 14.8, 5.8], lookAt: [1.2, 0, 0], zoom: 1.75 },
  0.58: { position: [1.2, 14.5, 5.6], lookAt: [1.8, 0, 0], zoom: 2.0 },
  0.72: { position: [1.5, 14, 5.5], lookAt: [2, 0, 0], zoom: 2.2 },

  // ── Phase 4: 回归默认交互视角 ──
  0.78: { position: [0.8, 14.8, 5.8], lookAt: [0.5, 0, 0], zoom: 1.6 },
  0.88: { position: [0.3, 14.8, 5.8], lookAt: [0.1, 0, 0], zoom: 1.2 },
  0.95: { position: [0, 14.8, 5.8], lookAt: [0, 0, 0], zoom: 1.0 },  // 回到默认位置
  1.00: { position: [0, 14.8, 5.8], lookAt: [0, 0, 0], zoom: 1.0 },
};

/** 排序后的关键帧数组（用于二分查找插值） */
export const SORTED_CAMERA_ENTRIES: StoryCameraEntry[] = Object.entries(
  STORY_CAMERA_KEYFRAMES,
)
  .map(([k, v]): StoryCameraEntry => [Number(k), v])
  .sort((a, b) => a[0] - b[0]);

/**
 * 根据当前进度插值计算相机目标状态
 */
export function interpolateCameraTarget(
  progress: number,
): StoryCameraKeyframe {
  const entries = SORTED_CAMERA_ENTRIES;

  // 边界钳制
  if (progress <= entries[0][0]) return entries[0][1];
  if (progress >= entries[entries.length - 1][0])
    return entries[entries.length - 1][1];

  // 找到 progress 所在的区间 [entries[i], entries[i+1]]
  let lo = 0;
  let hi = entries.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 0;
    if (entries[mid][0] <= progress) lo = mid;
    else hi = mid;
  }

  const [t0, k0] = entries[lo];
  const [t1, k1] = entries[hi];
  const t = (progress - t0) / (t1 - t0); // 局部进度 0..1

  return {
    position: [
      lerp(k0.position[0], k1.position[0], t),
      lerp(k0.position[1], k1.position[1], t),
      lerp(k0.position[2], k1.position[2], t),
    ],
    lookAt: [
      lerp(k0.lookAt[0], k1.lookAt[0], t),
      lerp(k0.lookAt[1], k1.lookAt[1], t),
      lerp(k0.lookAt[2], k1.lookAt[2], t),
    ],
    zoom: lerp(k0.zoom, k1.zoom, t),
  };
}

/** 线性插值 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── 学校层级显示时机 ──

/** 各层级学校标记在叙事中开始可见的全局进度阈值 */
export const STORY_TIER_REVEAL: Record<string, number> = {
  "985": 0.22,
  "211": 0.28,
  "doubleFirst": 0.36,
  "normal": 0.44,
};

/** 所有层级名称（按显示顺序） */
export const TIER_ORDER = ["985", "211", "doubleFirst", "normal"] as const;

export type TierName = (typeof TIER_ORDER)[number];

/**
 * 根据当前进度计算应该可见的层级列表
 */
export function getVisibleTiers(progress: number): TierName[] {
  const visible: TierName[] = [];
  for (const tier of TIER_ORDER) {
    if (progress >= (STORY_TIER_REVEAL[tier] ?? 1)) {
      visible.push(tier);
    }
  }
  return visible;
}

// ── Phase 区间定义 ──

export interface StoryPhaseDef {
  id: string;
  label: string;
  start: number; // 全局进度起点
  end: number;   // 全局进度终点
}

export const STORY_PHASES: readonly StoryPhaseDef[] = [
  { id: "hero", label: "开场", start: 0, end: 0.22 },
  { id: "layers", label: "分层展示", start: 0.22, end: 0.47 },
  { id: "features", label: "功能预览", start: 0.47, end: 0.75 },
  { id: "cta", label: "行动召唤", start: 0.75, end: 1.0 },
] as const;

/**
 * 根据全局进度获取当前 phase 索引和局部进度
 */
export function getPhaseInfo(progress: number): {
  phaseIndex: number;
  phaseProgress: number;
} {
  for (let i = 0; i < STORY_PHASES.length; i++) {
    const phase = STORY_PHASES[i];
    if (progress <= phase.end) {
      const range = phase.end - phase.start;
      const local = range > 0 ? (progress - phase.start) / range : 1;
      return { phaseIndex: i, phaseProgress: Math.min(1, Math.max(0, local)) };
    }
  }
  return {
    phaseIndex: STORY_PHASES.length - 1,
    phaseProgress: 1,
  };
}
