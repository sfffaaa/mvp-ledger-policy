import { createWalletClient, http } from "viem";
import { anvil } from "viem/chains";
import { checkPolicy } from "./policy.js";
import { signAndSendWithLedger } from "./ledger.js";
import type { Policy, TxRequest } from "./types.js";

export class PolicyMiddleware {
  constructor(
    private readonly policy: Policy,
    private readonly walletClient: ReturnType<typeof createWalletClient>,
    private readonly senderAddress: `0x${string}`
  ) {}

  async execute(tx: TxRequest): Promise<`0x${string}`> {
    const result = checkPolicy(tx, this.policy);

    switch (result.decision) {
      case "approve": {
        console.log("Policy check: APPROVE — sending automatically");
        const hash = await this.walletClient.sendTransaction({
          account: this.senderAddress,
          to: tx.to,
          value: tx.value,
          data: tx.data,
          chain: anvil,
        });
        return hash;
      }

      case "ledger": {
        console.log("Policy check: LEDGER REQUIRED — hardware confirmation needed");
        const hash = await signAndSendWithLedger(tx);
        return hash;
      }

      case "reject": {
        const msg =
          result.reason === "recipient_not_allowed"
            ? "recipient not in allowedRecipients"
            : "selector not in allowedSelectors";
        console.log(`Policy check: REJECTED — ${msg}`);
        throw new Error(`PolicyViolation: ${msg}`);
      }
    }
  }
}
