# Image Review Agent

AI-powered product image validation, enhancement, and review pipeline. Brands upload images, AI processes them through 5 stages, and brands approve the results.

## Pipeline

```
Upload → Validate → Moderate → Quality Check → Enhance/Generate → Brand Review
         (sharp)    (Rekognition) (GPT-4o)    (PhotoRoom/DALL-E)   (UI)
```

## Architecture

| Component | Technology | Deployment |
|-----------|-----------|------------|
| Web + API | Next.js 14 (TypeScript) | Vercel |
| Worker | BullMQ + Node.js | Railway |
| Database | PostgreSQL | Railway |
| Queue | Redis | Railway |
| Storage | AWS S3 (3 buckets) | AWS |
| Moderation | AWS Rekognition | AWS |
| Quality | OpenAI GPT-4o Vision | OpenAI |
| Enhancement | PhotoRoom API | PhotoRoom |
| Generation | OpenAI DALL-E 3 | OpenAI |

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for Postgres + Redis)
- AWS account with S3 + Rekognition access
- OpenAI API key
- PhotoRoom API key

### 1. Clone and install

```bash
git clone <your-repo-url>
cd image-review-agent
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your actual API keys
```

### 3. Start databases

```bash
docker compose up postgres redis -d
```

### 4. Set up database schema

```bash
npx prisma db push
```

### 5. Create S3 buckets

Create these 3 buckets in AWS (keep them private):
- `brand-images-staging`
- `brand-images-processed`
- `brand-images-approved`

Configure CORS on all buckets to allow PUT from your domain.

### 6. Run the app

Terminal 1 — Web server:
```bash
npm run dev
```

Terminal 2 — Worker:
```bash
npm run worker:dev
```

Open http://localhost:3000

## Deployment

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Deploy Web to Vercel

1. Go to [vercel.com](https://vercel.com), import your repo
2. Set environment variables (all from `.env.example`)
3. Deploy — Vercel handles the Next.js build automatically

### Step 3: Deploy Worker + DB to Railway

1. Go to [railway.app](https://railway.app), create a new project
2. Add a **PostgreSQL** service (one-click)
3. Add a **Redis** service (one-click)
4. Add a **New Service** from your GitHub repo:
   - Set the Dockerfile path to `Dockerfile.worker`
   - Add all environment variables
   - Set `DATABASE_URL` to the Railway Postgres connection string
   - Set `REDIS_URL` to the Railway Redis connection string
5. Deploy

### Step 4: Run migrations

```bash
# In Railway console or via CLI:
npx prisma migrate deploy
```

### Step 5: Update Vercel env vars

Point `DATABASE_URL` and `REDIS_URL` to your Railway services.

## API Usage

### Upload a single image

```bash
curl -X POST https://your-app.vercel.app/api/images/upload \
  -H "Content-Type: application/json" \
  -d '{
    "listing_id": "uuid-here",
    "brand_id": "uuid-here",
    "filename": "product-front.jpg",
    "size_bytes": 1048576,
    "mime_type": "image/jpeg"
  }'
```

Response:
```json
{
  "job_id": "abc-123",
  "upload_url": "https://s3.amazonaws.com/...(pre-signed URL)",
  "s3_key": "uploads/abc-123/product-front.jpg"
}
```

Then upload the file to the pre-signed URL:
```bash
curl -X PUT "<upload_url>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @product-front.jpg
```

### Check job status

```bash
curl https://your-app.vercel.app/api/images/job/abc-123
```

### Brand review UI

Direct brands to: `https://your-app.vercel.app/review/<job_id>`

### Approve/reject

```bash
curl -X POST https://your-app.vercel.app/api/images/job/abc-123/decide \
  -H "Content-Type: application/json" \
  -d '{
    "processed_image_id": "img-456",
    "decision": "approved"
  }'
```

## Cost Estimates (per image)

| Path | Cost |
|------|------|
| Validation + Moderation | ~$0.001 |
| Quality check (GPT-4o) | ~$0.003 |
| Enhancement (PhotoRoom) | ~$0.003 |
| Full generation (3 shots) | ~$0.125 |
| **Total (enhancement path)** | **~$0.007** |
| **Total (generation path)** | **~$0.129** |

## Project Structure

```
image-review-agent/
├── prisma/schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/images/           # All REST API routes
│   │   ├── review/[jobId]/       # Brand review UI
│   │   ├── page.tsx              # Dashboard
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── db.ts                 # Prisma client
│   │   ├── s3.ts                 # S3 operations
│   │   ├── queue.ts              # BullMQ setup
│   │   ├── retry.ts              # Retry utility
│   │   └── stages/
│   │       ├── pipeline.ts       # Main orchestrator
│   │       ├── validate.ts       # Stage 1
│   │       ├── moderate.ts       # Stage 2
│   │       ├── quality.ts        # Stage 3
│   │       ├── enhance.ts        # Stage 4a
│   │       └── generate.ts       # Stage 4b
│   └── workers/
│       └── pipeline-worker.ts    # BullMQ worker process
├── Dockerfile                    # Web server
├── Dockerfile.worker             # Worker process
├── docker-compose.yml            # Local dev
└── .env.example
```
