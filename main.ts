import { subscribe, CommitmentLevel, LaserstreamConfig, SubscribeRequest } from 'helius-laserstream';

async function main() {
  const subscriptionRequest: SubscribeRequest = {
    transactions: {
      client: {
        accountInclude: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'],
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
    endpoint: '84.32.103.140:10040',
  }

  await subscribe(config, subscriptionRequest, async (data) => {
    console.log(data);
  }, async (error) => {
    console.error(error);
  });
}

main().catch(console.error);