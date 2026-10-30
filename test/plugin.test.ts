import { execSync } from 'node:child_process';
import ServerlessShortshaPlugin from '../src/index';

type Ctor = ConstructorParameters<typeof ServerlessShortshaPlugin>;

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
  const sha = execSync('git rev-parse --short HEAD').toString().trim();

  it('should add the commit sha to every function environment', () => {
    const { plugin, functions } = createPlugin({});

    (plugin.hooks['after:package:initialize'] as () => void)();

    expect(functions.foo.environment).toEqual({
      FOO: 'BAR',
      SERVICE_VERSION: sha,
    });
    expect(functions.bar.environment).toEqual({ SERVICE_VERSION: sha });
  });

  it('should add an alias for every published function version', () => {
    const { plugin, serverless } = createPlugin({
      FooLambdaFunction: { Type: 'AWS::Lambda::Function', Properties: {} },
      FooLambdaVersionabc: {
        Type: 'AWS::Lambda::Version',
        Properties: { FunctionName: { Ref: 'FooLambdaFunction' } },
      },
    });

    (
      plugin.hooks[
        'after:aws:package:finalize:mergeCustomProviderResources'
      ] as () => void
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
