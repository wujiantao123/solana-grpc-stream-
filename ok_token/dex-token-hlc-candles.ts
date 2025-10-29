import axios from "axios";

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export const getDexTokenHlcCandles = async (
  tokenAddress: string
): Promise<Kline[]> => {
  const now = Date.now();
  const response = await axios.get(
    `https://web3.okx.com/priapi/v5/dex/token/market/dex-token-hlc-candles?chainId=501&address=${tokenAddress}&after=${now}&bar=1m&limit=100&t=${now}`
  );
  if (response.data?.data) {
    const history = response.data.data.map((item: string[]) => ({
      time: Number(item[0]),
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5]),
    }));
    return history;
  }
  return [];
};

export const subTokens = async (tokens: string[]) => {
  const authToken =
    "M0Rp7SbedRTnjlhKLF9awlEB3aP04uYgKYnonsYU8Qudup882HnzasPlpwZsI6UW8VoNYvxIJpUpC2wQ3GRSJNynD8avf6U8K2nw691K7zirM4rnDwgTAapIwInbkjCImXV4Nibjx5SgIA6Vqk1ZJ0ER9Uz16rIzz65BC3S+A8mM6q9ENrei/XugBwASwDLzQwg0+YSmFtDduIqQGdNXh9b46UxJDraWc2J5/yAOXtBOvD3jsh6nLHBn5id8eug/3A1Woj8cxGx0P3lxbfpCS0EV/g0FSzBy9VVRdc7Mcd3l+eP9UB8qOWt/K4TKJVFIqDDBE9gueT1iXXQNUhOsUg==";
  const response = await axios.post(
    "https://extension.tradewiz.ai/api/v1/auth/sub/token",
    {
      tokens,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
  console.log(response.data.data);
};
