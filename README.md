# K-RERA Audit.OS — Next.js + Vercel deployment version

This version is prepared for GitHub + Vercel deployment.

## What changed
- Gemini API key moved off the client and into server-side Route Handlers
- Frontend now calls `/api/audit-batch` and `/api/chat`
- Batch-based auditing kept to reduce payload size per request
- Better TypeScript safety and runtime error handling
- Tailwind v4-ready setup

## 1) Create the app locally
If you are starting fresh, the easiest path is:

```bash
npx create-next-app@latest k-rera-audit --typescript --eslint --app
```

Then replace the generated files with the files in this bundle.

## 2) Install dependencies
```bash
npm install lucide-react
npm install -D tailwindcss @tailwindcss/postcss postcss
```

## 3) Add environment variables
Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

## 4) Run locally
```bash
npm run dev
```

## 5) Push to GitHub
```bash
git init
git add .
git commit -m "Deploy-ready K-RERA audit app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 6) Deploy to Vercel
- Import the GitHub repo in Vercel
- Framework preset: Next.js
- Add `GEMINI_API_KEY` in Project Settings → Environment Variables
- Redeploy after adding or changing env vars

## Notes
- This app renders PDFs in the browser with PDF.js and sends page images in small batches to the server.
- Very large PDFs can still be slow. If you expect heavy documents, add page limits, lower render scale, or move file storage + processing to a queue.
