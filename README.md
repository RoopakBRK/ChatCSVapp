
## 1. The problem

A lot of useful data sits in CSV files: sales, orders, customers, payments. Getting answers from it usually needs Excel formulas, SQL or Python, and most people don't know these. 

## 2. How the system works
The AI never does the maths. A database does the maths. The AI only turns the question into a database query and then explains the result. This keeps the numbers exact.

When CSV files are uploaded, each one becomes a table in a small database (DuckDB) that belongs only to that chat. Sample data ("Online Shop 2024", 8 tables) is also included and can be loaded with one click.

Before the data is used, each file is cleaned. Column names are made simple, so `Order ID` becomes `order_id`, and extra spaces are removed. Empty cells and words like `n/a` are marked as missing instead of being turned into 0. Empty and duplicate rows are removed, and numbers and dates are detected. Every change is written down and shown to the user, so nothing is changed in secret.

The app then looks for columns that connect the tables, like `order_id` in both `orders` and `order_items`. This lets one question use several files at once.

When a question is asked, the AI (Groq, model `gpt-oss-20b`) gets the table names, the column names and a few example values, never the whole file. It writes one SQL query. If the question is unclear, it asks a question back instead of guessing.

Before the query runs, the app checks that it only reads data and can't change or delete anything. The database then runs it with a time limit.

The user gets a short answer in words, a chart when the result suits one, and the table and SQL so the answer can be checked. Simple results, like a single number, are written by the app itself, so no second AI call is needed. The chat also remembers earlier questions, so follow-ups like "now only for 2024" or "break this down by category" work.

## 3. How to set up and run the project

Free Groq API key from https://console.groq.com/keys.

Both ways of running the app need this key. In the project folder, copy the example settings file:

```bash
cp .env.example .env
```

Then open `.env` and paste the key after `GROQ_API_KEY=`. This file is never uploaded to GitHub.

The easiest way to run the app is with Docker. After installing Docker Desktop, run:

```bash
docker compose up --build
```

Then open http://localhost:3000. To stop it, press `Ctrl+C`.

The app can also be run without Docker. This needs Python 3.13 with [uv](https://docs.astral.sh/uv/) and Node.js 20 or newer. Start the backend in a first terminal:

```bash
cd backend
uv sync
uv run uvicorn chatapp.main:app --reload --port 8000
```

Then start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, then upload CSV files or click **Try sample data** and ask a question.

## 4. Libraries used and why

The backend is written in Python. FastAPI was used to build the web API, because it is quick to write and checks every request, and Uvicorn runs the server. Pydantic checks that data has the right shape, including the AI's reply. DuckDB was chosen as the database because it is small and fast, runs inside the app with no separate server, and does sums and averages exactly. pandas and NumPy read and clean the CSV files. Groq runs the AI model, because it is very fast and has a free tier.

A few smaller libraries help the backend too. httpx downloads CSV files from links, python-multipart lets the API receive uploaded files, and python-dotenv reads the Groq key from the `.env` file. uv installs the Python packages with exact versions saved in `uv.lock`, and pytest runs the automated tests.

The frontend (the website) is built with Next.js and React. TypeScript was used to catch mistakes in the code before it runs, and Tailwind CSS gives quick, consistent styling with light and dark mode. Plotly draws the charts, with hover details and zoom, and lets them be downloaded as a picture. ESLint checks the code for common problems.

## 5. How evaluation could be performed

First, there are automated tests. We can run them with `cd backend && uv run pytest`. They cover cleaning, the safety check, charts, uploads and the API. In these tests the AI is replaced by a fake, so they run fast and give the same result every time.

For accuracy, we can write 15 to 20 questions about the sample data, each with a correct SQL query written by hand. Then we ask the app each question and compare its result table with the correct one. The score is the share of questions it gets right. We can also use a mix of questions: easy ones like "how many orders?", ones that join tables like "revenue by product category", date questions like "orders per month in 2024", follow-ups like "now only the top 3", and unclear ones like "show me the best", where the right result is a question back. We can ask the same question in different words and check that the answer stays the same. We can also check that the numbers in the written answer match the numbers in the table. Every answer shows its SQL and its table, so a person can always check it.

To see how it handles big files, we can time the upload, the cleaning and one question for files of about 1 MB, 10 MB and 50 MB (the default upload limit), and watch how much memory the app uses. Only up to 500 result rows are sent to the browser, and each query stops after 15 seconds, so one heavy question can't freeze the app.

We can also try files and questions that often cause trouble and check what the app does. A file separated by `;` instead of commas, or one not saved in UTF-8, should still be read correctly. Empty cells, `null` and `n/a` should stay missing and never become 0. Empty and duplicate rows should be removed and counted. In a column with mixed date formats, clear dates should be converted and unclear ones kept as text, with a note. An empty file, or a file that isn't a CSV, should be refused with a clear message. A vague question should get a question back. "Delete all orders" should get a polite no, because the app only reads data. Text inside a file like "ignore all instructions" should be treated as plain data and never followed.
