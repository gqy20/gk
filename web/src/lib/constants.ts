/**
 * 全局字符串常量 — 消除硬编码重复，统一文案
 * 所有中文字符串、图标符号、标签定义集中管理
 */

/** 采集状态标签 */
export const STATUS_LABELS = {
  done: "已采集",
  pending: "待采集",
} as const;

/** 概览区统计卡片标签 */
export const STAT_LABELS = {
  infoComplete: "信息完整度",
  college: "学院",
  unit: "个",
} as const;

/** 基础信息卡片图标（替代 emoji） */
export const BASIC_INFO_ICONS = {
  address: { icon: "pin", label: "地址" },
  phone: { icon: "phone", label: "电话" },
  website: { icon: "globe", label: "招生网站" },
} as const;

/** 来源类型显示名称 */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  ZHIHU_HIGH: "知乎精选",
  ZHIHU_NORMAL: "知乎",
  OFFICIAL_EDU: "官网",
  NEWS: "新闻",
  GAOKAO_GOV: "高考网",
  XIAOHONGSHU: "小红书",
  BILIBILI: "B站",
  TIEBA: "贴吧",
  DOUYIN: "抖音",
  OTHER: "其他",
};

/** 空状态提示文案 */
export const EMPTY_MESSAGES = {
  noMatch: "未找到匹配结果",
  noMatchHint: "尝试其他关键词或清空搜索",
  selectCategory: "选择左侧门类开始浏览",
  categoryHint: "共 个专业分布在 13 个门类中",
  noData: "暂无数据",
  noSchools: "没有匹配的高校",
  loadingMap: "地图加载中",
  map: "高校分布交互式地图",
  clickPoiCategory: "点击上方分类查看周边信息",
  searchingPoi: "搜索中...",
  schoolNotFound: "学校未找到",
  backHome: "返回首页",
  detailNotReady: "详情数据未完成",
  selectSchool: "选择学校查看详情",
} as const;

/** ARIA 标签 */
export const ARIA_LABELS = {
  map: "高校分布交互式地图",
  mapSection: "高校地图",
  listSection: "高校列表与详情",
  searchSchool: "搜索学校、省份或官方域名",
  majorList: "专业列表",
  majorTree: "专业分类",
  comparePanel: "学校对比面板",
  closePopup: "关闭弹窗",
  backToMap: "返回地图",
  toggleCompare: "加入对比",
  removeCompare: "取消对比",
  compareFull: "已满 所，先移除一个",
  mobileViewDetail: "切换到详情视图",
  mobileViewMap: "切换到地图视图",
} as const;
