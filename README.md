# Personal Growth Diary

Self-hosted web app for journaling, goal tracking, and daily todos. Runs on Node.js/Express, stores data in SQLite, and serves a vanilla HTML/CSS/JS frontend. Optional AI tips are available via an OpenAI API key.

## Features

- Journal entries with mood tracking and image attachments
- Goals and milestones
- Todos and dashboard/stats
- Optional desktop notifications and AI tips

## Tech Stack

- Node.js + Express
- SQLite (better-sqlite3)
- Vanilla HTML/CSS/JS

## Getting Started

### Prerequisites

- Node.js 18+

### Install

```bash
npm install
```

### Configure

Create a `.env` file from the example and set a strong session secret:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Required:

- `SESSION_SECRET`: random string used to sign sessions

Optional:

- `PORT`: server port (default: `3000`)
- `OPENAI_API_KEY`: enables AI tips
- `DB_PATH`: SQLite file path (default: `./database/diary.db`)

### Initialize the Database

```bash
npm run init-db
```

### Run

```bash
npm start
```

Open `http://localhost:3000`.

### Development (auto-reload)

```bash
npm run dev
```

## Tests

The QA suite expects the server to be running.

```bash
# Terminal 1
npm start

# Terminal 2
npm test
```

Optional cleanup:

```bash
node tests/cleanup.js
```

📊 TEST SUMMARY
============================================================

✅ Passed: 43
❌ Failed: 0
📝 Total:  43
============================================================


## Project Layout

- `server.js`: Express app entrypoint
- `routes/`: API routes
- `database/`: schema and DB initialization
- `public/`: static frontend
- `uploads/journal/`: stored journal attachments

## License

MIT (as declared in `package.json`).
```

## 🛠️ Development

```bash
# Run with auto-reload
npm run dev

# Initialize/reset database
npm run init-db

# Run QA tests
npm test
```

## 📱 Mobile Support

The app is fully responsive and works great on:
- Desktop browsers


## 🔐 Security Notes

1. **Change the SESSION_SECRET** - Never use the default in production
2. **Use HTTPS** - Enable in production for secure data transmission
3. **Backup regularly** - The database is stored in `database/diary.db`
4. **Local network only** - By default, only accessible on localhost

## 📦 Data Backup & Export

- **Export**: Go to Settings → Data Management → Export JSON
- **Backup database**: Copy `database/diary.db` file
- **Images**: Backup the `uploads/` directory

## 🤝 Contributing

This is an open-source project! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - Feel free to use, modify, and distribute!

## 🙏 Acknowledgments

- Icons from emoji
- Charts powered by Chart.js
- Notifications via node-notifier
- Inspired by the need for a private, self-hosted diary solution

---

**Made with ❤️ for personal growth and productivity**

*Last Updated: January 2026*
