# Ledger Agent Policy Middleware

Policy middleware for AI agent transactions — intercepts outgoing transactions, enforces configurable rules (value threshold, recipient whitelist, function selector whitelist), and requires real Ledger hardware confirmation for high-value transactions.

## What This Shows

- **PolicyMiddleware** — TypeScript class that wraps agent transaction sending with a policy gate
- **policy.json** — configurable rules: `valueThreshold`, `allowedRecipients`, `allowedSelectors`
- **Decision engine** — `approve` (auto-send) / `ledger` (hardware confirm) / `reject` (block)
- **Real Ledger signing** — connects to Ledger Nano via USB, user presses confirm button on device
- **CLI Demo** — 3 scenarios on local Anvil

## Policy Rules (reject priority order)

| Priority | Rule | Decision |
|---|---|---|
| 1 | recipient not in `allowedRecipients` | reject |
| 2 | function selector not in `allowedSelectors` | reject |
| 3 | value > `valueThreshold` ETH | ledger |
| 4 | all pass | approve |

Empty `allowedRecipients` or `allowedSelectors` = allow all (permissive default).

## Quick Start

### Prerequisites

```bash
npm install
# If node-hid build fails on Linux:
sudo apt-get install -y libudev-dev && npm install
```

### Configure Policy

Edit `policy.json`:

```json
{
  "valueThreshold": "0.1",
  "allowedRecipients": ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"],
  "allowedSelectors": ["0xa9059cbb"]
}
```

### Run Tests

```bash
npm test
# 6 tests: checkPolicy logic (no Ledger needed)
```

### Run Demo

Terminal 1:
```bash
anvil
```

Terminal 2:
```bash
# Scenario 1: auto approve (value < threshold)
npx tsx --tsconfig tsconfig.json demo/agent.ts --scenario=1

# Scenario 2: Ledger required (value > threshold)
# Plug in Ledger, open Ethereum app, then:
npx tsx --tsconfig tsconfig.json demo/agent.ts --scenario=2

# Scenario 3: reject (recipient not in whitelist)
npx tsx --tsconfig tsconfig.json demo/agent.ts --scenario=3
```

## SDK Usage

```typescript
import { loadPolicy } from "./src/policy.js";
import { PolicyMiddleware } from "./src/middleware.js";
import { createWalletClient, http, parseEther } from "viem";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const policy = loadPolicy("./policy.json");
const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: anvil,
  transport: http("http://127.0.0.1:8545"),
});
const middleware = new PolicyMiddleware(policy, walletClient, account.address);

// Agent sends tx — middleware decides approve/ledger/reject
const hash = await middleware.execute({
  to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  value: parseEther("0.5"), // > 0.1 threshold → Ledger required
});
```

## Architecture

```
agent code → middleware.execute(tx)
                 ↓
             checkPolicy(tx, policy)
                 ↓
        ┌────────┴────────┬────────────┐
     approve           ledger        reject
        ↓                 ↓             ↓
  walletClient     Ledger device    throw Error
  .sendTx()        USB sign + send
```
