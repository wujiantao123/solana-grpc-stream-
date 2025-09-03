  import {
    subscribe,
    CommitmentLevel,
    LaserstreamConfig,
    SubscribeRequest,
  } from "helius-laserstream";
  import bs58 from "bs58";
  import { Connection, PublicKey } from "@solana/web3.js";
  import sendMessage from "./sendMessage.js";

  const processedAddresses = new Set();
  const endpoints = ["http://57.129.64.141:10000"];
  const rpcs = [
    "https://mainnet.helius-rpc.com/?api-key=8b7d781c-41a4-464a-9c28-d243fa4b4490",
    "https://mainnet.helius-rpc.com/?api-key=c64adbb9-8f0e-48b5-8690-a4d8bb4e5486",
    "https://mainnet.helius-rpc.com/?api-key=fa81dd0b-76fc-434b-83d6-48f151e2d3e5",
    "https://mainnet.helius-rpc.com/?api-key=14312756-eebe-4d84-9617-59a09fc8c894",
    "https://mainnet.helius-rpc.com/?api-key=c570abef-cd38-40b5-a7d8-c599769f7309",
  ];
  const source: { [address: string]: string } = {
    "DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo": "Coinbase Hot Wallet 4",
    "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "Binance 2",
  }
  const connections = rpcs.map((rpc) => new Connection(rpc, "confirmed"));
  let connectionIndex = 0;

  const getConnection = () => {
    const connection = connections[connectionIndex];
    connectionIndex = (connectionIndex + 1) % connections.length;
    return connection;
  };

  async function isNewWallet(address: string) {
    const pubkey = new PublicKey(address);
    const accountInfo = await getConnection().getAccountInfo(pubkey);
    return accountInfo === null;
  }

  const subscriptionRequest: SubscribeRequest = {
    transactions: {
      client: {
        accountInclude: ["DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo","5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"],
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
            if (!result?.transaction) return;
            // const hash = bs58.encode(Buffer.from(result.transaction.signature));
            const accountKeys: string[] =
              result.transaction.transaction.message.accountKeys.map(
                (b: Uint8Array | number[]) => bs58.encode(b)
              );
            const transferAmount =
              Number(result.transaction.meta.preBalances[0]) -
              Number(result.transaction.meta.postBalances[0]);
            const transferAmountSol = transferAmount / 10 ** 9;
            if (transferAmountSol > 0.3 && transferAmountSol < 3.1) {
              const isNew = await isNewWallet(accountKeys[1]);
              console.log(isNew,accountKeys[1])
              if (isNew) {
                const finalMessage = [
                  `新钱包地址(${transferAmountSol} SOL) 来源${source[accountKeys[0]]}`,
                  `https://gmgn.ai/sol/address/${accountKeys[1]}\n`,
                  `https://webtest.tradewiz.trade/copy.html?address=${accountKeys[1]}\n`,
                ].join("\n");
                await sendMessage(finalMessage);
                console.log(`新钱包发现: ${accountKeys[1]}`);
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
  setInterval(() => {
    processedAddresses.clear();
  }, 1000 * 60 * 5);

  // startAllSubscriptions().catch(console.error);
const main = async ()=>{
  console.log(await isNewWallet("7YuzRvzAHwhqdm9ALqd21dcabhNxUeTWR26wtChRSLjq"))
}
main()


