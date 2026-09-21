/** Stop on the fifth consecutive failure, then require an explicit user retry. */
export function retryDelay(failures: number, status?: number): number | null {
  if (failures >= 5 || status === 401) return null;
  return Math.min(5000 * 2 ** (failures - 1), 60000);
}
