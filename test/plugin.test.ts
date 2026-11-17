/**
 * @file Behaviour tests for the Serverless plugin that stamps functions and aliases with the commit SHA.
 *
 * The tests drive the plugin hooks against an in-memory Serverless service and compare the results with the
 * short commit hash of the checkout that runs the suite.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ServerlessShortshaPlugin from '../src/index.js';
import type Plugin from 'serverless/classes/Plugin';

type Ctor = ConstructorParameters<typeof ServerlessShortshaPlugin>;

interface FunctionDefinition {
  environment?: Record<string, string>;
}

interface Resource {
  Type: string;
  Properties: unknown;
}

interface CompiledTemplate {
  Resources: Record<string, Resource>;
}

interface FunctionDefinitions {
  [name: string]: FunctionDefinition;
}

/**
 * Builds a plugin instance wired to an in-memory Serverless service with two functions.
 * @param resources - The compiled CloudFormation resources the plugin reads and extends.
 * @returns The plugin together with the fake service and its function map.
 * @example
 * const { plugin, serverless, functions } = createPlugin({});
 */
function createPlugin(resources: Record<string, Resource>) {
  const functions: FunctionDefinitions = {
    foo: { environment: { FOO: 'BAR' } },
    bar: {},
  };
  const template: CompiledTemplate = { Resources: resources };
  const serverless = {
    service: {
      service: 'simple-service',
      provider: {
        stage: 'dev',
        compiledCloudFormationTemplate: template,
      },
      getAllFunctions: () => Object.keys(functions),
      getFunction: (name: string) => functions[name],
    },
  };
  const noop = () => undefined;
  const progress: Plugin.Progress = {
    namespace: 'test',
    name: 'test',
    update: noop,
    info: noop,
    notice: noop,
    remove: noop,
  };
  const logging: Plugin.Logging = {
    log: {
      error: noop,
      warning: noop,
      notice: noop,
      info: noop,
      debug: noop,
      verbose: noop,
      success: noop,
    },
    writeText: noop,
    progress: { get: () => progress, create: () => progress },
  };
  const plugin = new ServerlessShortshaPlugin(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a full Serverless instance needs a real service load; the plugin reads only the service name, provider, and function accessors
    serverless as unknown as Ctor[0],
    {},
    logging,
  );
  return { plugin, template, functions };
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

    await plugin.hooks['after:package:initialize']();

    expect(functions.foo.environment).toEqual({
      FOO: 'BAR',
      SERVICE_VERSION: sha,
    });
    expect(functions.bar.environment).toEqual({ SERVICE_VERSION: sha });
  });

  it('should add an alias for every published function version', async () => {
    const { plugin, template } = createPlugin({
      FooLambdaFunction: { Type: 'AWS::Lambda::Function', Properties: {} },
      FooLambdaVersionabc: {
        Type: 'AWS::Lambda::Version',
        Properties: { FunctionName: { Ref: 'FooLambdaFunction' } },
      },
    });

    await plugin.hooks[
      'after:aws:package:finalize:mergeCustomProviderResources'
    ]();

    const resources = template.Resources;
    expect(resources.CustomResourceHandlerLambdaFunction.Properties).toEqual(
      expect.objectContaining({
        FunctionName: 'cfn-shortsha-simple-service-dev-resource',
      }),
    );
    expect(
      resources.CustomResourceHandlerLambdaFunction.Properties,
    ).toHaveProperty('Code.ZipFile', expect.any(String));
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
