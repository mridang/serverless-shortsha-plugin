Installation

Usage

fix workflows
remove deploy
publish on commti to master

```
sls package                                                                                     ✔  10166  10:56:46 19/04/2024

Packaging aws-node-project for stage dev (us-east-1)
Warning: cloudformation scan results:

Passed checks: 3, Failed checks: 6, Skipped checks: 0

Check: CKV_AWS_55: "Ensure S3 bucket has ignore public ACLs enabled"
        FAILED for resource: AWS::S3::Bucket.ServerlessDeploymentBucket
        File: /tmp/sls/cloudformation-template-create-stack.json:5-18
        Guide: https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies/s3-policies/bc-aws-s3-21

                5  |     "ServerlessDeploymentBucket": {
                6  |       "Type": "AWS::S3::Bucket",
                7  |       "Properties": {
                8  |         "BucketEncryption": {
                9  |           "ServerSideEncryptionConfiguration": [
                10 |             {
                11 |               "ServerSideEncryptionByDefault": {
                12 |                 "SSEAlgorithm": "AES256"
                13 |               }
                14 |             }
                15 |           ]
                16 |         }
                17 |       }
                18 |     },

Check: CKV_AWS_18: "Ensure the S3 bucket has access logging enabled"
        FAILED for resource: AWS::S3::Bucket.ServerlessDeploymentBucket
        File: /tmp/sls/cloudformation-template-create-stack.json:5-18
        Guide: https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies/s3-policies/s3-13-enable-logging

                5  |     "ServerlessDeploymentBucket": {
                6  |       "Type": "AWS::S3::Bucket",
                7  |       "Properties": {
                8  |         "BucketEncryption": {
                9  |           "ServerSideEncryptionConfiguration": [
                10 |             {
                11 |               "ServerSideEncryptionByDefault": {
                12 |                 "SSEAlgorithm": "AES256"
                13 |               }
                14 |             }
                15 |           ]
                16 |         }
                17 |       }
                18 |     },

Check: CKV_AWS_21: "Ensure the S3 bucket has versioning enabled"
        FAILED for resource: AWS::S3::Bucket.ServerlessDeploymentBucket
        File: /tmp/sls/cloudformation-template-create-stack.json:5-18
        Guide: https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies/s3-policies/s3-16-enable-versioning

                5  |     "ServerlessDeploymentBucket": {
                6  |       "Type": "AWS::S3::Bucket",
                7  |       "Properties": {
                8  |         "BucketEncryption": {
                9  |           "ServerSideEncryptionConfiguration": [
                10 |             {
                11 |               "ServerSideEncryptionByDefault": {
                12 |                 "SSEAlgorithm": "AES256"
                13 |               }
                14 |             }
                15 |           ]
                16 |         }
                17 |       }
                18 |     },

Check: CKV_AWS_54: "Ensure S3 bucket has block public policy enabled"
        FAILED for resource: AWS::S3::Bucket.ServerlessDeploymentBucket
        File: /tmp/sls/cloudformation-template-create-stack.json:5-18
        Guide: https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies/s3-policies/bc-aws-s3-20

                5  |     "ServerlessDeploymentBucket": {
                6  |       "Type": "AWS::S3::Bucket",
                7  |       "Properties": {
                8  |         "BucketEncryption": {
                9  |           "ServerSideEncryptionConfiguration": [
                10 |             {
                11 |               "ServerSideEncryptionByDefault": {
                12 |                 "SSEAlgorithm": "AES256"
                13 |               }
                14 |             }
                15 |           ]
                16 |         }
                17 |       }
                18 |     },

Check: CKV_AWS_56: "Ensure S3 bucket has RestrictPublicBuckets enabled"
        FAILED for resource: AWS::S3::Bucket.ServerlessDeploymentBucket
        File: /tmp/sls/cloudformation-template-create-stack.json:5-18
        Guide: https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies/s3-policies/bc-aws-s3-22

                5  |     "ServerlessDeploymentBucket": {
                6  |       "Type": "AWS::S3::Bucket",
                7  |       "Properties": {
                8  |         "BucketEncryption": {
                9  |           "ServerSideEncryptionConfiguration": [
                10 |             {
                11 |               "ServerSideEncryptionByDefault": {
                12 |                 "SSEAlgorithm": "AES256"
                13 |               }
                14 |             }
                15 |           ]
                16 |         }
                17 |       }
                18 |     },

Check: CKV_AWS_53: "Ensure S3 bucket has block public ACLs enabled"
        FAILED for resource: AWS::S3::Bucket.ServerlessDeploymentBucket
        File: /tmp/sls/cloudformation-template-create-stack.json:5-18
        Guide: https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies/s3-policies/bc-aws-s3-19

                5  |     "ServerlessDeploymentBucket": {
                6  |       "Type": "AWS::S3::Bucket",
                7  |       "Properties": {
                8  |         "BucketEncryption": {
                9  |           "ServerSideEncryptionConfiguration": [
                10 |             {
                11 |               "ServerSideEncryptionByDefault": {
                12 |                 "SSEAlgorithm": "AES256"
                13 |               }
                14 |             }
                15 |           ]
                16 |         }
                17 |       }
                18 |     },



✔  analysis completed successfully.

✔ Service packaged (12s)
```
