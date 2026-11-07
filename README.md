# Agri-Supply MVP
im the biggest bird

Flow (from the whiteboard):
1. Register / log in (farm name + location saved).
2. Prompt: "we need X service" -> Claude maps it to a service -> companies from MongoDB, ranked by rating.
3. Pick companies -> Claude drafts emails -> you edit & approve -> send (SMTP, or simulated if not configured).
4. Workflow 2: log company replies, then chat / generate a report from the email history.

## Run
    cp .env.example .env     # add your key (or Bedrock creds)
    docker compose up --build
Open http://localhost (or your EC2 public IP; open port 80 in the security group).

## Run without Docker
    pip install -r requirements.txt
    MONGO_URL=mongodb://localhost:27017 ANTHROPIC_API_KEY=... uvicorn app.main:app --reload

## Files
- app/main.py          API + Claude calls + seed companies
- app/static/index.html  whole front-end
- docker-compose.yml   API + MongoDB

## Not in MVP (next steps)
Email activation code, reading real replies from inbox, company import UI (POST /api/companies exists), password reset.
