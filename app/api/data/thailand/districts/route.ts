import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type DistrictRow = {
  id: number;
  name_th: string;
  name_en: string;
  province_id: number;
  deleted_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provinceId = searchParams.get("province_id");
    if (provinceId === null || provinceId === "") {
      return NextResponse.json(
        { error: "ต้องส่ง province_id" },
        { status: 400 }
      );
    }
    const pid = Number(provinceId);
    if (!Number.isInteger(pid) || pid < 1) {
      return NextResponse.json(
        { error: "province_id ไม่ถูกต้อง" },
        { status: 400 }
      );
    }
    const path = join(process.cwd(), "data", "district.json");
    const raw = readFileSync(path, "utf-8");
    const list = JSON.parse(raw) as DistrictRow[];
    const items = list
      .filter((d) => !d.deleted_at && d.province_id === pid)
      .map((d) => ({ id: d.id, name_th: d.name_th, name_en: d.name_en }));
    return NextResponse.json({ districts: items });
  } catch (e) {
    console.error("thailand/districts:", e);
    return NextResponse.json(
      { error: "โหลดรายการอำเภอ/เขตไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
