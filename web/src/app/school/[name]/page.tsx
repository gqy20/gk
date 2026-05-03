import fs from "node:fs";
import path from "node:path";
import type { School } from "@/lib/data";
import SchoolDetailClient from "./SchoolDetailClient";

export async function generateStaticParams(): Promise<{ name: string }[]> {
  const filePath = path.join(process.cwd(), "public/data/schools.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return (raw.schools || []).map((s: School) => ({
    name: encodeURIComponent(s.name),
  }));
}

interface PageProps {
  params: { name: string };
}

export default async function SchoolDetailPage({ params }: PageProps) {
  const resolved = await params;
  const rawName = await resolved.name;
  const decodedName = decodeURIComponent(rawName);
  const filePath = path.join(process.cwd(), "public/data/schools.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const school = (raw.schools || []).find((s: School) => s.name === decodedName) || null;

  if (!school) {
    console.error("[DEBUG] rawName:", JSON.stringify(rawName), "decodedName:", JSON.stringify(decodedName), "type:", typeof rawName);
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-sm text-dark-200">
        <div className="text-center">
          <p className="mb-4 text-lg">学校未找到</p>
          <p className="mb-2 text-xs text-dark-400">debug: {decodedName} (raw: {String(rawName)})</p>
          <a href="/" className="text-gold-500 underline">
            返回首页
          </a>
        </div>
      </div>
    );
  }

  return <SchoolDetailClient school={school} />;
}
