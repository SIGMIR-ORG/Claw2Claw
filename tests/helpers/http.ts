import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import type { Express } from "express";

export async function reservePort(): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to reserve port"));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

export async function listenExpress(app: Express, port = 0) {
  return new Promise<{
    port: number;
    origin: string;
    close: () => Promise<void>;
  }>((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const origin = `http://127.0.0.1:${address.port}`;
      resolve({
        port: address.port,
        origin,
        close: async () =>
          await new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          })
      });
    });

    server.once("error", reject);
  });
}
