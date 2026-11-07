# Architecture decisions

Short records of choices that shaped Agri-Supply Agent. Written for a team new to AWS.

## AWS CDK instead of Terraform

- **Context:** The project needs infrastructure as code, but Terraform (and Terraform-compatible tools) are banned for this hackathon.
- **Decision:** Define all AWS resources with AWS CDK v2 in TypeScript under `infra/` as its own npm package. CDK synthesizes CloudFormation.
- **Consequence:** The team learns TypeScript end-to-end and never adds `.tf` / `.tfvars` files or runs the Terraform CLI. Deployments are human-run (`cdk deploy`); agents may only `cdk synth` (and `cdk diff` when asked).

## MongoDB / DocumentDB over Postgres

- **Context:** We need a database for buyer profiles, supplier catalogs, matches, email drafts, and agent runs. The team is new to databases and wants one mental model from laptop to AWS.
- **Decision:** Use MongoDB locally (`mongo:7` in Docker) and Amazon DocumentDB in AWS, accessed with the official `mongodb` Node driver and Zod schemas for every document shape.
- **Consequence:** We skip SQL migrations for the hackathon. Document shapes are flexible, but we must keep Zod schemas and indexes disciplined so data does not drift.

## EC2 + CloudFront over App Runner

- **Context:** We need a simple way to host one Dockerized Next.js app with HTTPS. App Runner is convenient but hides networking details the hackathon wants the team to see.
- **Decision:** Run the container on a single Amazon EC2 instance and put Amazon CloudFront in front for HTTPS.
- **Consequence:** We own more ops (VPC, instance, deploys via Systems Manager), but the architecture stays concrete and easier to explain on a whiteboard.

## No SageMaker

- **Context:** The product needs ranking and email drafting, which sounds like “AI,” so SageMaker can look like the default AWS choice.
- **Decision:** Do not use SageMaker. Use Claude on Amazon Bedrock (Converse API + tool use) for reasoning.
- **Consequence:** No training pipeline or custom model hosting. We depend on Bedrock quotas/models and keep a `AI_MODE=mock` path so local work and tests never need AWS.

## Cognito moved to Stage 8

- **Context:** Auth is important, but early stages need working product flow (profiles, matching, drafts) before cloud sign-in.
- **Decision:** Ship with a local/dev auth mode first; introduce AWS Cognito in Stage 8 after AI and email paths exist.
- **Consequence:** Core flows can be built and demoed sooner. We must keep auth behind `AUTH_MODE` so switching to Cognito later does not rewrite the whole app.
