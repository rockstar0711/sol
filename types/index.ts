type WResp = {
  eligible: boolean;
  balance: number;
};

type CResp = { nonce: string };

type PlayResp =
  | { result: "lose" }
  | { result: "win"; amountLamports: number }
  | { result: "paid"; signature: string; amountLamports: number };
