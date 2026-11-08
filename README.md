<p align="center">
    <picture>
        <img src="docs/images/white/eagle_banner.png" width="400px" alt="Eagle Banner">
    </picture>
</p>

<div align="center">

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)
![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-orange.svg)

<p>Eagle is an AI-driven platform that matches farms with relevant service providers, automates tailored email outreach with human approval, and turns supplier responses into actionable reports and insights.</p>

</div>

## Features
Eagle offers a variety of features:
- Farm accounts that save your farm name and location.
- Plain-language service requests (e.g. *"we need irrigation repair"*) mapped to a service category by **Claude on AWS Bedrock.**
- Service providers pulled from MongoDB and ranked by rating.
- AI-drafted outreach emails that you can edit and approve before anything is sent.
- Email sending over SMTP, or simulated sending when SMTP isn't configured.
- Reply tracking, plus a chat and report generator built on your email history.
- \+ more!

## How It Works
1. **Register / log in.** Your farm name and location are saved to your account.
2. **Describe what you need.** Claude maps your request to a service, and matching companies are listed by rating.
3. **Reach out.** Pick companies, let Claude draft the emails, then edit, approve, and send.
4. **Follow up.** Log company replies, then chat with or generate a report from the full email history.

## Build
> [!CAUTION]
> **In order to build and/or run this project, you will need Docker installed!** You will also need a `.env` file at the top level with your MongoDB Atlas and AWS Bedrock settings.

This project runs as a single **Docker container** holding both the API and the front-end. Docker may require WSL (Windows Subsystem for Linux) installed on your machine if you are running a Windows device.

```bash
# Create your environment file, then fill in MONGO_URL and the AWS settings.
cp .env.example .env

# The webapp is now live at "http://localhost"
docker compose up --build
docker compose down
```

### Running Without Docker
```bash
# Install all the project's requirements
pip install -r requirements.txt

# Run the app with all the fields passed directly.
MONGO_URL="mongodb+srv://..." AWS_REGION=us-east-1 USE_BEDROCK=1 \
  CLAUDE_MODEL=anthropic.claude-3-5-haiku-20241022-v1:0 \
  uvicorn app.main:app --reload
```

## Architecture
This project is made of 3 main pieces which each handle their own respective tasks.

---

### **Frontend** (HTML, CSS & JavaScript)
This piece is responsible for the interface that users see when launching the webapp. The whole front-end lives in `app/static/index.html` and is served by the backend.
- Provides account registration and login for farms.
- Walks users through requesting a service, choosing companies, and reviewing email drafts.
- Makes RESTful API calls to the backend to send and retrieve data.

---

### **Backend** (Python w/ FastAPI)
This piece is responsible for making everything work together. It lives in `app/main.py` and mainly provides these key features:
- Connects to MongoDB Atlas for persistence.
  - Stores farm accounts, workflows, companies, emails, and replies.
  - Seeds a starter set of service companies.
- Exposes API endpoints for the frontend to access. (e.g. `/api/workflows`, `/api/emails/{id}/send`, `/api/companies`)
- Sends approved emails over SMTP, or simulates sending when SMTP isn't configured.

---

### **AI** (Claude on AWS Bedrock)
This piece is responsible for all of the AI-related tasks, called from the backend through the Anthropic SDK.
- Maps plain-language requests to a service category.
- Drafts tailored outreach emails for each selected company.
- Answers questions about and generates reports from a workflow's email history.

---

## License
eagle is under the MIT license, a short and permissive license that allows reuse with attribution. See [LICENSE](LICENSE) for details.

## Credits
eagle is made by The Eagle Team for the ACM AWS Hackathon.
