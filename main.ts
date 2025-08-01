import { subscribe, CommitmentLevel, LaserstreamConfig, SubscribeRequest } from 'helius-laserstream';
import bs58 from 'bs58';
import { Connection, PublicKey } from '@solana/web3.js';
const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=c64adbb9-8f0e-48b5-8690-a4d8bb4e5486", "confirmed");
const getAddressTransfer = async (address: string) => {
    const signatures = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 1 });
    signatures.forEach(async (signature) => {
      const result = await connection.getParsedTransaction(signature.signature, {
        maxSupportedTransactionVersion: 0
      }); 
      if (result) {
        const accountKeys = result.transaction.message.accountKeys.map(item => item.pubkey.toBase58());
        const closeBalance = result.meta ? result.meta.preBalances[1] / 10 ** 9 : 0;
        console.log(`transfer ${address} -> ${accountKeys[2]}`, closeBalance,signature.signature);
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
      const signature = bs58.encode(result.transaction.signature);
      const accountKeys = result.transaction.transaction.message.accountKeys.map((buffer:Uint8Array | number[]) => bs58.encode(buffer));
      const searchAccount = accountKeys[1]
      const preBalances = result.transaction.meta ? result.transaction.meta.preBalances : [];
      const postBalances = result.transaction.meta ? result.transaction.meta.postBalances : [];
      const balance = (postBalances[1] - preBalances[1]) / 10 ** 9;
      console.log(`signature: ${signature}, account: ${searchAccount}, balance: ${balance}`);
      if(balance>3&&balance<4){
        getAddressTransfer(searchAccount);
      }
    }
  }, async (error) => {
    console.error(error);
  });
}

main().catch(console.error);
// getAddressTransfer("2P21gQk1ZVcQYpgxFJbrMWUeysnYxcU8iwGMsbhZLhmg")