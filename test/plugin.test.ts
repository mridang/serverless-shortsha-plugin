import runServerless from '@serverless/test/run-serverless';
import path from 'path';
// @ts-expect-error since the types are missing
import logEmitter from 'log/lib/emitter.js';
import * as fs from 'node:fs';
import {
  CloudFormationResource,
  CloudFormationResources,
} from 'serverless/plugins/aws/provider/awsProvider';

const logsBuffer: string[] = [];
logEmitter.on(
  'log',
  (event: { logger: { namespace: string }; messageTokens: string[] }) => {
    if (
      !event.logger.namespace.startsWith('serverless:lifecycle') &&
      event.logger.namespace !== 'serverless'
    ) {
      logsBuffer.push(event.messageTokens[0]);
    }
  },
);

describe('plugin tests', () => {
  it('should run shortsha on package', async () => {
    await runServerless(path.join(require.resolve('serverless'), '..', '..'), {
      cwd: path.resolve(__dirname, 'fixtures', 'simple-service'),
      command: 'package',
    });

    const compiledTemplatePath = path.resolve(
      __dirname,
      'fixtures',
      'simple-service',
      '.serverless',
      'cloudformation-template-update-stack.json',
    );
    const compiledTemplate = JSON.parse(
      fs.readFileSync(compiledTemplatePath, 'utf-8'),
    );

    const aliasResources = Object.entries(
      compiledTemplate.Resources as CloudFormationResources,
    ).filter(
      ([, resource]: [string, CloudFormationResource]) =>
        resource.Type === 'AWS::Lambda::Alias',
    );

    expect(aliasResources.length).toEqual(2);

    aliasResources.forEach(
      ([, aliasResource]: [string, CloudFormationResource]) => {
        const aliasName = aliasResource.Properties.Name;
        expect(aliasName).toMatch(/^[0-9a-f]{7}$/); // Match the short SHA format
        expect(aliasResource.Properties.Description).toBe(
          `Alias for commit ${aliasName}`,
        );

        const expectedAliasResource = {
          Type: 'AWS::Lambda::Alias',
          Properties: {
            FunctionName: { Ref: aliasResource.Properties.FunctionName.Ref },
            FunctionVersion: {
              'Fn::GetAtt': [
                expect.stringMatching(new RegExp(`^.*LambdaVersion`)),
                'Version',
              ],
            },
            Name: aliasName,
            Description: aliasResource.Properties.Description,
          },
        };

        expect(aliasResource).toEqual(expectedAliasResource);
      },
    );
    console.log(logsBuffer);

    expect(logsBuffer.join('\n')).toContain(
      'Alias "7ac677f" added for function "FooLambdaFunction" in the CloudFormation template',
    );

    expect(logsBuffer.join('\n')).toContain(
      'Alias "7ac677f" added for function "BarLambdaFunction" in the CloudFormation template',
    );
  });
});
