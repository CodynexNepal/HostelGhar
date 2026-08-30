import { dotEnvConfig } from './envConfig';

export interface SocketConfig {
  cors: {
    origin: string[] | string;
    methods: string[];
    credentials: boolean;
  };
  transports: ('websocket' | 'polling')[];
  pingTimeout: number;
  pingInterval: number;
}

const parseOrigins = (value: string): string[] | string => {
  if (!value || value === '*') {
    return '*';
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const socketConfig: SocketConfig = {
  cors: {
    origin: parseOrigins(dotEnvConfig.SOCKET_CORS_ORIGIN),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 25000,
};
