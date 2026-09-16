# SERP Hawk CRM V2

AI-Powered CRM for SEO Agencies | Next.js + FastAPI + PostgreSQL + OpenAI

## Overview

SERP Hawk CRM V2 is a comprehensive customer relationship management system designed specifically for SEO agencies and digital marketing firms. It manages the entire client lifecycle from cold outreach to project delivery, billing, and SEO monitoring.

### Key Features

- **Role-Based Access**: Admin, Employee, Intern, Client roles with appropriate permissions
- **AI Email Agent**: Automated company research and personalized email generation
- **Real-Time Messaging**: WebSocket-based chat system
- **Service Management**: Catalog, quotes, invoicing, and billing
- **SEO Tools**: Keyword rankings, competitor analysis, SEO audits
- **Document Management**: File uploads, OCR for business cards
- **Reporting**: PDF exports, monitoring dashboards

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion
- **Backend**: FastAPI (Python 3.13), SQLModel ORM, Uvicorn with WebSocket
- **Database**: PostgreSQL (Neon Serverless)
- **AI**: OpenAI GPT-4o-mini, Google Gemini (OCR)
- **Integrations**: Outlook SMTP/IMAP, Webhooks, ReportLab PDFs

## Deployment Guide

### Prerequisites

- Node.js 18+
- Python 3.13+
- PostgreSQL database (Neon recommended)
- GitHub account
- OpenAI API key
- Google Gemini API key (for OCR)

### Backend Deployment

#### Option 1: Railway (Recommended)

1. Create a Railway account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `SECRET_KEY`: A random secret key for JWT
   - `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`: Email settings
4. Railway will automatically detect the `railway.json` and deploy

#### Option 2: Heroku

1. Create a Heroku account
2. Install Heroku CLI
3. Create a new app: `heroku create your-app-name`
4. Add PostgreSQL addon: `heroku addons:create heroku-postgresql:hobby-dev`
5. Set environment variables: `heroku config:set KEY=VALUE`
6. Deploy: `git push heroku main`

#### Option 3: Manual Server

1. Set up a server with Python 3.13+
2. Install dependencies: `pip install -r requirements.txt`
3. Set environment variables
4. Run with: `uvicorn main:app --host 0.0.0.0 --port 8000`

### Frontend Deployment

#### Option 1: Vercel (Recommended for Next.js)

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Connect your GitHub repository
3. Set the root directory to `frontend`
4. Add environment variables:
   - `wat `: Your backend API URL
5. Deploy automatically

#### Option 2: Netlify

1. Create a Netlify account
2. Connect GitHub repo
3. Set build command: `npm run build`
4. Set publish directory: `frontend/out` (for static export) or `frontend/.next` (for SSR)
5. Add environment variables

### Database Setup

1. Create a Neon PostgreSQL database at [neon.tech](https://neon.tech)
2. Run the database migrations: `python create_tables.py`
3. Seed initial data: `python seed_db.py`

### Environment Variables

Create a `.env` file in the root directory:

```
DATABASE_URL=postgresql://user:password@host:port/database
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
SECRET_KEY=your_secret_key
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000  # local development

# In Vercel set Environment Variable (Production):
# NEXT_PUBLIC_API_BASE_URL=https://web-production-30b6.up.railway.app
```

## Local Development

### Backend

1. Create virtual environment: `python -m venv .venv`
2. Activate: `source .venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Run migrations: `python create_tables.py`
5. Start server: `uvicorn main:app --reload`

### Frontend

1. Navigate to frontend: `cd frontend`
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

## How to Add New Features

### Backend (FastAPI)

1. **Add Database Models**: 
   - Edit `database.py` to add new SQLModel classes
   - Run `python create_tables.py` to create tables

2. **Create API Endpoints**:
   - Add routes in `main.py` or create new modules
   - Follow RESTful conventions
   - Add proper authentication/authorization

3. **Add Business Logic**:
   - Create functions in appropriate modules under `modules/`
   - Use dependency injection for database sessions

4. **Update Dependencies**:
   - Add to `requirements.txt`
   - Test with `pip install -r requirements.txt`

### Frontend (Next.js)

1. **Create New Pages**:
   - Add to `frontend/src/app/` following the routing structure
   - Use TypeScript for type safety

2. **Add Components**:
   - Create reusable components in `frontend/src/components/`
   - Follow existing patterns for consistency

3. **API Integration**:
   - Use the existing API utilities in `frontend/src/lib/`
   - Add new API calls as needed

4. **Styling**:
   - Use Tailwind CSS classes
   - Follow the design system

### General Steps

1. Plan the feature and database changes
2. Implement backend API endpoints
3. Update frontend to consume the new APIs
4. Add proper error handling and validation
5. Test thoroughly
6. Update documentation

### Example: Adding a New Entity

1. Define the model in `database.py`
2. Create CRUD endpoints in `main.py`
3. Create frontend pages for list/view/edit
4. Add navigation links
5. Test the full flow

## API Documentation

The API documentation is available at `/docs` when the backend is running (Swagger UI) and `/redoc` for ReDoc.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary. All rights reserved.