/** Retry a function with exponential backoff */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 5000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise((r) => setTimeout(r, delayMs));
    return withRetry(fn, retries - 1, delayMs * 2);
  }
}
