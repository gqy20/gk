import fs from "node:fs";
import path from "node:path";
import type { School } from "@/lib/data";
import { EMPTY_MESSAGES } from "@/lib/constants";
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
  // output: "export" 模式下 Next.js 会二次编码 params，需要解码两次
  const decodedName = decodeURIComponent(decodeURIComponent(rawName));
  const filePath = path.join(process.cwd(), "public/data/schools.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const school = (raw.schools || []).find((s: School) => s.name === decodedName) || null;

  if (!school) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-sm text-dark-200">
        <div className="text-center">
          <p className="mb-4 text-lg">{EMPTY_MESSAGES.schoolNotFound}</p>
          <a href="/" className="text-gold-500 underline">
            {EMPTY_MESSAGES.backHome}
          </a>
        </div>
      </div>
    );
  }

  return <SchoolDetailClient school={school} />;
}
