import { tracer } from './tracer';

export const withSpan = async <T>(name: string, operation: () => Promise<T>): Promise<T> =>
  tracer.startActiveSpan(name, async (span) => {
    try {
      return await operation();
    } finally {
      span.end();
    }
  });
