/** Five retries for transient failures, then require an explicit user retry. */
export function retryDelay(failures: number, status?: number): number | null {
  if (failures > 5 || (status !== undefined && status < 500 && status !== 408 && status !== 429))
    return null;
  return Math.min(5000 * 2 ** (failures - 1), 60000);
}
