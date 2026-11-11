/**
 * @file Behaviour tests for the Serverless plugin that stamps functions and aliases with the commit SHA.
 *
 * The tests drive the plugin hooks against an in-memory Serverless service and compare the results with the
 * short commit hash of the checkout that runs the suite.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ServerlessShortshaPlugin from '../src/index';

type Ctor = ConstructorParameters<typeof ServerlessShortshaPlugin>;

/**
 * Builds a plugin instance wired to an in-memory Serverless service with two functions.
 * @param resources - The compiled CloudFormation resources the plugin reads and extends.
 * @returns The plugin together with the fake service and its function map.
 * @example
 * const { plugin, serverless, functions } = createPlugin({});
 */
function createPlugin(resources: Record<string, unknown>) {
  const functions: Record<string, { environment?: Record<string, string> }> = {
    foo: { environment: { FOO: 'BAR' } },
    bar: {},
  };
  const serverless = {
    service: {
      service: 'simple-service',
      provider: {
        stage: 'dev',
        compiledCloudFormationTemplate: { Resources: resources },
      },
      getAllFunctions: () => Object.keys(functions),
      getFunction: (name: string) => functions[name],
    },
  };
  const noop = () => undefined;
  const logging = {
    log: { info: noop, notice: noop, success: noop, error: noop },
  };
  const plugin = new ServerlessShortshaPlugin(
    serverless as unknown as Ctor[0],
    {} as Ctor[1],
    logging as unknown as Ctor[2],
  );
  return { plugin, serverless, functions };
}

describe('plugin tests', () => {
  let sha: string;

  beforeAll(async () => {
    const { stdout } = await promisify(execFile)('git', [
      'rev-parse',
      '--short',
      'HEAD',
    ]);
    sha = stdout.trim();
  });

  it('should add the commit sha to every function environment', async () => {
    const { plugin, functions } = createPlugin({});

    await (plugin.hooks['after:package:initialize'] as () => Promise<void>)();

    expect(functions.foo.environment).toEqual({
      FOO: 'BAR',
      SERVICE_VERSION: sha,
    });
    expect(functions.bar.environment).toEqual({ SERVICE_VERSION: sha });
  });

  it('should add an alias for every published function version', async () => {
    const { plugin, serverless } = createPlugin({
      FooLambdaFunction: { Type: 'AWS::Lambda::Function', Properties: {} },
      FooLambdaVersionabc: {
        Type: 'AWS::Lambda::Version',
        Properties: { FunctionName: { Ref: 'FooLambdaFunction' } },
      },
    });

    await (
      plugin.hooks[
        'after:aws:package:finalize:mergeCustomProviderResources'
      ] as () => Promise<void>
    )();

    const resources = serverless.service.provider.compiledCloudFormationTemplate
      .Resources as Record<string, { Type: string; Properties: unknown }>;
    expect(resources.CustomResourceHandlerLambdaFunction.Properties).toEqual(
      expect.objectContaining({
        FunctionName: 'cfn-shortsha-simple-service-dev-resource',
        Code: { ZipFile: expect.any(String) },
      }),
    );
    expect(resources.CustomResourceHandlerLambdaRole.Type).toBe(
      'AWS::IAM::Role',
    );
    expect(resources.FooLambdaFunctionShortShaAlias).toEqual({
      Type: 'Custom::LambdaAlias',
      Properties: {
        ServiceToken: {
          'Fn::GetAtt': ['CustomResourceHandlerLambdaFunction', 'Arn'],
        },
        FunctionName: { Ref: 'FooLambdaFunction' },
        FunctionVersion: { 'Fn::GetAtt': ['FooLambdaVersionabc', 'Version'] },
        AliasName: `version-${sha}`,
      },
    });
  });
});
