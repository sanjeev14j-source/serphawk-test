# SERP Hawk CRM — AWS Deployment

This document describes how the SERP Hawk CRM (Next.js + FastAPI + PostgreSQL) was deployed to AWS for the DevOps Engineer take-home assignment.

## Live deployment

- **App URL:** http://13.204.251.193:3000
- **API docs:** http://13.204.251.193:8000/docs
- **GitHub repo:** https://github.com/sanjeev14j-source/serphawk-test
- **Architecture diagram:** [architecture.svg](./architecture.svg)

Demo login: `admin@example.com` / `password123`

## Tech stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python 3.13), SQLModel ORM, Uvicorn
- **Database:** PostgreSQL

## AWS architecture

| Component | Service | Why |
|---|---|---|
| App hosting | EC2 (t3.micro, Ubuntu) | Free Tier eligible (750 hrs/month for 12 months). Runs both frontend and backend containers via Docker Compose — simple to manage and reason about for a project of this size, without the added complexity of ECS/ALB/VPC networking. |
| Database | RDS PostgreSQL (db.t3.micro) | Free Tier eligible (750 hrs/month, 20GB storage for 12 months). Separating the database from the app server follows standard practice — stateful data survives independently of the app server's lifecycle, and it demonstrates understanding of decoupling compute from storage. |
| Networking | Default VPC, custom Security Groups | EC2's security group allows inbound on 22 (SSH, restricted to my IP), 3000 (frontend), and 8000 (backend). RDS's security group only allows inbound on 5432 from EC2's security group specifically — not open to the public internet. |
| Storage | EBS (20GB, gp3) | Attached to the EC2 instance; resized from the default 8GB to comfortably fit Docker images and build artifacts. Still within Free Tier's 30GB allowance. |

See [architecture.svg](./architecture.svg) for a visual diagram.

### Why this approach over ECS/Fargate/ALB

A more "production-grade" setup would use ECS Fargate behind an Application Load Balancer. That was considered, but:
- ALB and Fargate are **not** Free Tier eligible (small hourly costs)
- The added complexity (task definitions, service discovery, target groups) wasn't justified for a single-instance deployment on a deadline
- EC2 + Docker Compose + RDS gives the same core lesson (separating compute from data, using security groups to scope access) with a much faster, more debuggable path to a working deployment

## Local development setup

### Prerequisites
- Docker
- Node.js 18+ (or use Docker for everything)
- Python 3.13+

### Steps
1. Clone the repo: `git clone https://github.com/sanjeev14j-source/serphawk-test.git`
2. Copy `.env.example` to `.env` and fill in real values (a local PostgreSQL connection string, a secret key)
3. Backend: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python create_tables.py && uvicorn main:app --reload`
4. Frontend: `cd frontend && npm install && npm run dev`

## AWS deployment steps

1. **Create an RDS PostgreSQL instance** (Free Tier template, db.t3.micro, default VPC, not publicly accessible)
2. **Create the application database** inside the RDS instance (the instance identifier is not the same as a database name — connect via `psql`/a temporary `postgres:16` container and run `CREATE DATABASE serphawk;`)
3. **Launch an EC2 instance** (Ubuntu 24.04, t3.micro, same VPC as RDS, new key pair, security group allowing 22/3000/8000)
4. **Configure security groups**: RDS's security group allows inbound PostgreSQL (5432) only from EC2's security group ID; EC2's security group allows inbound 3000 and 8000 from anywhere
5. **Install Docker and Docker Compose** on the EC2 instance
6. **Clone the repo** onto the EC2 instance
7. **Add a 2GB swap file** — the default 1GB RAM on t3.micro is not enough to complete a Next.js production build without it
8. **Resize the EBS root volume** from 8GB to 20GB (via AWS Console → Modify Volume, then `growpart` + `resize2fs` on the instance) — the default 8GB is too small once Docker build layers accumulate
9. **Write a `Dockerfile`** for the backend (Python 3.13-slim, installs `requirements.txt`, runs `uvicorn`) and one for the frontend (Node 20-alpine, `npm install`, `npm run build`, `npm start`)
10. **Write `docker-compose.yml`** tying both services together, each reading from a shared `.env` file. **Important:** `NEXT_PUBLIC_*` variables in Next.js are baked in at *build time*, not read at runtime — the frontend `Dockerfile` must declare `ARG NEXT_PUBLIC_API_BASE_URL` and `docker-compose.yml` must pass it via `build.args`, or the frontend will silently use whatever default was hardcoded in the source.
11. **Create `.env`** on the EC2 instance with the real RDS connection string, a secret key, and the frontend's public API URL (pointing at the EC2 instance's public IP) — never committed to git
12. **Run `docker compose up -d --build`** to build and launch both containers
13. **Run database migrations and seed the admin user**: `docker compose run --rm backend python create_tables.py` then `python seed_db.py`
14. **Verify**: visit the frontend URL, log in, confirm the dashboard loads and the backend `/docs` endpoint responds

## Known limitations

- `OPENAI_API_KEY` and `GEMINI_API_KEY` are left blank — the AI-powered features (email agent, competitor analysis, OCR) will not function without real API keys, but this does not affect core CRM functionality (clients, projects, tasks, invoices, etc.)
- SMTP credentials are left blank — outbound email sending is not configured
- This is a single-instance deployment with no auto-scaling, load balancing, or managed container orchestration — appropriate for a take-home assignment and Free Tier constraints, not a recommendation for a real production workload at scale

## Security notes

- `.env` (containing real credentials) is excluded from version control via `.gitignore`; `.env.example` documents the required variables with placeholder values
- RDS is not publicly accessible — only reachable from within the VPC via the EC2 security group
- SSH access to EC2 is restricted to the developer's IP address
