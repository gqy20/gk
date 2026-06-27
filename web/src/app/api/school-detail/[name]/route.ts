import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const DETAIL_DIR = path.resolve(
  process.cwd(),
  "public/data/school-details",
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  // name 来自 URL 路径段，Next.js 已自动 decode %XX 编码为中文
  // 但磁盘文件名是 encodeURIComponent 后的格式（如 %E5%8C%97...），需重新编码
  const safeName = name.replace(/\./g, "").replace(/\//g, "");
  if (!safeName) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const encodedName = encodeURIComponent(safeName);
  const filePath = path.join(DETAIL_DIR, `${encodedName}.json`);

  try {
    const data = await readFile(filePath, "utf-8");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(null, { status: 404 });
  }
}
