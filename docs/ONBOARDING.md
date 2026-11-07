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

## Local MongoDB

The app stores buyer profiles, suppliers, products, matches, and email drafts in MongoDB. Locally we run MongoDB 7 in Docker as a **single-node replica set** (same idea as DocumentDB later, and it lets us use transactions when we need them).

Docker Desktop must be **installed and running** before any of these commands. The compose file is at the repo root (`docker-compose.yml`). Connection settings live in `.env.example` (`MONGODB_URI`, `MONGODB_DB_NAME`).

### Start / stop (pick your OS)

**Windows** (PowerShell, from the repository root):

```powershell
.\scripts\windows\up.ps1
.\scripts\windows\down.ps1
```

If PowerShell blocks the script, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**macOS** (Terminal, from the repository root):

```bash
chmod +x scripts/macos/*.sh
./scripts/macos/up.sh
./scripts/macos/down.sh
```

**Either OS with Make** (optional):

```bash
make up      # start Mongo and wait until healthy
make down    # stop the container (data volume is kept)
make seed    # load 15 fictional agri-supply companies + products
make reset-db  # drop the database, then seed again
```

`make up` and the OS scripts all run `docker compose up -d --wait` and block until the container is healthy. Longer Docker setup notes: [scripts/README.md](../scripts/README.md).

### Seed data

After Mongo is up (any method above):

```bash
make seed
# or, from web/:
npm run seed
```

### Open a Mongo shell

With the container running:

```bash
docker compose exec mongo mongosh
```

Useful checks inside the shell:

```javascript
use agri_supply
db.companies.countDocuments()
db.products.countDocuments()
```

## Clone and run the web app

1. Clone this repository with Git and open a terminal in the repo root.
2. Copy the example env file:

   ```bash
   cp .env.example web/.env.local
   ```

   Never commit real `.env` / `.env.local` files. For seeding from the Makefile, the seed script also reads values from `.env.example` via `--env-file` — set `SEED_CONTACT_EMAIL_BASE` there (or in your local env) so demo supplier emails use plus-addressing into a team inbox.
3. Start Mongo and seed data (from the repo root). Use the script for your OS if you do not have Make:

   ```powershell
   # Windows
   .\scripts\windows\up.ps1
   ```

   ```bash
   # macOS
   ./scripts/macos/up.sh
   # or: make up
   ```

   Then seed:

   ```bash
   make seed
   # or: npm --prefix web run seed
   ```
4. Install dependencies and start the Next.js dev server:

   ```bash
   cd web
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

Useful commands from `web/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local app with hot reload |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler with no emit |
| `npm test` | Run Vitest unit tests |
| `npm run seed` | Insert fictional supplier catalog data |
| `npm run reset-db` | Drop the app database, then seed |
| `npm run format` | Format files with Prettier (includes Tailwind class sorting) |

From the **repo root**:

```bash
make up        # local MongoDB
make seed      # catalog data
make down      # stop MongoDB
make reset-db  # drop + seed
make lint      # web lint + typecheck
make test      # web tests
```

`make deploy` is still a placeholder until deploy docs land.

## Glossary

| Term | One-sentence meaning |
| --- | --- |
| **Next.js** | A React framework for building web apps with pages, APIs, and server rendering in one project. |
| **Docker** | A tool that packages an app and its dependencies into a portable container so it runs the same everywhere. |
| **MongoDB** | The document database we use locally; Amazon DocumentDB is the AWS-compatible counterpart. |
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
