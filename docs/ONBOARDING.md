# Onboarding

Welcome. This guide is for people who are new to AWS and web development. You do not need to understand every tool on day one — install what you need, follow the steps, and look up glossary terms as you go.

## Tools to install

| Tool | Why you need it | Suggested version |
| --- | --- | --- |
| **Node.js** | Runs the Next.js web app, JavaScript tooling, and (later) CDK from `infra/` | 20 or newer |
| **Docker** | Runs databases and other services locally in containers | Latest stable |
| **Git** | Clones the repo and tracks code changes | Latest stable |
| **AWS CLI** | Talks to your AWS account from the terminal | v2 |
| **GitHub CLI (`gh`)** | Works with pull requests and GitHub from the terminal | Latest stable |

Infrastructure uses **AWS CDK**, which runs through `npx cdk` from the `infra/` package once that package exists (Stage 9) — nothing extra to install globally.

Install each tool from its official site, then confirm it works:

```bash
node -v
docker -v
git --version
aws --version
gh --version
```

## Clone and run the web app

1. Clone this repository with Git and open a terminal in the repo root.
2. Copy the example env file (optional for now — fill Mongo/AI/email values as those stages land):

   ```bash
   cp .env.example web/.env.local
   ```

   Never commit real `.env` / `.env.local` files.
3. Install dependencies and start the Next.js dev server:

   ```bash
   cd web
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

Useful commands from `web/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local app with hot reload |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler with no emit |
| `npm test` | Run Vitest unit tests |
| `npm run format` | Format files with Prettier (includes Tailwind class sorting) |

From the **repo root**, you can also run:

```bash
make lint   # web lint + typecheck
make test   # web tests
```

`make up`, `make down`, and `make deploy` are still placeholders until later stages.

## Glossary

| Term | One-sentence meaning |
| --- | --- |
| **Next.js** | A React framework for building web apps with pages, APIs, and server rendering in one project. |
| **Docker** | A tool that packages an app and its dependencies into a portable container so it runs the same everywhere. |
| **AWS CDK** | A TypeScript toolkit that defines AWS resources as code in `infra/` and turns them into CloudFormation templates. |
| **CloudFormation** | The AWS service that creates and updates stacks from the templates our CDK app synthesizes. |
| **Cognito** | An AWS service that handles user sign-up, sign-in, and authentication tokens. |
| **Bedrock** | An AWS service that lets the app call foundation models (we use Claude) without hosting our own ML servers. |
| **SES** | Amazon Simple Email Service — sends outbound emails to supplier inboxes once a user approves a draft. |
| **DocumentDB** | An AWS managed database that speaks the MongoDB API; our cloud counterpart to local MongoDB. |
| **EC2** | An AWS virtual server; we run our Next.js Docker container on one instance. |
| **CloudFront** | An AWS content delivery / HTTPS edge service that sits in front of EC2 for secure public access. |
| **VPC** | A private virtual network in AWS that holds our EC2 instance, DocumentDB, and related resources. |
| **Systems Manager** | An AWS service we use for shell access and deploys to EC2 without managing SSH keys. |
| **S3** | An AWS object storage service reserved here as a stretch goal for file uploads. |
| **ECR** | Amazon Elastic Container Registry — a place to store Docker images that EC2 can pull and run. |
