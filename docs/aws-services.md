# AWS services we use

This table maps each AWS service to why we use it and which hackathon stage introduces it. Stages are planned sequentially so the team can learn one piece at a time.

| Service | Purpose | Stage that sets it up |
| --- | --- | --- |
| Bedrock | Claude agent (Converse API + tool use) | Stage 6 |
| SES | Outbound email to suppliers | Stage 7 |
| Cognito | Sign-in | Stage 8 |
| CloudFormation | Runs our CDK stacks | Stage 9 |
| VPC | Private network for the app and database | Stage 9 |
| DocumentDB | Database (MongoDB-compatible) | Stage 9 |
| EC2 | Runs the app container | Stage 9 |
| ECR | Stores Docker images | Stage 9 |
| CloudFront | HTTPS in front of EC2 | Stage 9 |
| Secrets Manager | Stores the DB password | Stage 9 |
| IAM | Permissions for the app and deploy roles | Stage 9 |
| Systems Manager | Shell access and deploys without SSH keys | Stage 9 |
| CloudWatch | Application and infrastructure logs | Stage 11 |

## Not using

| Service / tool | Why not |
| --- | --- |
| SageMaker | We are not training a custom model; Claude via Bedrock already covers the reasoning we need. |
| Terraform | Banned for this project; AWS CDK in `infra/` replaces it. |
