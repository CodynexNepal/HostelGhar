export const writeJsonLog = (entry: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};
