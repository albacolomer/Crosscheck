# Crosscheck

A live fact-checking copilot for journalists. While an interview is happening, Crosscheck transcribes the conversation, spots factual claims, checks them against the web and suggests follow-up questions.
 
Built by a team of five in **4 hours** at the **OpenAI DevDay Exchange Barcelona hackathon** (November 2026).

▶️ **[Watch the demo](https://www.youtube.com/watch?v=Zb3NJbo-pWo)**

## How it works
 
1. **Prepare.** Add the interviewee, their role, the topics to investigate and your key questions. You can type it or dictate it.
2. **Interview.** The live dashboard shows the transcript with claims highlighted and speakers separated. Each claim gets a card with a verdict (*Supported*, *Contradicted*, *Misleading* or *Unverified*), the evidence and source links, plus suggested follow-up questions.
3. **Review.** When the interview ends, you see counts per verdict, the main contradictions, claims that need more research and open questions.
```text
Microphone ─► OpenAI Realtime ─► transcript ─► claim extraction
                                           └─► async verification queue
                                               ├─► Tavily (supporting + contradicting evidence)
                                               └─► OpenAI (verdict + follow-up questions)
                                                   └─► live dashboard ─► insights
```
 
Transcription keeps running while claims are checked in the background, so the interview is never blocked.
## Tech stack
 
**Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui

**Backend:** Node.js, Express, with TypeScript contracts shared with the frontend

**AI:** OpenAI Realtime API for transcription and speaker labels, OpenAI API for claim analysis, Tavily for web search
Built with Codex.
 
## Run it locally
 
Requires Node.js 22.12 or later.
 
```bash
git clone https://github.com/albacolomer/Crosscheck.git
cd Crosscheck
npm ci
cp .env.example .env   # add OPENAI_API_KEY and TAVILY_API_KEY
npm run dev
```
 
The frontend runs at `http://localhost:5173` and the backend at `http://localhost:3001`. The UI works with mock data without API keys. Allow microphone access to try live transcription.
