# Live Agent Hub

Live Agent Hub is an advanced **Streamer Practice** platform designed to simulate a highly realistic, chaotic, and immersive Twitch chat experience. Powered by real-time AI agents (via OpenAI), this application gives content creators and aspiring streamers a dynamic practice environment to interact with virtual viewers, perfect their commentary, and train their crowd-work skills.

The AI agents use distinct, humanized personas to replace robotic responses with authentic internet grammar, multi-message splitting, chattiness probability filters, and agent-to-agent reactions, enabling a true-to-life audience simulation. 

## Key Features

- 🎥 **Streamer Practice Sessions:** Quickly spin up practice sessions where you are actively broadcasting to an AI audience.
- 🗣️ **Realistic Virtual Chat:** AI agents process streamer dialogue and on-screen events to reply natively and contextually.
- 🤖 **Humanized AI Personas:** Agents use internet slang, make typos, and inter-react with each other to form a chaotic, organic chat stream.
- 💬 **Streamer Reply-to-Chat:** Verbally respond to individual chat messages seamlessly to create a long-form, back-and-forth conversation.
- 👁️ **Visual Event Emulation:** Agents can "watch" your screen and respond dynamically to visual situations even during periods of silence.
- 📊 **Platform Analytics:** Review performance dashboards covering viewer retention, chat engagement, and session highlights.

## Tech Stack

This project is built using a PNPM monorepo structure with modern web engineering standards:

- **Frontend (`@workspace/stream-practice`)**: React, Vite, Tailwind CSS, Radix UI (shadcn/ui components), React Query, Wouter for routing.
- **Backend API (`@workspace/api-server`)**: Express.js, TypeScript, Pino logging.
- **Database Management**: PostgreSQL (via Supabase), manipulated using **Drizzle ORM**.
- **AI Integrations**: OpenAI APIs for generating advanced persona completions.

## Project Structure

The project code is located entirely inside the `artifacts/` monorepo namespace:

- `artifacts/stream-practice/`: The React-based frontend web application.
- `artifacts/api-server/`: The Express backend processing API requests and sockets.
- `artifacts/mockup-sandbox/`: UI playground and development utilities.
- (Additional implicit shared packages like `@workspace/db` for database queries and `@workspace/api-zod` for type-safe models).

## Prerequisites

- [Node.js](https://nodejs.org/) (minimum v18)
- [pnpm](https://pnpm.io/installation) package manager (v9+)
- A [Supabase](https://supabase.com) (or generic PostgreSQL) Database instance
- An [OpenAI](https://openai.com) API Key for the agents engine

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd Live-Agent-Hub-
   ```

2. **Set up Environment Variables:**
   Create a `.env` file at the root of the project with the following structure:
   
   ```env
   # Database connection string
   DATABASE_URL="postgresql://user:password@host:port/postgres"
   
   # OpenAI parameters
   AI_INTEGRATIONS_OPENAI_API_KEY="sk-proj-YOUR_API_KEY"
   AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
   
   # Application Configuration
   SESSION_SECRET="local-dev-secret"
   API_PORT=5000
   PORT=5173
   BASE_PATH=/
   ```

3. **Install Dependencies:**
   Utilize `pnpm` to install all dependencies across the monorepo workspaces:
   ```bash
   pnpm install
   ```

4. **Initialize the Database:**
   Push your Drizzle schema schemas to your PostgreSQL instance:
   ```bash
   pnpm run db:push
   ```

## Running the Application Locally

Start up the local development servers using:

```bash
pnpm run dev
```

This root command launches the backend Express API (`pnpm run dev:api`) and the frontend React application (`pnpm run dev:web`) concurrently.
- The web app will be accessible at: `http://localhost:5173/`
- The backend API will be accessible at `http://localhost:5000/`

### Additional Scripts 

- `pnpm run build`: Typechecks all source code and builds the workspaces for production.
- `pnpm run typecheck`: Validates TypeScripts types across the monorepo packages.
- `pnpm run typecheck:libs`: specifically checks libraries inside `/artifacts`.
- `pnpm run dev:api`: Runs exclusively the backend Express application.
- `pnpm run dev:web`: Runs exclusively the React frontend application.

## Acknowledgements

Live Agent Hub started its journey as a sandbox migration of earlier iterations, primarily aiming to completely decouple away from Replit's environments into a pristine, fully local workstation environment, pushing the boundaries of AI agent realism.
