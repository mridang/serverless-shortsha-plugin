/**
 * @file CloudFormation custom resource handler that keeps Lambda aliases in step with the commit SHA.
 *
 * The handler creates the `version-<sha>` alias on Create and Update, and removes every alias of the function
 * on Delete, reporting the outcome back to CloudFormation through the cfn-response helper.
 */
import {
  LambdaClient,
  CreateAliasCommand,
  DeleteAliasCommand,
  ListAliasesCommand,
} from '@aws-sdk/client-lambda';
import response from 'cfn-response';
import lambda from 'aws-lambda';

/**
 * Handles a CloudFormation custom resource request for a function alias.
 *
 * Create and Update add the alias unless it already exists, Delete removes all aliases of the function, and any
 * other request type leaves the aliases untouched. Failures are logged and reported to CloudFormation as FAILED.
 * @param event - The CloudFormation custom resource event with the function name, alias name and version.
 * @param context - The Lambda invocation context passed through to cfn-response.
 * @example
 * await handler(event, context);
 */
export const handler = async (
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
    } else {
      // Other request types leave the existing aliases untouched.
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
