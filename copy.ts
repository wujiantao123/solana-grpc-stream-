import fs from "fs";
import express, { Request, Response } from "express";
import axios from "axios";
import cors from "cors";
import bs58 from "bs58";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  subscribe,
  CommitmentLevel,
  LaserstreamConfig,
  SubscribeRequest,
} from "helius-laserstream";
import sendMessage from "./sendMessage.js";

// ----------------- 配置 -----------------
const CACHE_FILE = "./followConfigs.json";
const WALLET_STATS_FILE = "./walletStats.json";
const PORT = 8125;

const endpoints = ["http://57.129.64.141:10000"];
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

// 来源钱包标注
const source: Record<string, string> = {
  H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS: "Coinbase 1",
  "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm": "Coinbase 2",
  GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE: "Coinbase Hot Wallet 2",
  DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo: "Coinbase Hot Wallet 4",
  "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "Binance 1",
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "Binance 2",
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "Binance 3",
  "3gd3dqgtJ4jWfBfLYTX67DALFetjc5iS72sCgRhCkW2u": "Binance 10",
  "6QJzieMYfp7yr3EdrePaQoG3Ghxs2wM98xSLRu8Xh56U": "Binance 11",
};

// ----------------- 数据缓存 -----------------
let followConfigs: Record<string, { target: number; count: number }> = {};
let walletStats: Record<
  string,
  { isNew: boolean; transfers: number; launches: number }
> = {};

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    followConfigs = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  }
}
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(followConfigs, null, 2));
}
function loadWalletStats() {
  if (fs.existsSync(WALLET_STATS_FILE)) {
    walletStats = JSON.parse(fs.readFileSync(WALLET_STATS_FILE, "utf-8"));
  }
}
function saveWalletStats() {
  fs.writeFileSync(WALLET_STATS_FILE, JSON.stringify(walletStats, null, 2));
}

// ----------------- 工具函数 -----------------
const addCopy = async (address: string) => {
  const data = {
    tag: `auto:${address.slice(0, 8)}`,
    target: address,
    autoSell: true,
    autoSellParams: '{"settings":{"3500":10000}}',
    autoSellTime: 0,
    buyTimes: 1,
    buyTimesResetAfterSold: true,
    copySell: true,
    enableMev: 0,
    enableMevSell: 0,
    enableTrailingStop: false,
    enableTurbo: false,
    enabled: true,
    firstSellPercent: 0,
    ignoreUnburnedLpTokens: false,
    ignoreUnrenouncedLpTokens: false,
    jitoFee: 10000000,
    jitoFeeSell: 0,
    lowerLimitOfOneTransaction: 500000000,
    upperLimitOfOneTransaction: 500000000,
    totalUpperLimit: 550000000,
    maxMc: -1,
    minMc: -1,
    maxTokenAge: -1,
    minTokenAge: -1,
    minLp: -1,
    notCopyPositionAddition: false,
    notifyNoHolding: false,
    onlySell: false,
    priorityFee: 4000000,
    priorityFeeSell: 1000000,
    pumpfunSlippageTimes: 15,
    ratio: 100,
    retryTimes: 0,
    sellByPositionProportion: true,
    slippage: 15,
    slippageSell: 30,
    slippagePumpSell: 30,
    targetSolMaxBuy: -1,
    targetSolMinBuy: -1,
    trailingStopActivationBps: 0,
    trailingStopBps: 0,
    copyPumpfun: true,
    copyRaydiumLaunchlab: true,
    copyRaydium: false,
    copyRaydiumCpmm: false,
    copyRaydiumClmm: false,
    copyMeteora: false,
    copyMeteoraDbc: false,
    copyMeteoraDyn: false,
    copyMeteoraDammv2: false,
    copyPumpamm: false,
    copyJupiterAggregator: false,
    copyMoonshot: false,
    copyBoopfun: false,
    copyGavel: false,
    copyVertigo: false,
    copyPancake: true,
    copyHeaven: true,
    copyOkxAggregator: true,
    copyOrca: true,
    activeStartTime: -1,
    activeEndTime: -1,
  };
  await axios.post(
    "https://copy.fastradewiz.com/api/v1/upsertCopyTrading",
    data,
    {
      headers: {
        authorization:
          "Bearer rBvghG9oJNY6Q23Gt2fcaaRjUNaBlkf4XFwvYBSLLljgCjOgVJmJmrDImHL2DV1rHq4bdQB5OiZeW70JEapU4WogADh6HbjQY+0WxInJ5s1KHy7d+i3oi1sgxZhGWaUxvDjQdWSYzMGp01JUaYjh3YuH5JNdG6P+FTRu7E9r+W4gQXYSTQRtZ7AGkn4l1K97526omRlvbEyLHM040+NmIvx02OSvkmdnomhbHoKLQF06RAI6e6JeA86tewLScAX9TkEivXwuOLafLY6/LjS6GJ54WsaRRAXeZXQvrKQDFsXOqXjIL2xKHQAC1CwlYV1LH+cFaXBJM1rpkwOHcyOL0w==",
      },
    }
  );
};

async function isNewWallet(address: string, txHash: string) {
  const pubkey = new PublicKey(address);

  // 获取这笔交易详情
  const txInfo = await getConnection().getTransaction(txHash, { commitment: "confirmed" });
  if (!txInfo) return false; // 交易不存在，返回 false

  // 找到该地址在 accountKeys 中的索引
  const idx = txInfo.transaction.message.accountKeys.findIndex(
    (key) => key.toBase58() === pubkey.toBase58()
  );

  if (idx === -1) return false; // 地址不在交易里

  const preBalance = txInfo.meta?.preBalances[idx] ?? 0;
  const postBalance = txInfo.meta?.postBalances[idx] ?? 0;

  return preBalance === 0 && postBalance > 0;
}

// ----------------- 订阅逻辑 -----------------
const baseSubscription: SubscribeRequest = {
  transactions: {
    client: {
      accountInclude: [
        "DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo",
        "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
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

function toBuffer(obj: any): Buffer {
  if (!obj) return Buffer.alloc(0);
  if (Buffer.isBuffer(obj)) return obj;
  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return Buffer.from(obj.data);
  }
  if (Array.isArray(obj)) {
    return Buffer.from(obj);
  }
  throw new Error("Unsupported buffer format: " + JSON.stringify(obj));
}

// Buffer JSON -> PublicKey
function bufferToPubkey(bufObj: any) {
  return new PublicKey(Buffer.from(bufObj.data));
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

// 解析 SPL Token 转账
function parseTokenTransfers(result: any) {
  const message = result.transaction.transaction.message;
  const transfers: any[] = [];

  const preBalances = result.transaction.meta.preTokenBalances || [];
  const postBalances = result.transaction.meta.postTokenBalances || [];

  for (const post of postBalances) {
    const pre = preBalances.find(
      (p: { accountIndex: any; mint: any }) =>
        p.accountIndex === post.accountIndex && p.mint === post.mint
    );
    if (!pre) continue;

    const diff =
      Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount);
    if (diff === 0) continue;
    const account = bufferToPubkey(message.accountKeys[post.accountIndex]);
    if (account) {
      transfers.push({
        type: "SPL",
        mint: post.mint,
        account: account.toBase58(),
        owner: post.owner,
        amount: diff / Math.pow(10, post.uiTokenAmount.decimals),
        direction: diff > 0 ? "in" : "out",
      });
    }
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
  const accountKeys = result.transaction.transaction.message.accountKeys.map(
    (b: any) => {
      const u8 = bufferToUint8Array(b);
      return bs58.encode(u8);
    }
  );
  // case1: 开盘监听
  if (accountKeys.includes("TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM")) {
    for (const addr of accountKeys) {
      if (followConfigs[addr]) {
        followConfigs[addr].count++;
        saveCache();
        if (followConfigs[addr].count === followConfigs[addr].target - 1) {
          await addCopy(addr);
        }
      }
      if (walletStats[addr]?.isNew) {
        walletStats[addr].launches++;
        saveWalletStats();
      }
    }
    return;
  }
  // case2: 转账监听
  parseSolTransfers(result).forEach(async (tx) => {
    if (tx.amount > 0.3 && tx.amount < 5.1) {
      const toAddr = tx.to;
      if (await isNewWallet(toAddr, hash)) {
        walletStats[toAddr] ??= { isNew: true, transfers: 0, launches: 0 };
        walletStats[toAddr].transfers++;
        saveWalletStats();
        console.log("🆕 发现新钱包:", toAddr, walletStats[toAddr]);
        // const msg = [
        //   `新钱包(${toAddr} SOL) 来源 ${source[tx.from] || tx.from} 触发`,
        //   `https://gmgn.ai/sol/address/${toAddr}`,
        //   `https://webtest.tradewiz.trade/copy.html?address=${toAddr}`,
        // ].join("\n");
        // await sendMessage(msg);
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
      (data) => handleTransaction(data.transaction).catch(console.error),
      (err) => console.error(`订阅错误 (${endpoint}):`, err)
    );

    console.log(`✅ 已连接 Laserstream 节点: ${endpoint}`);
  }
}

// ----------------- HTTP API -----------------
const app = express();
app.use(cors());
app.use(express.json());

app.post("/testapi/add", (req: Request, res: Response) => {
  const { address, times } = req.body;
  if (!address || !times) return res.status(400).json({ error: "缺少参数" });

  followConfigs[address] = {
    target: times,
    count: followConfigs[address]?.count || 0,
  };
  saveCache();
  if (times <= 1) addCopy(address).catch(console.error);

  res.json({ success: true });
});

app.post("/testapi/remove", (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address || !followConfigs[address])
    return res.status(400).json({ error: "地址不存在" });

  delete followConfigs[address];
  saveCache();
  res.json({ success: true });
});

app.get("/testapi/list", (_req: Request, res: Response) => {
  res.json(followConfigs);
});

// ----------------- 启动 -----------------
loadCache();
loadWalletStats();
startAllSubscriptions().catch(console.error);
app.listen(PORT, () => console.log(`🚀 服务已启动: http://localhost:${PORT}`));
