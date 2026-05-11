/** 阳光高考专业库数据类型 */

export interface MajorTabs {
  [key: string]: string;
}

export interface Major {
  zydm: string;
  zymc: string;
  specId: string;
  list_satisfaction: string;
  has_interpretation: boolean;
  zyl_name: string;
  tabs: MajorTabs;
  detail_url: string;
  graduate_scale: string;
  employment_url: string;
}

export interface MajorClass {
  key: string;
  name: string;
  专业: Major[];
}

export interface MajorCategory {
  key: string;
  name: string;
  门类: {
    key: string;
    name: string;
    专业类: MajorClass[];
    major_count: number;
  }[];
}

export interface MajorsData {
  crawl_time: string;
  source: string;
  categories: MajorCategory[];
}
