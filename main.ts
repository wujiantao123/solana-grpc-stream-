import {
  subscribe,
  CommitmentLevel,
  LaserstreamConfig,
  SubscribeRequest,
} from "helius-laserstream";
import bs58 from "bs58";
import { Connection, PublicKey } from "@solana/web3.js";
import sendMessage from "./sendMessage.js";
import fs from "fs";
const filePath = "./sourceAddress.json";

const writeFile = (filePath: string, data: any): void => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log("sourceAddress 已保存");
  } catch (error) {
    console.error(`写入文件失败: ${filePath}`, error);
  }
};

const readFile = (filePath: string): Record<string, string[]> => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error);
    return {};
  }
};
const sourceAddress = readFile(filePath);
const processedAddresses = new Set();
const endpoints = [
  "http://84.32.103.140:10040",
  "http://84.32.103.140:10050",
  "http://84.32.103.140:10060",
  "http://84.32.103.140:10070"
];
const rpcs = [
  "https://mainnet.helius-rpc.com/?api-key=8b7d781c-41a4-464a-9c28-d243fa4b4490",
  "https://mainnet.helius-rpc.com/?api-key=c64adbb9-8f0e-48b5-8690-a4d8bb4e5486",
  "https://mainnet.helius-rpc.com/?api-key=fa81dd0b-76fc-434b-83d6-48f151e2d3e5",
  "https://mainnet.helius-rpc.com/?api-key=14312756-eebe-4d84-9617-59a09fc8c894",
  "https://mainnet.helius-rpc.com/?api-key=c570abef-cd38-40b5-a7d8-c599769f7309"
];
const connections = rpcs.map((rpc) => new Connection(rpc, "confirmed"));
let connectionIndex = 0;

const getConnection = () => {
  const connection = connections[connectionIndex];
  connectionIndex = (connectionIndex + 1) % connections.length;
  return connection;
};


const remark: Record<string, string> = {
  CD3FfFfLuwrs6pK2LgXiMxmtPTGUz1ubxRcCAJCKn3GE: "dev(资金池)",
  CLoqH73WdpQyDwVWuQLVeDBEzXLmRNP2RdPsJXQqtfdp: "dev(资金池2)",
  C3DFKdA7WLFoU1ZrDeJobgEKHrBvDo6FifuuHgwDXGkA: "dev(资金池3) 测试",
  "6wC3QqPtrXtckgPjYaxCfx8aor2KngfyDLzS4gtEoC3G": "dev(资金池4) 测试1",
  "8gFoTGpLW4PbfMazyZviMcwYXm9KmNWDFHBSsMFYSPof": "dev(资金池5) 测试2",
  "7Qdy482vsAdqrby7BzY4KFHKRM6LVLQFMK1bXwSS9NAt": "dev(资金池6)",
  BKSEQQGCQBZeincv2xQgYVkHv61A6mjsCP6btwqQzkMN: "dev(资金池7) 测试4",
  "7xPp4XMMt2WUS2rLczX3GuewKdSSmtDY87BPUDM7D7HK": "dev(资金池8) 测试5",
  "5feFx3tbHW5NDNzTkQcXWHs9HPbKUHpu75LPHGnwPqJB": "dev(资金池9) 测试6",
  AWwSN3ZPXvmo4xDMWeHSp2EN7aCu25N6dnE993wJo26k: "dev(资金池10) 测试7",
  AH6TpKYoWsT4vyAWWZt5eLAUzGjzLR5fscYjcG6WtfZb: "dev(资金池11) 测试8",
  "9givWA6Y12bBPXEYv4Zq8wqxS6bog36kCWV49ZabuoEd": "dev(资金池12) 测试9",
  J32djC4gWp9VjvhbfvZ8kXdF9aLJ5ERNxn5kxDcm5qQb:
    "dev(资金池13) 测试10(会开多盘子第二个后再买)",
  JDHShqNLMQtSDix53Njm1mGLM7h1RUPkEAiBswck9u6T: "dev(资金池14) 测试11",
  "8k6WU2T2Zr27SjrGn7Weuhh7APFYVsZwihWDc569J5Lj": "dev(资金池15)",
  "5MgaApPAup9nXTf7GPNapQgGRNAaBVewBwjWDXMuXLrq": "dev(资金池16) 测试12",
  HJBRf3mWVx23JDaR53EiKSCit4p2wpuUGJ8dia26Zggv:
    "dev(资金池17) 测试13(开盘第三笔)",
  AGqsKu6ytcLrPNnBtR5pwXth2gqoViejbwjbCfp5Jg4M: "dev(资金池18)",
  "5CCLxiPKVjvsmCccWGNc9ZQPmJrQJVR3f6ZiEGqUqo9n": "dev(资金池19)",
  DqH3MRAz3nSEm5okWmxmEAXj7N2KETfmeAiQ3G9r6N2G: "dev(资金池20)",
  GYLsbdX5CDoASWt5pnAKc5VvNVkoUi5bAq9e4XAZFxrn: "dev(资金池21)",
  "4gj8Wc3RL4QmXe57yvvHJisALYBGsb2jRX96vvoYLVtv": "dev(资金池22)",
  "9YYoQCGQLfAzU7u5w8PHvrAhZw1dE7Btze2AcJhv3pkg": "dev(资金池23)",
  DDpoyHiPf2YeTA4tC5V6wfMSLyTDNrLgKwQg4JTyBNU2: "dev(资金池24)",
};
const subscriptionRequest: SubscribeRequest = {
  transactions: {
    client: {
      accountInclude: ["BjuD62v9RysrburpKb65UKeaAWRSFyi7pFLLxdE3dPv"],
      accountExclude: [],
      accountRequired: [],
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
const getAddressTransfer = async (address: string, retryCount = 0) => {
  if(retryCount > 3) {
    console.error(`重试次数过多，跳过地址: ${address}`);
    return;
  }
  if (processedAddresses.has(address)) {
    return;
  }
  processedAddresses.add(address);
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000 * 22));
    const signatures = await getConnection().getSignaturesForAddress(
      new PublicKey(address),
      { limit: 1 }
    );
    signatures.forEach(async (signature) => {
      try {
        const result = await getConnection().getParsedTransaction(
          signature.signature,
          {
            maxSupportedTransactionVersion: 0,
          }
        );
        if (result) {
          const accountKeys = result.transaction.message.accountKeys?.map(
            (item) => item.pubkey.toBase58()
          );
          const closeBalance = result.meta
            ? result.meta.preBalances[1] / 10 ** 9
            : 0;
          const source = remark[accountKeys[0]] || accountKeys[0];
          console.log(
            `source ${source} transfer ${address} -> ${accountKeys[3]}`,
            closeBalance,
            signature.signature
          );
          if (
            (closeBalance > 3 && closeBalance < 3.6) ||
            (closeBalance > 2 && closeBalance < 2.3)
          ) {
            const logs: string[] = [];
            const tasks = (sourceAddress[source] || []).map(async (item, index) => {
              const info = await getAddressHolding(item);
              if (!info || info[0] === 0) return null;

              const profitableCount = info[1].filter(
                (pnl: string) => Number(pnl) > 30
              ).length;
              const winRate = ((profitableCount / info[0]) * 100).toFixed(2);
              const log = `地址 ${item.slice(0, 6)} | 开盘: ${
                info[0]
              } | 盈利: ${profitableCount} | 胜率: ${winRate}% | 盈亏: ${info[1].join(
                ","
              )}`;
              return { index, log };
            });

            const results = await Promise.all(tasks);
            results
              .filter(
                (res): res is { index: number; log: string } => res !== null
              )
              .sort((a, b) => a.index - b.index)
              .forEach((res) => logs.push(res.log));

            if (sourceAddress[source]) {
              sourceAddress[source].unshift(accountKeys[3]);
              if (sourceAddress[source].length > 5) {
                sourceAddress[source].pop();
              }
            } else {
              sourceAddress[source] = [accountKeys[3]];
            }
            writeFile(filePath, sourceAddress);
            try {
              const finalMessage = [
                `开盘地址(${closeBalance.toFixed(2)} SOL)${source}`,
                `https://gmgn.ai/sol/address/${accountKeys[3]}`,
                ...logs,
              ].join("\n");
              await sendMessage(finalMessage);
            } catch (msgError) {
              console.error(`发送消息失败:`, msgError);
            }
          }
        }
      } catch (txError) {
        processedAddresses.delete(address);
        await getAddressTransfer(address, retryCount + 1);
        console.error(`获取交易详情失败 ${signature.signature}:`, txError);
      }
    });
  } catch (error) {
    
    console.error(`获取地址转账记录失败 ${address}:`, error);
  }
};

async function startAllSubscriptions() {
  for (const endpoint of endpoints) {
    const config: LaserstreamConfig = {
      apiKey: "",
      endpoint,
    };

    await subscribe(
      config,
      subscriptionRequest,
      async (data) => {
        try {
          const result = data.transaction;
          if (result) {
            const accountKeys =
              result.transaction.transaction.message.accountKeys.map(
                (buffer: Uint8Array | number[]) => bs58.encode(buffer)
              );
            const searchAccount = accountKeys[1];
            getAddressTransfer(searchAccount);
          }
        } catch (err) {
          console.error(`处理订阅数据失败 (${endpoint}):`, err);
        }
      },
      async (err) => {
        // console.error(`订阅错误 (${endpoint}):`, err);
      }
    );

    console.log(`已连接 Laserstream 节点: ${endpoint}`);
  }
}
async function getAddressHolding(wallet: string) {
  const response = await fetch("https://tradewiz.ai/api/v2/wallet/holding", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie:
        "login_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsb2dpbiIsImV4cCI6MTc3Nzg5MTAxMywianRpIjoiMzgifQ.c1jgAICo8uWVvDTJZidjq-Q69K8rE4c-MYO4XHpB5DQ; _ga=GA1.1.1043995264.1754480254; _ga_3XSMJ94W9X=GS2.1.s1754480254$o1$g1$t1754480291$j23$l0$h0",
    },
    body: JSON.stringify({
      limit: 20,
      wallet: wallet,
      sort_by: "last_active",
      sort_value: "asc",
      filter: { is_holding: false },
      next: "",
    }),
  });
  const data = await response.json();
  if (!data || !data.data) {
    return;
  }
  const holdings = data.data.data;
  if (!holdings || holdings.length === 0) {
    return;
  }
  const totalPnl: string[] = [];
  holdings.forEach((item: { realized_pnl: string }) => {
    totalPnl.push(Number(item.realized_pnl).toFixed(2));
  });
  return [holdings.length, totalPnl];
}
setInterval(() => {
  processedAddresses.clear();
}, 1000 * 60 * 5);

startAllSubscriptions().catch(console.error);