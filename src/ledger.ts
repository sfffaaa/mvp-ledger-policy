// src/ledger.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TransportNodeHid = (await import("@ledgerhq/hw-transport-node-hid")).default as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Eth = (await import("@ledgerhq/hw-app-eth")).default as any;
import {
  createPublicClient,
  http,
  serializeTransaction,
} from "viem";
import { anvil } from "viem/chains";
import type { TxRequest } from "./types.js";

const DERIVATION_PATH = "44'/60'/0'/0/0";
const RPC_URL = "http://127.0.0.1:8545";

export async function getLedgerAddress(): Promise<`0x${string}`> {
  const transport = await TransportNodeHid.open("");
  try {
    const eth = new Eth(transport);
    const { address } = await eth.getAddress(DERIVATION_PATH);
    return address.toLowerCase() as `0x${string}`;
  } finally {
    await transport.close();
  }
}

export async function signAndSendWithLedger(tx: TxRequest): Promise<`0x${string}`> {
  const publicClient = createPublicClient({ chain: anvil, transport: http(RPC_URL) });

  // Open transport
  const transport = await TransportNodeHid.open("");
  const eth = new Eth(transport);

  try {
    // Get Ledger address
    const { address } = await eth.getAddress(DERIVATION_PATH);
    const from = address as `0x${string}`;

    // Fetch tx params
    const [nonce, gasPrice, gas] = await Promise.all([
      publicClient.getTransactionCount({ address: from }),
      publicClient.getGasPrice(),
      publicClient.estimateGas({
        account: from,
        to: tx.to,
        value: tx.value,
        data: tx.data,
      }),
    ]);

    // Serialize unsigned legacy tx
    const txParams = { chainId: anvil.id, nonce, gasPrice, gas, to: tx.to, value: tx.value, data: tx.data };
    const unsignedTx = serializeTransaction(txParams);

    // Sign on Ledger device (user presses confirm button)
    console.log("Please confirm on your Ledger device...");
    const rawTxHex = unsignedTx.slice(2); // remove 0x
    const { v, r, s } = await eth.signTransaction(DERIVATION_PATH, rawTxHex, null as any);

    // Reconstruct signed tx
    const signedTx = serializeTransaction(txParams, {
      v: BigInt("0x" + v),
      r: ("0x" + r) as `0x${string}`,
      s: ("0x" + s) as `0x${string}`,
    });

    // Broadcast
    const hash = await publicClient.sendRawTransaction({
      serializedTransaction: signedTx,
    });

    return hash;
  } finally {
    await transport.close();
  }
}
