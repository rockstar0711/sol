import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export const short = (k: string) =>
  k ? `${k.slice(0, 4)}...${k.slice(-4)}` : "";

export const DEVNET = process.env.RPC_URL_DEVNET || clusterApiUrl("devnet");
export const MAINNET =
  process.env.RPC_URL_MAINNET || "https://api.mainnet-beta.solana.com";

export const connDev = new Connection(DEVNET, "confirmed");
export const connMain = new Connection(MAINNET, "confirmed");

export const WIN_LAMPORTS = Number(process.env.WIN_LAMPORTS || 10_000_000);
export const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);
export const MINT = process.env.MINT!;

export const nonceStore = new Map<
  string,
  { wallet: string; expiresAt: number }
>();
export const cooldownStore = new Map<string, number>(); // wallet -> nextAllowedTs
export const ipBurst = new Map<string, { count: number; resetAt: number }>();

export function perIpLimit(ip: string, ceiling = 20, windowMs = 60_000) {
  const now = Date.now();
  const rec = ipBurst.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + windowMs;
  }
  rec.count += 1;
  ipBurst.set(ip, rec);
  return rec.count <= ceiling;
}

export function loadTreasury(): Keypair {
  const b58 = process.env.TREASURY_SECRET_KEY_BASE58;
  const json = process.env.TREASURY_SECRET_KEY_JSON;
  if (b58 && b58.length > 0) return Keypair.fromSecretKey(bs58.decode(b58));
  if (json && json.trim().startsWith("["))
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(json)));
  throw new Error("Treasury secret missing");
}
