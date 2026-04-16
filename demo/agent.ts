// demo/agent.ts
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "../src/policy.js";
import { getLedgerAddress } from "../src/ledger.js";
import { PolicyMiddleware } from "../src/middleware.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenario = process.argv.find(a => a.startsWith("--scenario="))?.split("=")[1] ?? "1";

const RPC_URL = "http://127.0.0.1:8545";

// Anvil default account #0 — software wallet for approve/reject scenarios
const AGENT_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

// Must match policy.json allowedRecipients
const ALLOWED_RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
const BLOCKED_RECIPIENT = "0xdead000000000000000000000000000000000000" as `0x${string}`;

async function fundLedgerAccount(): Promise<`0x${string}`> {
  const publicClient = createPublicClient({ chain: anvil, transport: http(RPC_URL) });
  const ledgerAddr = await getLedgerAddress();

  const balance = await publicClient.getBalance({ address: ledgerAddr });
  if (balance < parseEther("1")) {
    const funder = privateKeyToAccount(AGENT_PK);
    const funderClient = createWalletClient({ account: funder, chain: anvil, transport: http(RPC_URL) });
    const hash = await funderClient.sendTransaction({
      to: ledgerAddr,
      value: parseEther("2"),
      chain: anvil,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✓ Funded Ledger account ${ledgerAddr} with 2 ETH`);
  } else {
    console.log(`✓ Ledger account ${ledgerAddr} already funded`);
  }

  return ledgerAddr;
}

async function main() {
  console.log(`\n=== Ledger Agent Policy Demo (scenario ${scenario}) ===\n`);

  const policy = loadPolicy(join(__dirname, "../policy.json"));
  const account = privateKeyToAccount(AGENT_PK);
  const walletClient = createWalletClient({ account, chain: anvil, transport: http(RPC_URL) });
  const middleware = new PolicyMiddleware(policy, walletClient, account.address);

  if (scenario === "1") {
    // Auto approve: value 0.01 ETH < threshold 0.1 ETH, recipient in whitelist
    console.log("Scenario 1: value 0.01 ETH < threshold 0.1 ETH, recipient in whitelist");
    console.log("Expected: APPROVE (no Ledger needed)\n");

    const tx = { to: ALLOWED_RECIPIENT, value: parseEther("0.01") };
    const hash = await middleware.execute(tx);
    console.log(`✓ Tx sent: ${hash}`);

  } else if (scenario === "2") {
    // Ledger required: value 0.5 ETH > threshold 0.1 ETH
    console.log("Scenario 2: value 0.5 ETH > threshold 0.1 ETH");
    console.log("Expected: LEDGER REQUIRED\n");
    console.log("Prerequisites: Ledger plugged in via USB, Ethereum app open on device.\n");

    const ledgerAddr = await fundLedgerAccount();
    console.log(`Using Ledger address: ${ledgerAddr}\n`);

    const tx = { to: ALLOWED_RECIPIENT, value: parseEther("0.5") };
    const hash = await middleware.execute(tx);
    console.log(`✓ Tx sent: ${hash}`);

  } else if (scenario === "3") {
    // Reject: recipient not in whitelist
    console.log("Scenario 3: recipient NOT in allowedRecipients");
    console.log("Expected: REJECT (no tx sent, no Ledger needed)\n");

    const tx = { to: BLOCKED_RECIPIENT, value: parseEther("0.01") };
    try {
      await middleware.execute(tx);
    } catch (err) {
      console.log(`✓ Tx blocked as expected: ${(err as Error).message}`);
    }
  }

  console.log("\n✓ Done.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
