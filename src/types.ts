export interface Policy {
  valueThreshold: string; // ETH as decimal string, e.g. "0.1"
  allowedRecipients: string[]; // checksummed or lowercase; empty = allow all
  allowedSelectors: string[]; // 4-byte hex, e.g. "0xa9059cbb"; empty = allow all
}

export interface TxRequest {
  to: `0x${string}`;
  value: bigint; // in wei
  data?: `0x${string}`;
}

export interface CheckResult {
  decision: "approve" | "ledger" | "reject";
  reason?: "recipient_not_allowed" | "selector_not_allowed";
}
