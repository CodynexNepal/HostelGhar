declare module 'geoip-lite' {
  export interface Lookup {
    range: [number, number];
    country: string;
    region: string;
    eu: string;
    timezone: string;
    city: string;
    ll: [number, number];
    metro: number;
    area: number;
  }

  export function lookup(ip: string): Lookup | null;
  export function pretty(ip: number | string | number[]): string;
  export function startWatchingDataUpdate(cb?: (err?: Error) => void): void;
  export function stopWatchingDataUpdate(): void;

  const geoip: {
    lookup: typeof lookup;
    pretty: typeof pretty;
    startWatchingDataUpdate: typeof startWatchingDataUpdate;
    stopWatchingDataUpdate: typeof stopWatchingDataUpdate;
  };

  export default geoip;
}

