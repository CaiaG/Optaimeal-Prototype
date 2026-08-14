Optaimeal Prototype 1

# OPTAIMEAL Prototype 1

## System Prerequisites
- Python 3.10+
- Node.js 18+
- Groq/any LLM API Key (for AI meal generation and adjustments)
NOTE: currently set up for Groq usage in main.py

## Environment Configuration

Create a .env file inside the backend/ directory to configure your environment variables:
GROQ_API_KEY=your_groq_api_key_here

## Backend Setup (Python / FastAPI)

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Launch the server (auto-restarts on code changes)
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`. On first launch it creates `optaimeal.db` (SQLite) in the `backend/` folder — no separate DB setup needed. Interactive API docs are available at `http://localhost:8000/docs`.

## Frontend Setup (React)

```bash
# From the project root
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and expects the backend to already be running at `http://localhost:8000`.

## Notes
- Start the backend before the frontend, since the frontend fetches data on load.
- The SQLite file is gitignored; delete `backend/optaimeal.db` to reset all data.