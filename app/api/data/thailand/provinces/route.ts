import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type ProvinceRow = {
  id: number;
  name_th: string;
  name_en: string;
  deleted_at: string | null;
};

export async function GET() {
  try {
    const path = join(process.cwd(), "data", "province.json");
    const raw = readFileSync(path, "utf-8");
    const list = JSON.parse(raw) as ProvinceRow[];
    const items = list
      .filter((p) => !p.deleted_at)
      .map((p) => ({ id: p.id, name_th: p.name_th, name_en: p.name_en }));
    return NextResponse.json({ provinces: items });
  } catch (e) {
    console.error("thailand/provinces:", e);
    return NextResponse.json(
      { error: "โหลดรายการจังหวัดไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
