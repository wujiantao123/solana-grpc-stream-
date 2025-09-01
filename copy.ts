import fs from "fs";
import express from "express";
import axios from "axios";
import {
  subscribe,
  CommitmentLevel,
  LaserstreamConfig,
  SubscribeRequest,
} from "helius-laserstream";
import bs58 from "bs58";

const endpoints = ["http://57.129.64.141:10000"];
const CACHE_FILE = "./followConfigs.json";

// 记录需要跟单的用户配置：{ [address]: { target: number, count: number } }
let followConfigs: Record<string, { target: number; count: number }> = {};

// 读取缓存
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    followConfigs = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    console.log("✅ 跟单地址缓存已加载:", followConfigs);
  }
}

// 保存缓存
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(followConfigs, null, 2));
}

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
    jitoFee: 4000000,
    jitoFeeSell: 0,
    lowerLimitOfOneTransaction: 600000000,
    upperLimitOfOneTransaction: 600000000,
    totalUpperLimit: 700000000,
    maxMc: -1,
    minMc: -1,
    maxTokenAge: -1,
    minTokenAge: -1,
    minLp: -1,
    notCopyPositionAddition: false,
    notifyNoHolding: false,
    onlySell: false,
    priorityFee: 10000000,
    priorityFeeSell: 1000000,
    pumpfunSlippageTimes: 40,
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
  const response = await axios.post(
    "https://copy.fastradewiz.com/api/v1/upsertCopyTrading",
    data,
    {
      headers: {
        authorization:
          "Bearer rBvghG9oJNY6Q23Gt2fcaaRjUNaBlkf4XFwvYBSLLljgCjOgVJmJmrDImHL2DV1rHq4bdQB5OiZeW70JEapU4WogADh6HbjQY+0WxInJ5s1KHy7d+i3oi1sgxZhGWaUxvDjQdWSYzMGp01JUaYjh3YuH5JNdG6P+FTRu7E9r+W4gQXYSTQRtZ7AGkn4l1K97526omRlvbEyLHM040+NmIvx02OSvkmdnomhbHoKLQF06RAI6e6JeA86tewLScAX9TkEivXwuOLafLY6/LjS6GJ54WsaRRAXeZXQvrKQDFsXOqXjIL2xKHQAC1CwlYV1LH+cFaXBJM1rpkwOHcyOL0w==",
      },
    }
  );
  console.log(response);
};
const baseSubscription: SubscribeRequest = {
  transactions: {
    client: {
      accountInclude: [],
      accountExclude: [],
      accountRequired: ["TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM"],
      vote: false,
      failed: false,
    },
  },
  commitment: CommitmentLevel.CONFIRMED,
  accounts: {},
  slots: {},
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  accountsDataSlice: [],
};

async function startAllSubscriptions() {
  for (const endpoint of endpoints) {
    const config: LaserstreamConfig = {
      apiKey: "",
      endpoint,
    };

    await subscribe(
      config,
      baseSubscription,
      async (data) => {
        try {
          const result = data.transaction;
          if (!result?.transaction) return;

          const hash = bs58.encode(Buffer.from(result.transaction.signature));
          const accountKeys =
            result.transaction.transaction.message.accountKeys.map(
              (b: Uint8Array | number[]) => bs58.encode(b)
            );

          // 遍历检查是否有需要跟单的地址
          for (const addr of accountKeys) {
            if (followConfigs[addr]) {
              followConfigs[addr].count += 1;
              console.log(
                `监听到 ${addr} 的第 ${followConfigs[addr].count} 次交易: ${hash}`
              );
              // 保存缓存
              saveCache();
              if (
                followConfigs[addr].count ===
                followConfigs[addr].target - 1
              ) {
                console.log(
                  `⚡ 触发跟单逻辑: ${addr} 在第 ${followConfigs[addr].target} 次交易`
                );
                // TODO: 在这里写你的跟单逻辑
              }
            }
          }
        } catch (err) {
          console.error(`处理订阅数据失败 (${endpoint}):`, err);
        }
      },
      async (err) => {
        console.error(`订阅错误 (${endpoint}):`, err);
      }
    );
    console.log(`已连接 Laserstream 节点: ${endpoint}`);
  }
}

loadCache();
startAllSubscriptions().catch(console.error);

const app = express();
app.use(express.json());

import { Request, Response } from "express";

app.post("/add", (req: Request, res: Response) => {
  const { address, times } = req.body;
  if (!address || !times)
    return res.status(400).json({ error: "需要 address 和 times" });

  followConfigs[address] = {
    target: times,
    count: followConfigs[address]?.count || 0,
  };
  saveCache();
  console.log(`✅ 已添加跟单地址: ${address}, 目标次数: ${times}`);
  if (times <= 1) {
    addCopy(address).catch(console.error);
  }
  res.json({ success: true });
});

app.post("/remove", (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address || !followConfigs[address])
    return res.status(400).json({ error: "地址不存在" });

  delete followConfigs[address];
  saveCache();
  console.log(`🗑 已删除跟单地址: ${address}`);
  res.json({ success: true });
});

app.get("/list", (_req: Request, res: Response) => {
  res.json(followConfigs);
});
app.listen(8125, () => console.log("监听 /add /remove 接口在 8125 端口"));
