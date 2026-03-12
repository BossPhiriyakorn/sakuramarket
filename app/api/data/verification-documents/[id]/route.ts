import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { updateVerificationDocStatus, setShopVerificationStatus } from "@/lib/api/dbStore";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { id: docId } = await params;
    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status : "";
    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "status ต้องเป็น approved หรือ rejected" }, { status: 400 });
    }
    const review_notes = typeof body.review_notes === "string" ? body.review_notes.trim() : undefined;
    const doc = await updateVerificationDocStatus(docId, status, review_notes);
    if (!doc) {
      return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });
    }
    const shopStatus = status === "approved" ? "verified" : "rejected";
    await setShopVerificationStatus(doc.shop_id, shopStatus);
    return NextResponse.json({ ok: true, verification_status: shopStatus });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
