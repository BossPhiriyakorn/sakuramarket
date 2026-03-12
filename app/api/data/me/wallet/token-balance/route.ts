import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPublicClient, erc20Abi, formatUnits, getAddress, http, isAddress } from "viem";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getWalletsByUserId } from "@/lib/api/dbStore";

function resolveTokenAddress(): string {
  const raw =
    process.env.APP_TOKEN_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_APP_TOKEN_CONTRACT_ADDRESS ??
    "";
  return raw.trim();
}

function resolveTokenDecimals(): number {
  const raw = Number(process.env.APP_TOKEN_DECIMALS ?? 18);
  if (!Number.isFinite(raw)) return 18;
  const normalized = Math.floor(raw);
  if (normalized < 0) return 0;
  if (normalized > 36) return 36;
  return normalized;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub || payload.role === "admin") {
      return NextResponse.json({ balance: 0, linked: false, walletAddress: null });
    }

    const wallets = await getWalletsByUserId(payload.sub);
    const wallet = wallets[0] ?? null;
    if (!wallet?.address || !isAddress(wallet.address)) {
      return NextResponse.json({ balance: 0, linked: false, walletAddress: null });
    }

    const tokenAddressRaw = resolveTokenAddress();
    if (!isAddress(tokenAddressRaw)) {
      return NextResponse.json({ balance: 0, linked: true, walletAddress: wallet.address, error: "ยังไม่ตั้งค่า APP_TOKEN_CONTRACT_ADDRESS" });
    }

    const rpcUrl =
      process.env.WEB3_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_WEB3_RPC_URL?.trim() ||
      "https://polygon-rpc.com";
    const client = createPublicClient({ transport: http(rpcUrl) });

    const walletAddress = getAddress(wallet.address);
    const tokenAddress = getAddress(tokenAddressRaw);
    const decimals = resolveTokenDecimals();
    const rawBalance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    });
    const formatted = formatUnits(rawBalance, decimals);
    const balance = Number(formatted);

    return NextResponse.json({
      balance: Number.isFinite(balance) ? balance : 0,
      balanceText: formatted,
      linked: true,
      walletAddress,
      tokenAddress,
    });
  } catch (e) {
    console.error("GET /api/data/me/wallet/token-balance:", e);
    return NextResponse.json({ balance: 0, linked: false, walletAddress: null, error: "โหลดยอดเหรียญจากกระเป๋าไม่สำเร็จ" }, { status: 500 });
  }
}
