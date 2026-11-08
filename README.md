# Agri-Supply

Flow (from the whiteboard):
1. Register / log in (farm name + location saved).
2. The farm location is geocoded to coordinates and a state; suppliers are filtered to that same state and ranked by trust.
3. Pick companies -> Claude drafts emails -> you edit & approve -> send (SMTP, or simulated if not configured).
4. Workflow 2: log company replies, then chat / generate a report from the email history.

## Run
    cp .env.example .env     # set MongoDB Atlas and AWS Bedrock settings
    docker compose up --build
Open http://localhost (or your EC2 public IP; open port 80 in the security group).

This starts two containers: `web` (the Next.js site, published on port 80) and
`api` (FastAPI, only reachable inside Docker). The site forwards every `/api`
request to the API, so the browser only ever talks to port 80.

The app remains usable without an AI key: service matching and email drafting use
safe rule-based fallbacks. Configure Bedrock or Anthropic to enable AI-generated
matching, drafts, and reports.

Farm locations are geocoded through OpenStreetMap Nominatim at registration or
profile completion. The app stores the resolved latitude, longitude, state, and
display name in MongoDB. Supplier recommendations only include companies in the
farm's resolved state.

Set `CLAUDE_TIER` to `haiku`, `sonnet`, or `opus` to choose the model family.
Use `CLAUDE_MODEL` when your provider exposes a different model ID. Supplier
locations are real cities and states, while the seeded supplier names and
`.example.com` addresses are clearly demo data for the MVP. Ratings combine
customer rating, review volume, reliability, and verification into a trust
score; they are not claims about real businesses.

Check the deployment with:

    curl http://localhost/api/health

## Live EC2 host

The current deployment is available at:

    http://3.90.56.18

This public IP can change if the EC2 instance is stopped and restarted. Allocate
an Elastic IP in AWS if a stable address is needed.

## Supplier search

SerpAPI is the planned provider for finding suppliers online. Configure its key
only in the uncommitted `.env` file:

    SERPAPI_KEY=your-serpapi-key

Search results must be filtered to the farm's resolved state. Supplier records
should retain their source URL and retrieval date, include only publicly
verifiable contact details, and never invent a business name, location, email
address, rating, or review.

## Run without Docker
From the repository root:

    pip install -r backend/requirements.txt
    MONGO_URL="mongodb+srv://..." AWS_REGION=us-east-1 USE_BEDROCK=1 \
      CLAUDE_MODEL=anthropic.claude-3-5-haiku-20241022-v1:0 \
      uvicorn app.main:app --app-dir backend --reload

Then, in a second terminal, start the front-end (needs Node 22 and pnpm):

    cd frontend
    pnpm install
    pnpm dev

Open http://localhost:3000. The dev server forwards `/api` to
`http://localhost:8000`; set `API_URL` to use a different backend address.

## AWS EC2 deployment
1. Create a MongoDB Atlas database and allow the EC2 instance's outbound access.
2. Enable the selected Claude model in Amazon Bedrock in `us-east-1`.
3. Launch an Ubuntu EC2 instance with an IAM role allowing Bedrock model invocation.
4. Open inbound TCP port 80 in the instance security group.
5. Install Docker on the instance, clone this repository, and create `.env` from `.env.example`.
6. Set the Atlas connection string in `.env`, then run `docker compose up --build -d`.
7. Open the instance's public IPv4 address in a browser.

## Files
The Python API and the Next.js front-end live in separate top-level folders.

    backend/                Python API (FastAPI)
      Dockerfile            API image build
      requirements.txt      Python dependencies
      app/
        main.py             FastAPI app: wires routers and startup (API only)
        config.py           environment settings, logging, Claude model selection
        database.py         MongoDB connection and indexes
        ai.py               Claude client and prompt helpers
        security.py         password/token hashing, login dependency
        schemas.py          request bodies and validation
        geo.py              geocoding and distance
        serpapi.py          SerpAPI search and place parsing
        trust.py            supplier trust scoring
        enrichment.py       reviews, contact emails, review summaries
        suppliers.py        supplier search and caching
        utils.py            shared helpers
        routes/             API endpoints (auth, workflows, emails, health)
    frontend/               Next.js + Tailwind front-end (TypeScript)
      Dockerfile            standalone Next.js server image
      next.config.ts        forwards /api to the backend (API_URL)
      public/               logos and the hero background photo
      src/app/              pages: landing, login, signup, setup-location,
                            dashboard, workflows/[id]
      src/components/       shared UI, app shell, workflow steps
      src/lib/              API client, types, formatting helpers
      old/index.html        previous single-file front-end, kept for reference
    docker-compose.yml      web (Next.js, port 80) + api (FastAPI, internal);
                            MongoDB is external (Atlas)

## Troubleshooting
- `Authentication failed`: reset the MongoDB Atlas database-user password and
  copy the complete URI from Atlas **Connect → Drivers** into `.env`.
- `Connection refused` or "Can't reach the Eagle server": run
  `docker compose ps -a`, then `docker compose logs --tail=100 api` and
  `docker compose logs --tail=100 web`.
- Do not commit `.env`; it contains credentials and is ignored by Git.

## Not in MVP (next steps)
Email activation code, reading real replies from inbox, company import UI (POST /api/companies exists), password reset.
