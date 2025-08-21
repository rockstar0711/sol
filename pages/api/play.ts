import type { NextApiRequest, NextApiResponse } from "next";
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
  perIpLimit,
  cooldownStore,
} from "@/lib/utils";

const bodySchema = z.object({
  wallet: z.string().min(32),
  nonce: z.string().min(8),
  signatureBase64: z.string().min(10),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket.remoteAddress ||
    "ip";
  if (!perIpLimit(ip))
    return res.status(429).json({ error: "Too many requests" });

  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });
  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid body" });

  const { wallet, nonce, signatureBase64 } = parse.data;

  const rec = nonceStore.get(nonce);
  if (!rec || rec.wallet !== wallet || Date.now() > rec.expiresAt) {
    return res.status(400).json({ error: "Invalid or expired nonce" });
  }
  nonceStore.delete(nonce);

  // verify signature
  let pub: PublicKey;
  try {
    pub = new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: "Bad pubkey" });
  }
  const message = new TextEncoder().encode(`play:${nonce}`);
  const sig = Buffer.from(signatureBase64, "base64");
  const ok = nacl.sign.detached.verify(message, sig, pub.toBytes());
  if (!ok) return res.status(400).json({ error: "Bad signature" });

  // cooldown
  const nextAllowed = cooldownStore.get(wallet) || 0;
  const now = Date.now();
  if (now < nextAllowed) {
    const secs = Math.ceil((nextAllowed - now) / 1000);
    return res.status(429).json({ error: `Cooldown ${secs}s` });
  }
  cooldownStore.set(wallet, now + COOLDOWN_SECONDS * 1000);

  // coin flip with 45 percent win
  const win = Math.random() < 0.45;
  if (!win) return res.json({ result: "lose" });

  // payout on devnet
  const treasury = loadTreasury();
  const ix = SystemProgram.transfer({
    fromPubkey: treasury.publicKey,
    toPubkey: pub,
    lamports: WIN_LAMPORTS,
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = treasury.publicKey;
  const sigTx = await sendAndConfirmTransaction(connDev, tx, [treasury], {
    commitment: "confirmed",
  });

  return res.json({
    result: "paid",
    signature: sigTx,
    amountLamports: WIN_LAMPORTS,
  });
}
