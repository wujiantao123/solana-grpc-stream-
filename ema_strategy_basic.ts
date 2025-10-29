import { Kline } from "./ok_token/dex-token-hlc-candles";
type PositionState = "none" | "long" | "short";
type TradeSignal =
  | "开多" | "加多" | "减多" | "平多"
  | "开空" | "加空" | "减空" | "平空"
  | null;

class EMA {
  period: number;
  k: number;
  current: number | null = null;
  initialized = false;

  constructor(period: number) {
    this.period = period;
    this.k = 2 / (period + 1);
  }

  // ✅ 必须用历史数据初始化，TradingView 同样做法
  tryInit(history: Kline[]): boolean {
    if (history.length < this.period) return false;
    const recentCloses = history.slice(-this.period).map(k => Number(k.close));
    const sum = recentCloses.reduce((a, b) => a + b, 0);
    this.current = sum / this.period; // TradingView的第一个EMA = SMA
    this.initialized = true;
    return true;
  }

  // ✅ 正式更新，每条新K线调用
  update(price: number): number {
    if (!this.initialized || this.current === null) {
      throw new Error("EMA not initialized. Call tryInit() first.");
    }
    this.current = price * this.k + this.current * (1 - this.k);
    return this.current;
  }
}


export class EMAStrategy {
  ema9 = new EMA(9);
  ema25 = new EMA(25);
  ema99 = new EMA(99);

  position: PositionState = "none"; // 当前仓位
  addCount = 0; // 当前加仓次数
  lastSpread = 0; // 上一次 EMA9-EMA25 差值

  maxAddTimes = 3; // 最大加仓次数

  constructor(private history: Kline[]) {
    this.ema9.tryInit(history);
    this.ema25.tryInit(history);
    this.ema99.tryInit(history);
    if (this.ema9.current && this.ema25.current) {
      this.lastSpread = this.ema9.current - this.ema25.current;
    }
  }

  onNewKline(kline: Kline): TradeSignal {
    const close = Number(kline.close);

    if (!this.ema9.initialized || !this.ema25.initialized || !this.ema99.initialized) {
      // 初始化未完成
      this.ema9.tryInit(this.history);
      this.ema25.tryInit(this.history);
      this.ema99.tryInit(this.history);
      return null;
    }

    const prevEma9 = this.ema9.current!;
    const prevEma25 = this.ema25.current!;
    const prevEma99 = this.ema99.current!;

    // 更新 EMA
    const ema9 = this.ema9.update(close);
    const ema25 = this.ema25.update(close);
    const ema99 = this.ema99.update(close);
    console.log("ema9:", ema9, "ema25:", ema25, "ema99:", ema99);

    const spread = ema9 - ema25;
    let signal: TradeSignal = null;

    // 多头趋势
    if (ema25 > ema99) {
      if (this.position === "none" && prevEma9 <= prevEma25 && ema9 > ema25) {
        signal = "开多";
        this.position = "long";
        this.addCount = 0;
      } else if (this.position === "long") {
        // 趋势增强 -> 加仓
        if (spread > this.lastSpread && this.addCount < this.maxAddTimes) {
          signal = "加多";
          this.addCount += 1;
        }
        // 趋势减弱 -> 减仓
        else if (spread < this.lastSpread * 0.7) {
          signal = "减多";
        }
        // EMA9下穿EMA25 -> 平仓
        if (ema9 < ema25) {
          signal = "平多";
          this.position = "none";
          this.addCount = 0;
        }
      }
    }

    // 空头趋势
    else if (ema25 < ema99) {
      if (this.position === "none" && prevEma9 >= prevEma25 && ema9 < ema25) {
        signal = "开空";
        this.position = "short";
        this.addCount = 0;
      } else if (this.position === "short") {
        if (spread < this.lastSpread && this.addCount < this.maxAddTimes) {
          signal = "加空";
          this.addCount += 1;
        } else if (spread > this.lastSpread * 0.7) {
          signal = "减空";
        }
        if (ema9 > ema25) {
          signal = "平空";
          this.position = "none";
          this.addCount = 0;
        }
      }
    }

    this.lastSpread = spread;
    this.history.push(kline);
    return signal;
  }
}