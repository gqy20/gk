import type { School } from "@/lib/data";

export async function fetchSchoolDetail(schoolName: string): Promise<School | null> {
  const trimmed = schoolName.trim();
  if (!trimmed) return null;

  // 通过 API Route 代理读取，避免 Next.js 开发服务器无法处理中文文件名静态文件的 400 问题
  const response = await fetch(`/api/school-detail/${encodeURIComponent(trimmed)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as School;
}

export function mergeSchoolDetail(schools: School[], detailSchool: School): School[] {
  return schools.map((school) =>
    school.name === detailSchool.name ? { ...school, ...detailSchool } : school,
  );
}
