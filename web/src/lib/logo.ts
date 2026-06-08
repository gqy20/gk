/**
 * 校徽 URL 工具函数
 *
 * 所有校徽存放在 /logos/ 目录下，命名格式为 {学校名}.jpg 或 {学校名}.png。
 * - 含中文括号的名称需 encodeURIComponent（如 华北电力大学（保定））
 * - 扩展名不一致：118 个 .jpg + 30 个 .png，优先尝试 .jpg 再 fallback 到 .png
 */

const LOGO_BASE_PATH = "/logos";

/** 获取校徽的候选 URL 列表（按优先级排序：jpg > png） */
export function getLogoFallbackUrls(schoolName: string): string[] {
  const encoded = encodeURIComponent(schoolName);
  return [`${LOGO_BASE_PATH}/${encoded}.jpg`, `${LOGO_BASE_PATH}/${encoded}.png`];
}

/** 获取校徽主 URL（优先 jpg）。调用方应配合 onError fallback 到 png */
export function getLogoUrl(schoolName: string): string {
  return getLogoFallbackUrls(schoolName)[0];
}
