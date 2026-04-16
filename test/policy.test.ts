import { checkPolicy, loadPolicy } from "../src/policy.js";
import type { Policy, TxRequest } from "../src/types.js";
import { parseEther } from "viem";
import { writeFileSync, unlinkSync } from "node:fs";

const POLICY: Policy = {
  valueThreshold: "0.1",
  allowedRecipients: ["0x70997970c51812dc3a010c7d01b50e0d17dc79c8"],
  allowedSelectors: ["0xa9059cbb"],
};

const ALLOWED_TX: TxRequest = {
  to: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  value: parseEther("0.01"),
};

describe("checkPolicy", () => {
  it("returns approve when value is below threshold and all rules pass", () => {
    const result = checkPolicy(ALLOWED_TX, POLICY);
    expect(result.decision).toBe("approve");
  });

  it("returns ledger when value exceeds threshold", () => {
    const tx: TxRequest = { ...ALLOWED_TX, value: parseEther("0.5") };
    const result = checkPolicy(tx, POLICY);
    expect(result.decision).toBe("ledger");
  });

  it("returns reject when recipient is not in allowedRecipients", () => {
    const tx: TxRequest = {
      ...ALLOWED_TX,
      to: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    };
    const result = checkPolicy(tx, POLICY);
    expect(result.decision).toBe("reject");
    expect(result.reason).toBe("recipient_not_allowed");
  });

  it("returns reject when selector is not in allowedSelectors", () => {
    const tx: TxRequest = {
      ...ALLOWED_TX,
      data: "0xdeadbeef1234567890abcdef",
    };
    const result = checkPolicy(tx, POLICY);
    expect(result.decision).toBe("reject");
    expect(result.reason).toBe("selector_not_allowed");
  });

  it("reject takes priority over ledger when recipient fails and value exceeds threshold", () => {
    const tx: TxRequest = {
      to: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      value: parseEther("0.5"),
    };
    const result = checkPolicy(tx, POLICY);
    expect(result.decision).toBe("reject");
    expect(result.reason).toBe("recipient_not_allowed");
  });
});

describe("loadPolicy", () => {
  const tmpPath = "/tmp/test-policy.json";

  afterEach(() => {
    try {
      unlinkSync(tmpPath);
    } catch {}
  });

  it("loads and lowercases recipients", () => {
    writeFileSync(
      tmpPath,
      JSON.stringify({
        valueThreshold: "0.5",
        allowedRecipients: ["0xABCDEF1234567890ABCDEF1234567890ABCDEF12"],
        allowedSelectors: [],
      })
    );
    const policy = loadPolicy(tmpPath);
    expect(policy.allowedRecipients[0]).toBe(
      "0xabcdef1234567890abcdef1234567890abcdef12"
    );
  });
});
