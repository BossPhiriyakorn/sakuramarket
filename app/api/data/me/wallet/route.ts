import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getWalletsByUserId, upsertPrimaryWalletByUserId } from "@/lib/api/dbStore";
import { getAddress, isAddress } from "viem";

const ALLOWED_CHAINS = new Set(["polygon", "ethereum", "bsc", "arbitrum", "base"]);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub || payload.role === "admin") {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const wallets = await getWalletsByUserId(payload.sub);
    return NextResponse.json({
      wallets,
      wallet: wallets[0] ?? null,
    });
  } catch (e) {
    console.error("GET /api/data/me/wallet:", e);
    return NextResponse.json({ error: String(e), wallets: [], wallet: null }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub || payload.role === "admin") {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const chainRaw = typeof body.chain === "string" ? body.chain.trim().toLowerCase() : "polygon";
    const chain = ALLOWED_CHAINS.has(chainRaw) ? chainRaw : "polygon";

    if (!isAddress(address)) {
      return NextResponse.json({ error: "รูปแบบกระเป๋าไม่ถูกต้อง" }, { status: 400 });
    }

    const wallet = await upsertPrimaryWalletByUserId(payload.sub, getAddress(address), chain);
    const wallets = await getWalletsByUserId(payload.sub);
    return NextResponse.json({ wallet, wallets });
  } catch (e) {
    console.error("POST /api/data/me/wallet:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
