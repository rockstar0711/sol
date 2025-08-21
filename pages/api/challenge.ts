import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { nonceStore } from "@/lib/utils";

const q = z.object({ wallet: z.string().min(32) });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const parse = q.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Invalid query" });
  const { wallet } = parse.data;

  const nonce = uuid();
  const ttlMs = 1000 * 60 * 5;
  nonceStore.set(nonce, { wallet, expiresAt: Date.now() + ttlMs });

  res.json({ nonce });
}
