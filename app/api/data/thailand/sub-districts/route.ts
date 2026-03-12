import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type SubDistrictRow = {
  id: number;
  name_th: string;
  name_en: string;
  district_id: number;
  zip_code: number;
  deleted_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const districtId = searchParams.get("district_id");
    if (districtId === null || districtId === "") {
      return NextResponse.json(
        { error: "ต้องส่ง district_id" },
        { status: 400 }
      );
    }
    const did = Number(districtId);
    if (!Number.isInteger(did) || did < 1) {
      return NextResponse.json(
        { error: "district_id ไม่ถูกต้อง" },
        { status: 400 }
      );
    }
    const path = join(process.cwd(), "data", "sub_district.json");
    const raw = readFileSync(path, "utf-8");
    const list = JSON.parse(raw) as SubDistrictRow[];
    const items = list
      .filter((s) => !s.deleted_at && s.district_id === did)
      .map((s) => ({
        id: s.id,
        name_th: s.name_th,
        name_en: s.name_en,
        zip_code: s.zip_code,
      }));
    return NextResponse.json({ sub_districts: items });
  } catch (e) {
    console.error("thailand/sub-districts:", e);
    return NextResponse.json(
      { error: "โหลดรายการตำบล/แขวงไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
