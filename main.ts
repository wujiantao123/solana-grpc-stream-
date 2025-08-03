import { subscribe, CommitmentLevel, LaserstreamConfig, SubscribeRequest } from 'helius-laserstream';
import bs58 from 'bs58';
import { Connection, PublicKey } from '@solana/web3.js';
import sendMessage from './sendMessage.js';
const rpcs = ["https://mainnet.helius-rpc.com/?api-key=8b7d781c-41a4-464a-9c28-d243fa4b4490","https://mainnet.helius-rpc.com/?api-key=c64adbb9-8f0e-48b5-8690-a4d8bb4e5486","https://mainnet.helius-rpc.com/?api-key=fa81dd0b-76fc-434b-83d6-48f151e2d3e5"]
const connections = rpcs.map((rpc) => new Connection(rpc, 'confirmed'));
const getConnection = () => {
  const index = Math.floor(Math.random() * connections.length);
  return connections[index];
}
const remark: Record<string, string> = {
  "CD3FfFfLuwrs6pK2LgXiMxmtPTGUz1ubxRcCAJCKn3GE":"dev(资金池) 30%",
  "CLoqH73WdpQyDwVWuQLVeDBEzXLmRNP2RdPsJXQqtfdp":"dev(资金池2) 30%",
  "C3DFKdA7WLFoU1ZrDeJobgEKHrBvDo6FifuuHgwDXGkA":"dev(资金池3) 30% 测试",
  "6wC3QqPtrXtckgPjYaxCfx8aor2KngfyDLzS4gtEoC3G":"dev(资金池4) 30% 测试1",
  "8gFoTGpLW4PbfMazyZviMcwYXm9KmNWDFHBSsMFYSPof":"dev(资金池5) 30% 测试2",
  "7Qdy482vsAdqrby7BzY4KFHKRM6LVLQFMK1bXwSS9NAt":"dev(资金池6) 30%",
  "BKSEQQGCQBZeincv2xQgYVkHv61A6mjsCP6btwqQzkMN":"dev(资金池7) 30% 测试4",
  "7xPp4XMMt2WUS2rLczX3GuewKdSSmtDY87BPUDM7D7HK":"dev(资金池8) 30% 测试5",
  "5feFx3tbHW5NDNzTkQcXWHs9HPbKUHpu75LPHGnwPqJB":"dev(资金池9) 30% 测试6",
  "AWwSN3ZPXvmo4xDMWeHSp2EN7aCu25N6dnE993wJo26k":"dev(资金池10) 30% 测试7",
  "AH6TpKYoWsT4vyAWWZt5eLAUzGjzLR5fscYjcG6WtfZb":"dev(资金池11) 30% 测试8",
  "9givWA6Y12bBPXEYv4Zq8wqxS6bog36kCWV49ZabuoEd":"dev(资金池12) 30% 测试9",
  "J32djC4gWp9VjvhbfvZ8kXdF9aLJ5ERNxn5kxDcm5qQb":"dev(资金池13) 30% 测试10(会开多盘子第二个后再买)",
  "JDHShqNLMQtSDix53Njm1mGLM7h1RUPkEAiBswck9u6T":"dev(资金池14) 30% 测试11",
  "8k6WU2T2Zr27SjrGn7Weuhh7APFYVsZwihWDc569J5Lj":"dev(资金池15) 30%",
  "5MgaApPAup9nXTf7GPNapQgGRNAaBVewBwjWDXMuXLrq":"dev(资金池16) 30% 测试12"
}
const getAddressTransfer = async (address: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000 * 22));
      const signatures = await getConnection().getSignaturesForAddress(new PublicKey(address), { limit: 1 });
      signatures.forEach(async (signature) => {
        try {
          const result = await getConnection().getParsedTransaction(signature.signature, {
            maxSupportedTransactionVersion: 0
          }); 
          if (result) {
            const accountKeys = result.transaction.message.accountKeys.map(item => item.pubkey.toBase58());
            const closeBalance = result.meta ? result.meta.preBalances[1] / 10 ** 9 : 0;
            const source = remark[accountKeys[0]] || accountKeys[0];
            console.log(`source ${source} transfer ${address} -> ${accountKeys[3]}`, closeBalance, signature.signature);
            if (closeBalance > 3 && closeBalance < 4) {
              try {
                await sendMessage(`开盘地址${source}\n https://gmgn.ai/sol/address/${accountKeys[3]}\n`);
              } catch (msgError) {
                console.error(`发送消息失败:`, msgError);
              }
            }
          }
        } catch (txError) {
          console.error(`获取交易详情失败 ${signature.signature}:`, txError);
        }
      });
    } catch (error) {
      console.error(`获取地址转账记录失败 ${address}:`, error);
    }
  }
async function main() {
  const subscriptionRequest: SubscribeRequest = {
    transactions: {
      client: {
        accountInclude: ['BjuD62v9RysrburpKb65UKeaAWRSFyi7pFLLxdE3dPv'],
        accountExclude: [],
        accountRequired: [],
        vote: false,
        failed: false
      }
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

  const config: LaserstreamConfig = {
    apiKey: '',
    endpoint: 'http://84.32.103.140:10060',
  }


  await subscribe(config, subscriptionRequest, async (data) => {
    try {
      const result = data.transaction
      if(result){
        // const signature = bs58.encode(result.transaction.signature);
        const accountKeys = result.transaction.transaction.message.accountKeys.map((buffer:Uint8Array | number[]) => bs58.encode(buffer));
        const searchAccount = accountKeys[1]
        // const preBalances = result.transaction.meta ? result.transaction.meta.preBalances : [];
        // const postBalances = result.transaction.meta ? result.transaction.meta.postBalances : [];
        getAddressTransfer(searchAccount);
      }
    } catch (error) {
      console.error('处理订阅数据时出错:', error);
    }
  }, async (error) => {
    console.error('订阅错误:', error);
    // 重新连接逻辑可以在这里添加
  });
}

main().catch(console.error);
// sendMessage(`开盘地址\n https://gmgn.ai/sol/address/11`);
// getAddressTransfer("2P21gQk1ZVcQYpgxFJbrMWUeysnYxcU8iwGMsbhZLhmg")