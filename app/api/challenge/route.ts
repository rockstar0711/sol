import { nonceStore } from "@/lib/utils";
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";
  const q = z.string().min(32);
  if (!q.safeParse(wallet).success)
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const nonce = uuid();
  nonceStore.set(nonce, { wallet, expiresAt: Date.now() + 5 * 60_000 });
  return NextResponse.json({ nonce });
}
