import WebSocket from "ws";

import { env } from "@/lib/env";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class GatewayBridge {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();

  private async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    this.ws = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:18789");

      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
      ws.on("message", (buffer) => {
        const payload = JSON.parse(buffer.toString()) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };

        if (!payload.id) {
          return;
        }

        const pending = this.pending.get(payload.id);
        if (!pending) {
          return;
        }

        this.pending.delete(payload.id);

        if (payload.error) {
          pending.reject(new Error(payload.error.message ?? "Gateway error"));
          return;
        }

        pending.resolve(payload.result);
      });
    });

    return this.ws;
  }

  async call(method: string, params: Record<string, unknown>) {
    const ws = await this.connect();
    const id = ++this.requestId;

    const frame = {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        auth: env.gatewayToken ? { token: env.gatewayToken } : undefined,
      },
    };

    ws.send(JSON.stringify(frame));

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async getConfig() {
    return this.call("config.get", {});
  }

  async patchConfig(patch: Record<string, unknown>, baseHash: string) {
    return this.call("config.patch", {
      raw: JSON.stringify(patch),
      baseHash,
    });
  }
}

let singleton: GatewayBridge | null = null;

export const getGatewayBridge = () => {
  if (!singleton) {
    singleton = new GatewayBridge();
  }

  return singleton;
};
