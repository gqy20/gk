import type { School } from "@/lib/data";

export async function fetchSchoolDetail(schoolName: string): Promise<School | null> {
  const trimmed = schoolName.trim();
  if (!trimmed) return null;

  const response = await fetch(`/data/school-details/${encodeURIComponent(trimmed)}.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as School;
}

export function mergeSchoolDetail(schools: School[], detailSchool: School): School[] {
  return schools.map((school) =>
    school.name === detailSchool.name ? { ...school, ...detailSchool } : school,
  );
}
