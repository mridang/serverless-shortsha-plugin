import Serverless from 'serverless';
// eslint-disable-next-line import/no-unresolved
import Plugin, { Logging } from 'serverless/classes/Plugin';
import { execSync } from 'node:child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

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

  getGitCommitSha(): string | null {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      this.logging.log.notice('Not a Git repository or Git command failed');
      return null;
    }
  }

  addEnvironmentVariable() {
    const commitSha = this.getGitCommitSha();
    if (commitSha !== null) {
      for (const functionName of this.serverless.service.getAllFunctions()) {
        const func = this.serverless.service.getFunction(functionName);

        if (!func.environment) {
          func.environment = {
            SERVICE_VERSION: commitSha,
          };
        } else {
          func.environment['SERVICE_VERSION'] = commitSha;
        }
      }
    }
  }

  addAliases() {
    const commitSha = this.getGitCommitSha();

    if (!commitSha) {
      this.logging.log.notice(
        'Skipping alias creation as the commit SHA could not be determined',
      );
      return;
    }

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
            ZipFile: (() => {
              try {
                return readFileSync(join(__dirname, 'lambda.js'), 'utf8');
              } catch {
                return readFileSync(join(__dirname, 'lambda.ts'), 'utf8');
              }
            })(),
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

export = ServerlessShortshaPlugin;
