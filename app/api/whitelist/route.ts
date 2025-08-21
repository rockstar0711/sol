import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { connMain, MINT, perIpLimit } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "ip";
  if (!perIpLimit(ip))
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const q = z.string().min(32);
  const parsed = q.safeParse(wallet);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "Invalid pubkey" }, { status: 400 });
  }

  const mint = new PublicKey(MINT);
  const resp = await connMain.getParsedTokenAccountsByOwner(owner, { mint });
  const balance = resp.value.reduce((sum, ta) => {
    // @ts-ignore
    const ui = ta.account.data.parsed.info.tokenAmount.uiAmount as number;
    return sum + (ui || 0);
  }, 0);

  return NextResponse.json({ eligible: balance > 0, balance });
}
