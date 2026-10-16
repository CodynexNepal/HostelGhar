// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/helpers/app-harness.ts
// PURPOSE: Shared production-style HTTP harness for integration/load/
//          performance suites: boots a real Express server on an ephemeral
//          port with native `fetch`, so tests exercise real sockets,
//          headers, status codes and bodies — no supertest dependency.
// ──────────────────────────────────────────────────────────────────────────────
import 'reflect-metadata';
import express, { Express } from 'express';
import { AddressInfo } from 'net';
import { Server, createServer } from 'http';

export interface StartedApp {
  app: Express;
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}

/** Boots `app` on 127.0.0.1:0 and resolves a closable base URL. */
export const startApp = async (app: Express): Promise<StartedApp> => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    app,
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
};

/** Minimal JSON API surface used by the harnesses (no external deps). */
export const api = {
  get: async (baseUrl: string, path: string, headers: Record<string, string> = {}) => {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return readResponse(res);
  },
  post: async (
    baseUrl: string,
    path: string,
    body: unknown = {},
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return readResponse(res);
  },
};

const readResponse = async (res: Response) => {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    headers: res.headers,
    text,
    json: json as Record<string, unknown> | null,
  };
};

/** Builds a bare production-shaped pipeline: json → routes → 404 → errors. */
export const buildProbeApp = (): Express => {
  const probe = express();
  probe.use(express.json());
  return probe;
};
