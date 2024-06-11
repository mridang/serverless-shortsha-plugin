import Serverless from 'serverless';
import Plugin, { Logging } from 'serverless/classes/Plugin';
import { execSync } from 'node:child_process';

class ServerlessShortshaPlugin implements Plugin {
  public readonly hooks: Plugin.Hooks = {};
  public readonly name: string = 'serverless-shortsha-plugin';

  constructor(
    private readonly serverless: Serverless,
    private readonly options: Serverless.Options,
    private readonly logging: Logging,
  ) {
    this.hooks = {
      'after:aws:package:finalize:mergeCustomProviderResources':
        this.addAliases.bind(this),
    };
  }

  getGitCommitSha(): string | null {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim();
    } catch (error) {
      this.logging.log.notice('Not a Git repository or Git command failed');
      return null;
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

    const stage =
      this.serverless.service.provider.stage || this.options.stage || 'dev';
    const template =
      this.serverless.service.provider.compiledCloudFormationTemplate;

    template.Resources['CustomResourceHandlerLambdaFunction'] = {
      Type: 'AWS::Lambda::Function',
      Properties: {
        FunctionName: `cfn-shortsha-${stage}-resource`,
        Description:
          'A custom resource to manage function aliases for Serverless Framework projects',
        Runtime: 'nodejs20.x',
        Architectures: ['arm64'],
        MemorySize: 128,
        Handler: 'index.handler',
        Role: { 'Fn::GetAtt': ['CustomResourceHandlerLambdaRole', 'Arn'] },
        Code: {
          ZipFile: `
              const { LambdaClient, CreateAliasCommand, DeleteAliasCommand, ListAliasesCommand } = require('@aws-sdk/client-lambda');
              const response = require('cfn-response');

              exports.handler = async (event, context) => {
                console.log(event);
                const lambdaClient = new LambdaClient();
                const functionName = event.ResourceProperties.FunctionName;
                const aliasName = event.ResourceProperties.AliasName;
                const functionVersion = event.ResourceProperties.FunctionVersion;

                try {
                  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
                    const createAliasCommand = new CreateAliasCommand({
                      FunctionName: functionName,
                      Name: aliasName,
                      Description: \`Alias for commit \${aliasName}\`,
                      FunctionVersion: functionVersion,
                    });
                    await lambdaClient.send(createAliasCommand);
                  } else if (event.RequestType === 'Delete') {
                    const listAliasesCommand = new ListAliasesCommand({ FunctionName: functionName });
                    const aliases = await lambdaClient.send(listAliasesCommand);

                    for (const alias of aliases.Aliases) {
                      const deleteAliasCommand = new DeleteAliasCommand({
                        FunctionName: functionName,
                        Name: alias.Name,
                      });
                      await lambdaClient.send(deleteAliasCommand);
                    }
                  }
                  await response.send(event, context, response.SUCCESS, undefined, \`\${functionName}/shortsha\`);
                } catch (error) {
                  console.error(error);
                  await response.send(event, context, response.FAILED, undefined, \`\${functionName}/shortsha\`);
                }
              };
            `,
        },
      },
    };

    template.Resources['CustomResourceHandlerLambdaRole'] = {
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
    };

    Object.keys(template.Resources).forEach((key) => {
      const resource = template.Resources[key];
      if (resource.Type === 'AWS::Lambda::Version') {
        const functionName = resource.Properties.FunctionName.Ref;

        template.Resources[`${functionName}ShortShaAlias`] = {
          Type: 'Custom::LambdaAlias',
          Properties: {
            ServiceToken: {
              'Fn::GetAtt': ['CustomResourceHandlerLambdaFunction', 'Arn'],
            },
            FunctionName: {
              Ref: functionName,
            },
            FunctionVersion: {
              'Fn::GetAtt': [key, 'Version'],
            },
            AliasName: `version-${commitSha}`,
          },
        };

        this.logging.log.notice(
          `Alias "${commitSha}" added for function "${functionName}" in the CloudFormation template`,
        );
      }
    });
  }
}

export = ServerlessShortshaPlugin;
