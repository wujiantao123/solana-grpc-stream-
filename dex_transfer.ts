import fs from "fs";
import express from "express";
import cors from "cors";
import bs58 from "bs58";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  subscribe,
  CommitmentLevel,
  LaserstreamConfig,
  SubscribeRequest,
} from "helius-laserstream";
import bunyan from "bunyan";

const log = bunyan.createLogger({
  name: "dex_transfer_app",
  streams: [
    {
      level: "info",
      path: "./dex_transfer_app.log",
    },
    {
      level: "debug",
      path: "./dex_transfer_app-debug.log",
    },
    {
      level: "error",
      path: "./dex_transfer_app-error.log",
    },
  ],
});
const PORT = 8125;

function loadFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
}
function saveFile(filePath: string, fileData: Record<string, any>) {
  fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
}
const WALLET_STATS_FILE = "./dex.json";
const LAUNCH_STATS_FILE = "./launch.json";
let walletStats: Record<string, { isNew: boolean; amount: number }> =
  loadFile(WALLET_STATS_FILE) || {};
let launchAddress: string[] = loadFile(LAUNCH_STATS_FILE) || [];
const endpoints = [
  "http://84.32.103.140:10030",
  "http://84.32.103.140:10040",
  "http://84.32.103.140:10090",
  // "http://va.rpc.onyxnodes.com:10000",
];
const rpcs = [
  "https://mainnet.helius-rpc.com/?api-key=8b7d781c-41a4-464a-9c28-d243fa4b4490",
  "https://mainnet.helius-rpc.com/?api-key=c64adbb9-8f0e-48b5-8690-a4d8bb4e5486",
  "https://mainnet.helius-rpc.com/?api-key=fa81dd0b-76fc-434b-83d6-48f151e2d3e5",
  "https://mainnet.helius-rpc.com/?api-key=14312756-eebe-4d84-9617-59a09fc8c894",
  "https://mainnet.helius-rpc.com/?api-key=c570abef-cd38-40b5-a7d8-c599769f7309",
];
const connections = rpcs.map((rpc) => new Connection(rpc, "confirmed"));
let connectionIndex = 0;
const getConnection = () => {
  const conn = connections[connectionIndex];
  connectionIndex = (connectionIndex + 1) % connections.length;
  return conn;
};

async function isNewWallet(address: string, hash: string) {
  const pubkey = new PublicKey(address);
  try {
    const signatures = await getConnection().getSignaturesForAddress(pubkey, {
      limit: 2,
    });
    if (signatures.length === 0) return true;
    if (signatures.length === 1) return signatures[0].signature === hash;
    return false;
  } catch (e) {
    log.error("isNewWallet error:", e);
    return false;
  }
}

// ----------------- 订阅逻辑 -----------------
const baseSubscription: SubscribeRequest = {
  transactions: {
    client: {
      accountInclude: [
        "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",
        "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm",
        "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE",
        "DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo",
        "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S",
        "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "3gd3dqgtJ4jWfBfLYTX67DALFetjc5iS72sCgRhCkW2u",
        "6QJzieMYfp7yr3EdrePaQoG3Ghxs2wM98xSLRu8Xh56U",
        "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
      ],
      accountExclude: [],
      accountRequired: [],
      vote: false,
      failed: false,
    },
  },
  commitment: CommitmentLevel.CONFIRMED,
};

// Buffer JSON -> PublicKey
function bufferToPubkey(bufObj: any) {
  try {
    return new PublicKey(Buffer.from(bufObj.data));
  } catch (e) {
    return new PublicKey("11111111111111111111111111111111");
  }
}

// 解析 SOL 转账
function parseSolTransfers(result: any) {
  const parse = JSON.parse(JSON.stringify(result));
  const message = parse.transaction.transaction.message;
  const transfers: any[] = [];
  for (const ix of message.instructions) {
    if (!ix.accounts || !ix.data) continue;
    const programId = bufferToPubkey(message.accountKeys[ix.programIdIndex]);
    if (!programId.equals(SystemProgram.programId)) continue;
    // 仅当数据长度 >= 8 才尝试解析
    const dataBuf = Buffer.from(ix.data.data);
    if (dataBuf.length < 8) continue;

    const accountsIndexes: number[] = Array.from(ix.accounts.data);
    if (accountsIndexes.length < 2) continue;

    const from = bufferToPubkey(message.accountKeys[accountsIndexes[0]]);
    const to = bufferToPubkey(message.accountKeys[accountsIndexes[1]]);
    const lamports = Number(
      Buffer.from(ix.data.data).slice(-8).readBigUInt64LE(0)
    );
    transfers.push({
      type: "SOL",
      from: from.toBase58(),
      to: to.toBase58(),
      amount: lamports / 1e9,
    });
  }
  return transfers;
}

function bufferToUint8Array(buf: any): Uint8Array {
  if (buf instanceof Uint8Array) return buf;
  if (buf?.type === "Buffer" && Array.isArray(buf.data)) {
    return new Uint8Array(buf.data);
  }
  throw new Error("Invalid buffer format");
}
async function handleTransaction(result: any) {
  if (!result?.transaction) return;
  const hash = bs58.encode(Buffer.from(result.transaction.signature));
  log.debug(new Date().toISOString(), "新交易:", hash);
  const accountKeys = result.transaction.transaction.message.accountKeys.map(
    (b: any) => {
      const u8 = bufferToUint8Array(b);
      return bs58.encode(u8);
    }
  );
  const tradeAddrs = accountKeys[0];
  // case1: 开盘监听
  if (accountKeys.includes("TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM")) {
    for (const addr of accountKeys) {
      if (launchAddress.includes(addr)) continue;
      if (walletStats[addr]) {
        launchAddress.push(addr);
        log.info("🚀检测到新钱包启动:", addr, "来自", tradeAddrs);
        saveFile(LAUNCH_STATS_FILE, launchAddress);
      }
    }
    return;
  }
  // case2: 转账监听
  parseSolTransfers(result).forEach(async (tx) => {
    log.debug(`💸 转账检测: ${hash} ${tx.from} -> ${tx.to} ${tx.amount} SOL`);
    if (tx.amount > 0.1 && tx.amount < 10) {
      const toAddr = tx.to;
      if (await isNewWallet(toAddr, hash)) {
        log.info(
          `🎯检测到新钱包接收转账: ${toAddr} ${tx.amount} SOL 来自 ${tradeAddrs}`
        );
        walletStats[toAddr] ??= {
          isNew: true,
          amount: tx.amount,
        };
        saveFile(WALLET_STATS_FILE, walletStats);
      }
    }
  });
}

async function startAllSubscriptions() {
  for (const endpoint of endpoints) {
    const config: LaserstreamConfig = { apiKey: "", endpoint };

    await subscribe(
      config,
      baseSubscription,
      (data) => handleTransaction(data.transaction).catch(log.error),
      (err) => log.error(`订阅错误 (${endpoint}):`, err)
    );

    log.info(`✅ 已连接 Laserstream 节点: ${endpoint}`);
  }
}
// ----------------- HTTP API -----------------
const app = express();
app.use(cors());
app.use(express.json());
startAllSubscriptions().catch(log.error);
app.listen(PORT, () => log.info(`🚀 服务已启动: http://localhost:${PORT}`));
