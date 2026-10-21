/** Deep copy of plain JSON data (game state contains nothing else). */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
