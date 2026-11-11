/**
 * @file Jest global teardown that has no external services to stop.
 */

/* noinspection JSUnusedGlobalSymbols */

/**
 * Releases the shared Jest environment after every test file has finished.
 * @example
 * // Referenced from jest.config.mjs as globalTeardown.
 * await teardown();
 */
export default async function teardown(): Promise<void> {
  // No external services to tear down.
}
