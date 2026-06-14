export default {
  entry: ['src/index.ts', 'src/lambda.ts', 'test/fixtures/**/index.js'],
  ignore: ['knip.config.ts', 'test/serverless.d.ts'],
  ignoreDependencies: [/^@semantic-release\//],
};
