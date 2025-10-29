import { EMAStrategy } from "./ema_strategy_basic";
import { getDexTokenHlcCandles, Kline } from "./ok_token/dex-token-hlc-candles";
import TradeWizSocket from "./socker_handle";
import { addMinutes, format } from "date-fns";
const tokenKline = await getDexTokenHlcCandles(
    "HxSY3hRZDaf38GxkmktdYHdY6SuWdfvu2vzBP7sPpump"
  );
let lastTicket = tokenKline[tokenKline.length - 1];
let lastTime = tokenKline[tokenKline.length - 1].time;
const strategy = new EMAStrategy(tokenKline);
interface KLineEvent {
  buy_or_sell: 0 | 1 | 2 | 3 | 4;
  coin_amount: number;
  fee: string;
  id: number;
  on_chain_time: string;
  platform: string;
  pool_coin: string;
  inner_index: number;
  pool_pc: string;
  price_usd: string;
  signature: string;
  signer: string;
  sol_amount: string;
  block_id: number;
  token_address: string;
  market_address: string;
  trade_usd: string;
  trade_sol: string;
}
const getCurrTime = (tm: number) => {
  const minu = new Date(tm).getMinutes();
  const interval = 1;
  const offset = Math.ceil(minu / interval) * interval - minu || interval;
  const date = new Date(tm);
  const formattedTime = format(date, "yyyy-MM-dd HH:mm");
  return addMinutes(new Date(formattedTime), offset).getTime();
}

const getLatestBar = (item: KLineEvent) => {
  if (!lastTicket) return;
  const price = Number(item.price_usd);
  const time = new Date(item.on_chain_time).getTime();
  const updateBar = (isNewBar: boolean) => {
    if (!lastTicket) return;
    if (isNewBar) {
      lastTicket = {
        open: lastTicket.close,
        close: price,
        high: price,
        low: price,
        time: time,
        volume: price,
      };
    } else {
      if (Number(price) < Number(lastTicket.low)) {
        lastTicket.low = price;
      } else if (Number(price) > Number(lastTicket.high)) {
        lastTicket.high = price;
      }
      lastTicket.close = price;
      lastTicket.volume = (Number(lastTicket.volume) + price);
    }
  };
  if (time > lastTime) {
    lastTime = getCurrTime(time);
    updateBar(true);
  } else {
    updateBar(false);
  }
  return lastTicket;
};
const authToken =
  "M0Rp7SbedRTnjlhKLF9awlEB3aP04uYgKYnonsYU8Qudup882HnzasPlpwZsI6UW8VoNYvxIJpUpC2wQ3GRSJNynD8avf6U8K2nw691K7zirM4rnDwgTAapIwInbkjCImXV4Nibjx5SgIA6Vqk1ZJ0ER9Uz16rIzz65BC3S+A8mM6q9ENrei/XugBwASwDLzQwg0+YSmFtDduIqQGdNXh9b46UxJDraWc2J5/yAOXtBOvD3jsh6nLHBn5id8eug/3A1Woj8cxGx0P3lxbfpCS0EV/g0FSzBy9VVRdc7Mcd3l+eP9UB8qOWt/K4TKJVFIqDDBE9gueT1iXXQNUhOsUg==";
const socket = new TradeWizSocket(authToken);
socket.on("message", (data) => {
  if (data.Type === "price") {
    const newActivities = data.Activities[0];
    const tokenAddress = newActivities.token_address;
    if ([1, 2].includes(newActivities.buy_or_sell)){
      if (tokenAddress === "HxSY3hRZDaf38GxkmktdYHdY6SuWdfvu2vzBP7sPpump") {
        const subLastData = getLatestBar(newActivities);
        if(subLastData){
          const result = strategy.onNewKline(subLastData)
          if(result){
            console.log(result,'result')
          }
        }
      }
    }
  }
});