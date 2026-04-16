import { readFileSync } from "node:fs";
import { parseEther } from "viem";
import type { Policy, TxRequest, CheckResult } from "./types.js";

export function loadPolicy(path: string): Policy {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Policy;
  return {
    valueThreshold: raw.valueThreshold,
    allowedRecipients: (raw.allowedRecipients ?? []).map((a) =>
      a.toLowerCase()
    ),
    allowedSelectors: (raw.allowedSelectors ?? []).map((s) => s.toLowerCase()),
  };
}

export function checkPolicy(tx: TxRequest, policy: Policy): CheckResult {
  // 1. Recipient check (reject takes priority)
  if (policy.allowedRecipients.length > 0) {
    if (!policy.allowedRecipients.includes(tx.to.toLowerCase())) {
      return { decision: "reject", reason: "recipient_not_allowed" };
    }
  }

  // 2. Selector check (only if tx has data and allowedSelectors is non-empty)
  if (tx.data && tx.data.length >= 10 && policy.allowedSelectors.length > 0) {
    const selector = tx.data.slice(0, 10).toLowerCase();
    if (!policy.allowedSelectors.includes(selector)) {
      return { decision: "reject", reason: "selector_not_allowed" };
    }
  }

  // 3. Value threshold check
  const threshold = parseEther(policy.valueThreshold);
  if (tx.value > threshold) {
    return { decision: "ledger" };
  }

  return { decision: "approve" };
}
