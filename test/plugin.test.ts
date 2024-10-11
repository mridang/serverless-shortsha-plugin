import runServerless from '@serverless/test/run-serverless';
import path from 'path';
// @ts-expect-error since the types are missing
import logEmitter from 'log/lib/emitter.js';
import * as fs from 'node:fs';

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

    expect(compiledTemplate.Resources).toEqual({
      ServerlessDeploymentBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [
              {
                ServerSideEncryptionByDefault: {
                  SSEAlgorithm: 'AES256',
                },
              },
            ],
          },
        },
      },
      ServerlessDeploymentBucketPolicy: {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          Bucket: {
            Ref: 'ServerlessDeploymentBucket',
          },
          PolicyDocument: {
            Statement: [
              {
                Action: 's3:*',
                Effect: 'Deny',
                Principal: '*',
                Resource: [
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':s3:::',
                        {
                          Ref: 'ServerlessDeploymentBucket',
                        },
                        '/*',
                      ],
                    ],
                  },
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':s3:::',
                        {
                          Ref: 'ServerlessDeploymentBucket',
                        },
                      ],
                    ],
                  },
                ],
                Condition: {
                  Bool: {
                    'aws:SecureTransport': false,
                  },
                },
              },
            ],
          },
        },
      },
      FooLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
          LogGroupName: '/aws/lambda/simple-service-dev-foo',
        },
      },
      BarLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
          LogGroupName: '/aws/lambda/simple-service-dev-bar',
        },
      },
      IamRoleLambdaExecution: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: ['lambda.amazonaws.com'],
                },
                Action: ['sts:AssumeRole'],
              },
            ],
          },
          Policies: [
            {
              PolicyName: {
                'Fn::Join': ['-', ['simple-service', 'dev', 'lambda']],
              },
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: [
                      'logs:CreateLogStream',
                      'logs:CreateLogGroup',
                      'logs:TagResource',
                    ],
                    Resource: [
                      {
                        'Fn::Sub':
                          'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/simple-service-dev*:*',
                      },
                    ],
                  },
                  {
                    Effect: 'Allow',
                    Action: ['logs:PutLogEvents'],
                    Resource: [
                      {
                        'Fn::Sub':
                          'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/simple-service-dev*:*:*',
                      },
                    ],
                  },
                ],
              },
            },
          ],
          Path: '/',
          RoleName: {
            'Fn::Join': [
              '-',
              [
                'simple-service',
                'dev',
                {
                  Ref: 'AWS::Region',
                },
                'lambdaRole',
              ],
            ],
          },
        },
      },
      FooLambdaFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Code: {
            S3Bucket: {
              Ref: 'ServerlessDeploymentBucket',
            },
            S3Key: expect.any(String),
          },
          Handler: 'index.handler',
          Runtime: 'nodejs20.x',
          FunctionName: 'simple-service-dev-foo',
          MemorySize: 1024,
          Timeout: 6,
          Environment: {
            Variables: {
              FOO: 'BAR',
              SERVICE_VERSION: expect.any(String),
            },
          },
          Role: {
            'Fn::GetAtt': ['IamRoleLambdaExecution', 'Arn'],
          },
        },
        DependsOn: ['FooLogGroup'],
      },
      BarLambdaFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Code: {
            S3Bucket: {
              Ref: 'ServerlessDeploymentBucket',
            },
            S3Key: expect.any(String),
          },
          Handler: 'index.handler',
          Runtime: 'nodejs20.x',
          FunctionName: 'simple-service-dev-bar',
          MemorySize: 1024,
          Timeout: 6,
          Environment: {
            Variables: {
              SERVICE_VERSION: expect.any(String),
            },
          },
          Role: {
            'Fn::GetAtt': ['IamRoleLambdaExecution', 'Arn'],
          },
        },
        DependsOn: ['BarLogGroup'],
      },
      FooLambdaVersionVLvfH5HDcvBg3OywOApuo58TY7rErhDMhb4X3CMdbGo: {
        Type: 'AWS::Lambda::Version',
        DeletionPolicy: 'Retain',
        Properties: {
          FunctionName: {
            Ref: 'FooLambdaFunction',
          },
          CodeSha256: 'Rke/vVu8DPxDMO3QCdY/dYgrn7bV8RJu8NYtjZSDzr8=',
        },
      },
      BarLambdaVersionon8IzZDPHhUjbCRI73HBFbNcI5OBNXHvG0R67lnAdZc: {
        Type: 'AWS::Lambda::Version',
        DeletionPolicy: 'Retain',
        Properties: {
          FunctionName: {
            Ref: 'BarLambdaFunction',
          },
          CodeSha256: 'Rke/vVu8DPxDMO3QCdY/dYgrn7bV8RJu8NYtjZSDzr8=',
        },
      },
      CustomResourceHandlerLambdaFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          FunctionName: 'cfn-shortsha-simple-service-dev-resource',
          Description:
            'A custom resource to manage function aliases for Serverless Framework projects',
          Runtime: 'nodejs20.x',
          Architectures: ['arm64'],
          MemorySize: 128,
          Handler: 'index.handler',
          Role: {
            'Fn::GetAtt': ['CustomResourceHandlerLambdaRole', 'Arn'],
          },
          Code: {
            ZipFile: expect.any(String),
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
      FooLambdaFunctionShortShaAlias: {
        Type: 'Custom::LambdaAlias',
        Properties: {
          ServiceToken: {
            'Fn::GetAtt': ['CustomResourceHandlerLambdaFunction', 'Arn'],
          },
          FunctionName: {
            Ref: 'FooLambdaFunction',
          },
          FunctionVersion: {
            'Fn::GetAtt': [
              'FooLambdaVersionVLvfH5HDcvBg3OywOApuo58TY7rErhDMhb4X3CMdbGo',
              'Version',
            ],
          },
          AliasName: expect.stringMatching(/version-[a-z0-9]{7}/),
        },
      },
      BarLambdaFunctionShortShaAlias: {
        Type: 'Custom::LambdaAlias',
        Properties: {
          ServiceToken: {
            'Fn::GetAtt': ['CustomResourceHandlerLambdaFunction', 'Arn'],
          },
          FunctionName: {
            Ref: 'BarLambdaFunction',
          },
          FunctionVersion: {
            'Fn::GetAtt': [
              'BarLambdaVersionon8IzZDPHhUjbCRI73HBFbNcI5OBNXHvG0R67lnAdZc',
              'Version',
            ],
          },
          AliasName: expect.stringMatching(/version-[a-z0-9]{7}/),
        },
      },
    });
  });
});
