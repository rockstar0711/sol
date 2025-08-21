import { NextResponse } from "next/server";
import { z } from "zod";
import nacl from "tweetnacl";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  connDev,
  loadTreasury,
  WIN_LAMPORTS,
  COOLDOWN_SECONDS,
  nonceStore,
  cooldownStore,
  perIpLimit,
} from "@/lib/utils";

const bodySchema = z.object({
  wallet: z.string().min(32),
  nonce: z.string().min(8),
  signatureBase64: z.string().min(10),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "ip";
  if (!perIpLimit(ip))
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parse = bodySchema.safeParse(json);
  if (!parse.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { wallet, nonce, signatureBase64 } = parse.data;

  const rec = nonceStore.get(nonce);
  if (!rec || rec.wallet !== wallet || Date.now() > rec.expiresAt) {
    return NextResponse.json(
      { error: "Invalid or expired nonce" },
      { status: 400 }
    );
  }
  nonceStore.delete(nonce);

  let pub: PublicKey;
  try {
    pub = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "Bad pubkey" }, { status: 400 });
  }

  const msg = new TextEncoder().encode(`play:${nonce}`);
  const sig = Buffer.from(signatureBase64, "base64");
  const ok = nacl.sign.detached.verify(msg, sig, pub.toBytes());
  if (!ok)
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  const now = Date.now();
  const nextAllowed = cooldownStore.get(wallet) || 0;
  if (now < nextAllowed) {
    const secs = Math.ceil((nextAllowed - now) / 1000);
    return NextResponse.json({ error: `Cooldown ${secs}s` }, { status: 429 });
  }
  cooldownStore.set(wallet, now + COOLDOWN_SECONDS * 1000);

  const win = Math.random() < 0.45;
  if (!win) return NextResponse.json({ result: "lose" });

  const treasury = loadTreasury();
  const ix = SystemProgram.transfer({
    fromPubkey: treasury.publicKey,
    toPubkey: pub,
    lamports: WIN_LAMPORTS,
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = treasury.publicKey;
  const signature = await sendAndConfirmTransaction(connDev, tx, [treasury], {
    commitment: "confirmed",
  });

  return NextResponse.json({
    result: "paid",
    signature,
    amountLamports: WIN_LAMPORTS,
  });
}
