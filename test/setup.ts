/**
 * @file Jest global setup that starts no external services, since the suite needs none.
 */

/* noinspection JSUnusedGlobalSymbols */

/**
 * Prepares the shared Jest environment before any test file runs.
 * @example
 * // Referenced from jest.config.mjs as globalSetup.
 * await setup();
 */
export default async function setup(): Promise<void> {
  // No external services are required for the test suite.
}
