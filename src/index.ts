/**
 * @file Serverless Framework plugin that tags functions with the short Git SHA and adds matching aliases.
 *
 * The plugin records the current short commit hash as a `SERVICE_VERSION` environment variable on every
 * function and creates a `version-<sha>` alias for each published Lambda version through a custom resource.
 */
import Serverless from 'serverless';

import Plugin, { Logging } from 'serverless/classes/Plugin';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

/**
 * Reads the bundled custom resource handler, preferring the compiled `lambda.js` over the TypeScript source.
 * @returns The source text of the custom resource handler.
 * @example
 * const zipFile = await readLambdaSource();
 */
async function readLambdaSource(): Promise<string> {
  try {
    return await readFile(new URL('lambda.js', import.meta.url), 'utf8');
  } catch {
    return readFile(new URL('lambda.ts', import.meta.url), 'utf8');
  }
}

/**
 * Serverless plugin that stamps functions with the commit SHA and aliases every published Lambda version to it.
 */
class ServerlessShortshaPlugin implements Plugin {
  public readonly hooks: Plugin.Hooks = {};
  public readonly name: string = 'serverless-shortsha-plugin';
  private readonly stage: string;

  constructor(
    private readonly serverless: Serverless,
    private readonly options: Serverless.Options,
    private readonly logging: Logging,
  ) {
    this.hooks = {
      'after:package:initialize': this.addEnvironmentVariable.bind(this),
      'after:aws:package:finalize:mergeCustomProviderResources':
        this.addAliases.bind(this),
    };
    this.stage =
      this.serverless.service.provider.stage || this.options.stage || 'dev';
  }

  /**
   * Resolves the short commit hash of the current Git checkout.
   *
   * A failed Git invocation, such as running outside a repository, is logged as a notice and yields null.
   * @returns The abbreviated commit hash, or null when Git cannot report one.
   * @example
   * const commitSha = await plugin.getGitCommitSha();
   */
  async getGitCommitSha(): Promise<string | null> {
    try {
      const { stdout } = await promisify(execFile)('git', [
        'rev-parse',
        '--short',
        'HEAD',
      ]);
      return stdout.trim();
    } catch {
      this.logging.log.notice('Not a Git repository or Git command failed');
      return null;
    }
  }

  /**
   * Sets the `SERVICE_VERSION` environment variable on every function to the current commit SHA.
   *
   * Functions that already define environment variables keep them; the commit SHA is added alongside.
   * @example
   * await plugin.addEnvironmentVariable();
   */
  async addEnvironmentVariable(): Promise<void> {
    const commitSha = await this.getGitCommitSha();
    if (commitSha !== null) {
      for (const functionName of this.serverless.service.getAllFunctions()) {
        const func = this.serverless.service.getFunction(functionName);

        if (func.environment) {
          func.environment['SERVICE_VERSION'] = commitSha;
        } else {
          func.environment = {
            SERVICE_VERSION: commitSha,
          };
        }
      }
    }
  }

  /**
   * Adds the alias custom resource and one `version-<sha>` alias per published Lambda version to the template.
   *
   * Nothing is added when the commit SHA cannot be determined, and the compiled template is left untouched.
   * @example
   * await plugin.addAliases();
   */
  async addAliases(): Promise<void> {
    const commitSha = await this.getGitCommitSha();

    if (!commitSha) {
      this.logging.log.notice(
        'Skipping alias creation as the commit SHA could not be determined',
      );
      return;
    }

    const handlerSource = await readLambdaSource();
    const template =
      this.serverless.service.provider.compiledCloudFormationTemplate;

    template.Resources = {
      ...template.Resources,
      CustomResourceHandlerLambdaFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          FunctionName: `cfn-shortsha-${this.serverless.service.service}-${this.stage}-resource`,
          Description:
            'A custom resource to manage function aliases for Serverless Framework projects',
          Runtime: 'nodejs20.x',
          Architectures: ['arm64'],
          MemorySize: 128,
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['CustomResourceHandlerLambdaRole', 'Arn'] },
          Code: {
            ZipFile: handlerSource,
          },
        },
      },
      CustomResourceHandlerLambdaRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'lambda.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          Policies: [
            {
              PolicyName: 'CustomResourcePolicy',
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: [
                      'logs:*',
                      'lambda:CreateAlias',
                      'lambda:UpdateAlias',
                      'lambda:DeleteAlias',
                      'lambda:ListAliases',
                    ],
                    Resource: '*',
                  },
                ],
              },
            },
          ],
        },
      },
      ...Object.entries(template.Resources)
        .filter(([, resource]) => resource.Type === 'AWS::Lambda::Version')
        .reduce(
          (acc, [key, resource]) => {
            const functionName = resource.Properties.FunctionName.Ref;
            this.logging.log.info(
              `Alias "${commitSha}" added for function "${functionName}"`,
            );

            return {
              ...acc,
              [`${functionName}ShortShaAlias`]: {
                Type: 'Custom::LambdaAlias',
                Properties: {
                  ServiceToken: {
                    'Fn::GetAtt': [
                      'CustomResourceHandlerLambdaFunction',
                      'Arn',
                    ],
                  },
                  FunctionName: { Ref: functionName },
                  FunctionVersion: { 'Fn::GetAtt': [key, 'Version'] },
                  AliasName: `version-${commitSha}`,
                },
              },
            };
          },
          {} as { [key: string]: object },
        ),
    };
  }
}

export default ServerlessShortshaPlugin;
