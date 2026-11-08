# Agri-Supply

Flow (from the whiteboard):
1. Register / log in (farm name + location saved).
2. Prompt: "we need X service" -> Claude maps it to a service -> companies from MongoDB, ranked by rating.
3. Pick companies -> Claude drafts emails -> you edit & approve -> send (SMTP, or simulated if not configured).
4. Workflow 2: log company replies, then chat / generate a report from the email history.

## Run
    cp .env.example .env     # set MongoDB Atlas and AWS Bedrock settings
    docker compose up --build
Open http://localhost (or your EC2 public IP; open port 80 in the security group).

The app remains usable without an AI key: service matching and email drafting use
safe rule-based fallbacks. Configure Bedrock or Anthropic to enable AI-generated
matching, drafts, and reports.

Check the deployment with:

    curl http://localhost/api/health

## Run without Docker
    pip install -r requirements.txt
    MONGO_URL="mongodb+srv://..." AWS_REGION=us-east-1 USE_BEDROCK=1 \
      CLAUDE_MODEL=anthropic.claude-3-5-haiku-20241022-v1:0 \
      uvicorn app.main:app --reload

## AWS EC2 deployment
1. Create a MongoDB Atlas database and allow the EC2 instance's outbound access.
2. Enable the selected Claude model in Amazon Bedrock in `us-east-1`.
3. Launch an Ubuntu EC2 instance with an IAM role allowing Bedrock model invocation.
4. Open inbound TCP port 80 in the instance security group.
5. Install Docker on the instance, clone this repository, and create `.env` from `.env.example`.
6. Set the Atlas connection string in `.env`, then run `docker compose up --build -d`.
7. Open the instance's public IPv4 address in a browser.

## Files
- app/main.py          API + Claude calls + seed companies
- app/static/index.html  whole front-end
- docker-compose.yml   API + MongoDB

## Troubleshooting
- `Authentication failed`: reset the MongoDB Atlas database-user password and
  copy the complete URI from Atlas **Connect → Drivers** into `.env`.
- `Connection refused`: run `docker compose ps -a` and
  `docker compose logs --tail=100 api`.
- Do not commit `.env`; it contains credentials and is ignored by Git.

## Not in MVP (next steps)
Email activation code, reading real replies from inbox, company import UI (POST /api/companies exists), password reset.
