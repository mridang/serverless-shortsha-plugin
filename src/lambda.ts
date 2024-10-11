import {
  LambdaClient,
  CreateAliasCommand,
  DeleteAliasCommand,
  ListAliasesCommand,
} from '@aws-sdk/client-lambda';
import response from 'cfn-response';
import lambda from 'aws-lambda';

exports.handler = async (
  event: lambda.CloudFormationCustomResourceEvent & {
    ResourceProperties: {
      FunctionName: string;
      AliasName: string;
      FunctionVersion: string;
    };
  },
  context: lambda.Context,
) => {
  console.log(event);
  const lambdaClient = new LambdaClient();
  const functionName = event.ResourceProperties.FunctionName;
  const aliasName = event.ResourceProperties.AliasName;
  const functionVersion = event.ResourceProperties.FunctionVersion;

  try {
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      const listAliasesCommand = new ListAliasesCommand({
        FunctionName: functionName,
      });
      const aliases = await lambdaClient.send(listAliasesCommand);

      if (aliases.Aliases?.some((alias) => alias.Name === aliasName)) {
        console.warn(
          `Alias \${aliasName} already exists for function ${functionName}`,
        );
      } else {
        const createAliasCommand = new CreateAliasCommand({
          FunctionName: functionName,
          Name: aliasName,
          Description: `Alias for commit ${aliasName}`,
          FunctionVersion: functionVersion,
        });
        await lambdaClient.send(createAliasCommand);
      }
    } else if (event.RequestType === 'Delete') {
      const listAliasesCommand = new ListAliasesCommand({
        FunctionName: functionName,
      });
      const aliases = await lambdaClient.send(listAliasesCommand);

      for (const alias of aliases.Aliases || []) {
        const deleteAliasCommand = new DeleteAliasCommand({
          FunctionName: functionName,
          Name: alias.Name,
        });
        await lambdaClient.send(deleteAliasCommand);
      }
    }
    await response.send(
      event,
      context,
      response.SUCCESS,
      undefined,
      `${functionName}/shortsha`,
    );
  } catch (error) {
    console.error(error);
    await response.send(
      event,
      context,
      response.FAILED,
      undefined,
      `${functionName}/shortsha`,
    );
  }
};
