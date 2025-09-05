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
  { isNew: boolean; transfers: number; launches: number; amount: number }
> = {};
const peddingWallets: Record<string, NodeJS.Timeout> = {};

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
const monKAddCopy = async (address: string) => {
  const data = {
    user_id: "ad3e226c-6f23-4ba8-963a-06ff170385da",
    run_wallet_id: "c1f2e59e-1629-4f17-9f06-1b08ed0861af",
    wallet_address: address,
    config_data: {
      address: address,
      remarks: `交易所_${address.slice(0, 4)}`,
      risk_level: "high",
      dexs: ["Pump"],
      multiple_wallet: 1,
      wallet_purchase_num: 1,
      remaining_sol_value: 0.2,
      is_first_purchase_enabled: true,
      is_follow_sell_enabled: true,
      is_sync_rebalance_enabled: true,
      is_safe: false,
      is_exclude_pump_enabled: false,
      is_exclude_amm_enabled: true,
      is_dev_create_pool: true,
      sell: {
        tranche_sell_strategy: {
          stage_stay_seconds: 2,
          not_entered_tranche_seconds: 3,
        },
      },
      pvp: { is_enabled: true, sell_interval: 3, limit_time: 18000 },
      purchase: {
        pump: [{ tip: 0.01, slippage: 20, input_sol: 1, priority_fee: 20 }],
        amm: [{ tip: 0.001, slippage: 10, input_sol: 0.01 }],
        heaven: [{ tip: 0.001, slippage: 10, input_sol: 0.01 }],
      },
      tranche_based_strategy: [
        { reduce_stock: 30, profit_percent: 15, stop_loss_percent: 10 },
      ],
      transation_sell: { tip: 0.0002, service: "ZeroSlot", priority_fee: 1 },
    },
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  await axios.post(
    "https://ststoebkbdbqhlfyttjr.supabase.co/rest/v1/smart_wallets?on_conflict=user_id%2Crun_wallet_id%2Cwallet_address&select=*",
    data,
    {
      headers: {
        apikey:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c3RvZWJrYmRicWhsZnl0dGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzQwMzksImV4cCI6MjA2ODA1MDAzOX0._bNrkKpLm4vd41LuidWhxqtkzrS01ra43khsX9JexXs",
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDNlMjI2Yy02ZjIzLTRiYTgtOTYzYS0wNmZmMTcwMzg1ZGEiLCJleHAiOjE3NTcxMjcwMDN9.acj11iPJAfeoX4-KN6shovt0MGAntR7sJz9_VI6Lgv8",
      },
    }
  );
};
const tradewizAddCopy = async (address: string) => {
  const data = {
    tag: `交易所_${address.slice(0, 4)}`,
    target: address,
    id: "",
    autoSell: true,
    autoSellParams: '{"settings":{"1500":2000,"3500":8000,"-200":10000}}',
    autoSellTime: 0,
    buyTimes: -1,
    buyTimesResetAfterSold: false,
    copySell: true,
    enableMev: 0,
    enableMevSell: 0,
    enableTrailingStop: false,
    enableTurbo: false,
    enabled: true,
    firstSellPercent: 0,
    ignoreUnburnedLpTokens: false,
    ignoreUnrenouncedLpTokens: false,
    jitoFee: 7000000,
    jitoFeeSell: 0,
    lowerLimitOfOneTransaction: 600000000,
    upperLimitOfOneTransaction: 600000000,
    totalUpperLimit: 650000000,
    maxMc: -1,
    minMc: -1,
    maxTokenAge: 600,
    minTokenAge: -1,
    minLp: -1,
    notCopyPositionAddition: false,
    notifyNoHolding: false,
    onlySell: false,
    priorityFee: 1000000,
    priorityFeeSell: 500000,
    pumpfunSlippageTimes: 18,
    ratio: 100,
    retryTimes: 0,
    sellByPositionProportion: true,
    slippage: 18,
    slippageSell: 30,
    slippagePumpSell: 30,
    targetSolMaxBuy: -1,
    targetSolMinBuy: -1,
    trailingStopActivationBps: 0,
    trailingStopBps: 0,
    copyPumpfun: true,
    copyRaydiumLaunchlab: true,
    copyRaydium: true,
    copyRaydiumCpmm: true,
    copyRaydiumClmm: true,
    copyMeteora: true,
    copyMeteoraDbc: true,
    copyMeteoraDyn: true,
    copyMeteoraDammv2: true,
    copyPumpamm: true,
    copyJupiterAggregator: true,
    copyMoonshot: true,
    copyBoopfun: true,
    copyGavel: true,
    copyVertigo: true,
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
          "Bearer Pvv46lon5qH3C8C2VNda0AWMZVX364yOVWvxWkvBAwfMg8OQD7LxQj4R0iqOAO3rEOuPFf2gwU2Xp3YbvLcGgjdGiqzRF6yBsVlsIvgXiS36Q6FbykG62OTtKth3hJ/vDraQ6yPPjrFm/5ElpZggEiXSJ9LydgWbFRzR/MCV7kXdrXbpDnBGZjEra/0IgRlqV4AfdmT1QWD3oLv/TfZ7AGKACLGSb8JDCra6DGIRnag878UccDdeSrwX6rqPnYcUGnP2xnXrYkMlX7uDVT+kA02qr4DZqOtGkG6bR9FuLZ11JyIXClb5Spazegt2VH2tIN7QGb5AWVjnSfRhoGaXDQ==",
      },
    }
  );
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
    console.error("isNewWallet error:", e);
    return false;
  }
}

// ----------------- 订阅逻辑 -----------------
const baseSubscription: SubscribeRequest = {
  transactions: {
    client: {
      accountInclude: [
        "DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo",
        "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
        "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
        "EgrfLBwkto7y18QPKJu4sXSW2qGPAbXAWvKfyPeV9U7",
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
          await tradewizAddCopy(addr);
        }
      }
      if (walletStats[addr]?.isNew) {
        walletStats[addr].launches++;
        saveWalletStats();
      }
      if (peddingWallets[addr]) {
        clearTimeout(peddingWallets[addr]);
        delete peddingWallets[addr];
        console.log("❌ 取消延时跟单:", addr);
      }
    }
    return;
  }
  // case2: 转账监听
  parseSolTransfers(result).forEach(async (tx) => {
    if (tx.amount > 0.3 && tx.amount < 5.1) {
      const toAddr = tx.to;
      if (tx.from === "EgrfLBwkto7y18QPKJu4sXSW2qGPAbXAWvKfyPeV9U7") {
        // 特殊的一个转账地址可以搞钱
        monKAddCopy(toAddr).catch(console.error);
        sendMessage(
          `💰 特殊转账触发跟单: ${toAddr} https://gmgn.ai/sol/address/${toAddr}`
        ).catch(console.error);
      }
      if (await isNewWallet(toAddr, hash)) {
        walletStats[toAddr] ??= {
          isNew: true,
          transfers: 0,
          launches: 0,
          amount: tx.amount,
        };
        walletStats[toAddr].transfers++;
        saveWalletStats();
        if (tx.amount > 1) {
          console.log("💸等待20分钟执行", toAddr);
          peddingWallets[toAddr] = setTimeout(() => {
            if (followConfigs[toAddr]) return;
            tradewizAddCopy(toAddr).catch(console.error);
            console.log("⏰ 延时跟单:", toAddr, walletStats[toAddr]);
            delete peddingWallets[toAddr];
          }, 20 * 60 * 1000);
        }
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
  if (times <= 1) tradewizAddCopy(address).catch(console.error);

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
