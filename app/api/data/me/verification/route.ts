import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getUserVerification, submitUserVerificationDocument, addNotification } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ", verified: false, verified_at: null, status: null, has_document: false },
        { status: 401 }
      );
    }
    const v = await getUserVerification(payload.sub);
    const documentUrl = v?.document_url?.trim() || null;
    return NextResponse.json({
      verified: v?.verified ?? false,
      verified_at: v?.verified_at ?? null,
      status: v?.status ?? null,
      has_document: !!documentUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const idCardUrl = typeof body.id_card_url === "string" ? body.id_card_url.trim() : "";
    if (!idCardUrl) {
      return NextResponse.json({ error: "กรุณาอัปโหลดรูปบัตรประชาชน" }, { status: 400 });
    }
    await submitUserVerificationDocument(payload.sub, idCardUrl);
    await addNotification(
      "verification_request",
      "ขอยืนยันตัวตน/ส่งเอกสาร",
      "มีผู้ใช้ส่งเอกสารยืนยันตัวตน รอตรวจสอบ",
      { userId: payload.sub }
    ).catch(() => {});
    return NextResponse.json({
      verified: false,
      status: "pending",
      message: "ส่งเอกสารแล้ว รอแอดมินตรวจสอบ",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
