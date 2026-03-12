import { NextRequest, NextResponse } from "next/server";

/** Proxy รูปจาก URL ภายนอก เพื่อให้ PIXI/Canvas โหลดได้โดยไม่มี CORS (ใช้บนแผนที่แสดงโลโก้ร้าน) */
const ALLOWED_HOSTS = [
  "drive.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
  "docs.google.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 });
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Sakura-Market-Image-Proxy/1" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream failed" }, { status: res.status });
    }
    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (e) {
    console.warn("proxy-image fetch error:", e);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
