/**
 * @file Knip configuration that declares the entry points and ignores for unused-code checks.
 */
export default {
  entry: ['src/index.ts', 'src/lambda.ts', 'test/fixtures/**/index.js'],
  ignore: ['knip.config.ts', 'test/serverless.d.ts'],
  ignoreDependencies: [/^@semantic-release\//],
};
