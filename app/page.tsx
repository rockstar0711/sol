"use client";

import { short } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const { publicKey, signMessage } = useWallet();
  const pubkey = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);
  const [eligible, setEligible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");

  const check = async () => {
    console.log("CHECK!!!");
    if (!pubkey) return;
    setChecking(true);
    setStatus("Checking eligibility...");
    const r = await fetch(`/api/whitelist?wallet=${pubkey}`);

    console.log("RRRRRRR", r);
    const data = (await r.json()) as WResp;
    console.log("data: ", data);
    setEligible(data.eligible);
    setBalance(data.balance);
    setStatus(data.eligible ? "Eligible. You can play." : "Not eligible.");
    setChecking(false);
  };
  const play = () => {
    console.log("PLAY!!!");
  };

  useEffect(() => {
    setEligible(false);
    setBalance(null);
    setStatus("");
  }, [pubkey]);

  return (
    <main className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <div
        style={{
          maxWidth: 560,
          margin: "40px auto",
          fontFamily: "ui-sans-serif",
        }}
      >
        <h1>Whitelist to Play</h1>
        <WalletMultiButton />
        {pubkey && <p>Connected: {short(pubkey)}</p>}

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <button onClick={check} disabled={!pubkey || checking}>
            Check eligibility
          </button>
          <button onClick={play} disabled={!pubkey || !eligible}>
            Play coin flip
          </button>
        </div>

        {balance !== null && <p>Your token balance: {balance}</p>}
        {status && <pre style={{ whiteSpace: "pre-wrap" }}>{status}</pre>}
        <small>Note: gating on mainnet, payouts on devnet.</small>
      </div>
    </main>
  );
}
