import WebSocket from "ws";
import { EventEmitter } from "events";

class TradeWizSocket extends EventEmitter {
  private ws: WebSocket;

  constructor(authToken: string) {
    super();
    this.ws = new WebSocket(
      `wss://extension.tradewiz.ai/api/v1/ws?auth_token=${encodeURIComponent(authToken)}`
    );

    this.ws.on("open", () => {
      console.log("Connected");
      setInterval(() => this.send("ping"), 10000);
      this.emit("connected");
    });

    this.ws.on("message", (message: WebSocket.Data) => {
      const raw = typeof message === "string" ? message : message.toString();
      try {
        const data = JSON.parse(raw);
        this.emit("message", data);
      } catch (error) {
        this.emit("raw", raw);
      }
    });

    this.ws.on("close", () => this.emit("close"));
    this.ws.on("error", (err) => this.emit("error", err));
  }

  send(data: any) {
    this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
  }
}

export default TradeWizSocket;
