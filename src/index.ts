import Serverless from 'serverless';
import Plugin, { Logging } from 'serverless/classes/Plugin';
import { execSync } from 'node:child_process';

class ServerlessShortshaPlugin implements Plugin {
  public readonly hooks: Plugin.Hooks = {};
  public readonly name: string = 'serverless-shortsha-plugin';

  constructor(
    private readonly serverless: Serverless,
    _options: Serverless.Options,
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

    const template =
      this.serverless.service.provider.compiledCloudFormationTemplate;

    Object.keys(template.Resources).forEach((key) => {
      const resource = template.Resources[key];
      if (resource.Type === 'AWS::Lambda::Version') {
        const functionName = resource.Properties.FunctionName.Ref;

        const aliasResource = {
          Type: 'AWS::Lambda::Alias',
          Properties: {
            DeletionPolicy: 'Retain',
            FunctionName: {
              Ref: functionName,
            },
            FunctionVersion: {
              'Fn::GetAtt': [key, 'Version'],
            },
            Name: commitSha,
            Description: `Alias for commit ${commitSha}`,
          },
        };

        template.Resources[`${functionName}Alias${commitSha}`] = aliasResource;

        this.logging.log.notice(
          `Alias "${commitSha}" added for function "${functionName}" in the CloudFormation template`,
        );
      }
    });
  }
}

export = ServerlessShortshaPlugin;
