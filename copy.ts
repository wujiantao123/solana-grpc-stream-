import fs from "fs";
import express, { Request, Response } from "express";
import axios from "axios";
import cors from "cors";
import bs58 from "bs58";
import { Connection, PublicKey } from "@solana/web3.js";
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
  DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo: "Coinbase Hot Wallet 4",
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "Binance 2",
};

// ----------------- 数据缓存 -----------------
let followConfigs: Record<string, { target: number; count: number }> = {};
let walletStats: Record<string, { isNew: boolean; transfers: number; launches: number }> = {};

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

async function isNewWallet(address: string) {
  const pubkey = new PublicKey(address);
  const signatures = await getConnection().getSignaturesForAddress(pubkey, { limit: 1 });
  return signatures.length === 0;
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

async function handleTransaction(result: any, endpoint: string) {
  if (!result?.transaction) return;

  const hash = bs58.encode(Buffer.from(result.transaction.signature));
  const accountKeys = result.transaction.transaction.message.accountKeys.map(
    (b: Uint8Array | number[]) => bs58.encode(b)
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
  const pre = Number(result.transaction.meta.preBalances[0]);
  const post = Number(result.transaction.meta.postBalances[0]);
  const transferAmountSol = (pre - post) / 1e9;

  if (transferAmountSol > 0.3 && transferAmountSol < 5.1) {
    const toAddr = accountKeys[1]; // TODO: 建议用 instruction 确认
    if (await isNewWallet(toAddr)) {
      walletStats[toAddr] ??= { isNew: true, transfers: 0, launches: 0 };
      walletStats[toAddr].transfers++;
      saveWalletStats();
      const msg = [
        `新钱包(${transferAmountSol} SOL) 来源 ${source[accountKeys[0]]}`,
        `https://gmgn.ai/sol/address/${toAddr}`,
        `https://webtest.tradewiz.trade/copy.html?address=${toAddr}`,
      ].join("\n");
      await sendMessage(msg);
    }
  }
}

async function startAllSubscriptions() {
  for (const endpoint of endpoints) {
    const config: LaserstreamConfig = { apiKey: "", endpoint };

    await subscribe(
      config,
      baseSubscription,
      (data) => handleTransaction(data.transaction, endpoint).catch(console.error),
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

  followConfigs[address] = { target: times, count: followConfigs[address]?.count || 0 };
  saveCache();
  if (times <= 1) addCopy(address).catch(console.error);

  res.json({ success: true });
});

app.post("/testapi/remove", (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address || !followConfigs[address]) return res.status(400).json({ error: "地址不存在" });

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
