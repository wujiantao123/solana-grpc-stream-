import { subscribe, CommitmentLevel, LaserstreamConfig, SubscribeRequest } from 'helius-laserstream';
import bs58 from 'bs58';
import { Connection, PublicKey } from '@solana/web3.js';
import sendMessage from './sendMessage.js';
const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=c64adbb9-8f0e-48b5-8690-a4d8bb4e5486", "confirmed");
const getAddressTransfer = async (address: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000 * 20));
    const signatures = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 1 });
    signatures.forEach(async (signature) => {
      const result = await connection.getParsedTransaction(signature.signature, {
        maxSupportedTransactionVersion: 0
      }); 
      if (result) {
        const accountKeys = result.transaction.message.accountKeys.map(item => item.pubkey.toBase58());
        const closeBalance = result.meta ? result.meta.preBalances[1] / 10 ** 9 : 0;
        console.log(`transfer ${address} -> ${accountKeys[3]}`, closeBalance, signature.signature);
        if (closeBalance > 3 && closeBalance < 4) {
          await sendMessage(`开盘地址\n https://gmgn.ai/sol/address/${accountKeys[3]}`);
        }
      }
    });
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
    endpoint: 'http://84.32.103.140:10040',
  }


  await subscribe(config, subscriptionRequest, async (data) => {
    const result = data.transaction
    if(result){
      // const signature = bs58.encode(result.transaction.signature);
      const accountKeys = result.transaction.transaction.message.accountKeys.map((buffer:Uint8Array | number[]) => bs58.encode(buffer));
      const searchAccount = accountKeys[1]
      // const preBalances = result.transaction.meta ? result.transaction.meta.preBalances : [];
      // const postBalances = result.transaction.meta ? result.transaction.meta.postBalances : [];
      getAddressTransfer(searchAccount);
    }
  }, async (error) => {
    console.error(error);
  });
}

main().catch(console.error);
// sendMessage(`开盘地址\n https://gmgn.ai/sol/address/11`);
// getAddressTransfer("2P21gQk1ZVcQYpgxFJbrMWUeysnYxcU8iwGMsbhZLhmg")