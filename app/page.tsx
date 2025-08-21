"use client";

import { short } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { WalletButton } from "./components/WalletButton";
import { apiGet, apiPost } from "@/lib/api";

export default function Home() {
  const { publicKey, signMessage } = useWallet();
  const pubkey = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);
  const [eligible, setEligible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");

  const check = async () => {
    if (!pubkey) return;
    setStatus("Checking eligibility...");
    try {
      const data = await apiGet<WResp>(`/api/whitelist?wallet=${pubkey}`);
      setEligible(data.eligible);
      setBalance(data.balance);
      setStatus(data.eligible ? "Eligible. You can play." : "Not eligible.");
    } catch (e: any) {
      setStatus(e.message ?? "whitelist failed");
    }
  };

  const play = async () => {
    if (!pubkey || !signMessage) return;

    try {
      setStatus("Requesting challenge...");
      const { nonce } = await apiGet<CResp>(`/api/challenge?wallet=${pubkey}`);

      const msg = new TextEncoder().encode(`play:${nonce}`);
      const sig = await signMessage(msg);
      const signatureBase64 = Buffer.from(sig).toString("base64");

      setStatus("Flipping coin...");
      const resp = await apiPost<PlayResp>(`/api/play`, {
        wallet: pubkey,
        nonce,
        signatureBase64,
      });

      if (resp.result === "lose") {
        setStatus("You lost. Cooldown applies. Try again soon.");
        return;
      }

      if (resp.result === "win") {
        setStatus(
          `You won ${resp.amountLamports} lamports! Processing payout...`
        );
        return;
      }

      if (resp.result === "paid") {
        const url = `https://explorer.solana.com/tx/${resp.signature}?cluster=devnet`;
        setStatus(
          `Paid ${resp.amountLamports} lamports.\nTx: ${resp.signature}\n${url}`
        );
        return;
      }

      setStatus("Unexpected server response.");
    } catch (e: any) {
      const msg = String(e.message || "");
      if (msg.includes("429")) {
        setStatus("Rate limited or cooldown. Give it a minute.");
      } else if (msg.includes("nonce")) {
        setStatus("Nonce expired. Try again.");
      } else if (msg.includes("Bad signature")) {
        setStatus("Signature failed. Reconnect wallet and retry.");
      } else {
        setStatus(msg || "Play failed");
      }
    }
  };

  useEffect(() => {
    setEligible(false);
    setBalance(null);
    setStatus("");
  }, [pubkey]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="mx-auto w-full max-w-xl px-6 py-12">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Whitelist to Play
          </h1>
          <div className="scale-95 sm:scale-100 relative z-50">
            <WalletButton />
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          {pubkey ? (
            <p className="mb-4 text-sm text-slate-300">
              Connected: <span className="font-mono">{short(pubkey)}</span>
            </p>
          ) : (
            <p className="mb-4 text-sm text-slate-400">
              Connect a wallet to continue
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={check}
              disabled={!pubkey || checking}
              className="inline-flex items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 shadow-sm transition hover:bg-sky-400/20 hover:shadow
                       disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
              )}
              Check eligibility
            </button>

            <button
              onClick={play}
              disabled={!pubkey || !eligible}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-sm transition hover:bg-emerald-400/20 hover:shadow
                       disabled:cursor-not-allowed disabled:opacity-50"
            >
              🎲 Play coin flip
            </button>
          </div>

          {balance !== null && (
            <div className="mt-4 rounded-lg bg-black/30 p-3 text-sm">
              Your token balance:{" "}
              <span className="font-semibold">{balance}</span>
            </div>
          )}

          {status && (
            <div
              className={[
                "mt-4 rounded-xl border p-4 text-sm",
                status.includes("Paid")
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : status.includes("Eligible")
                  ? "border-sky-400/40 bg-sky-400/10 text-sky-300"
                  : status.toLowerCase().includes("lost") ||
                    status.toLowerCase().includes("rate") ||
                    status.toLowerCase().includes("cooldown")
                  ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
                  : "border-slate-400/30 bg-slate-400/10 text-slate-200",
              ].join(" ")}
            >
              <pre className="whitespace-pre-wrap leading-relaxed">
                {status}
              </pre>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-400">
            Note: gating on mainnet, payouts on devnet.
          </p>
        </section>
      </div>
    </main>
  );
}
