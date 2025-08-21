import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { connMain, MINT, perIpLimit } from "@/lib/utils";

const q = z.object({ wallet: z.string().min(32) });

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

  const parse = q.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Invalid query" });

  const { wallet } = parse.data;
  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: "Invalid pubkey" });
  }

  const mint = new PublicKey(MINT);
  const resp = await connMain.getParsedTokenAccountsByOwner(owner, { mint });
  const balance = resp.value.reduce((sum, ta) => {
    // @ts-ignore
    const ui = ta.account.data.parsed.info.tokenAmount.uiAmount as number;
    return sum + (ui || 0);
  }, 0);

  res.json({ eligible: balance > 0, balance });
}
