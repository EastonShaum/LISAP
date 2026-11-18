import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import userRoutes from "./routes/users.js";
import gmailWebhook from "./routes/gmailWebhook.js";
import { keepWatchAlive } from "./services/gmailWatch.js";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// --- API ---
app.use("/api/users", userRoutes);
app.get("/api/status", (req, res) => res.json({ ok: true }));

// --- Gmail Pub/Sub push endpoint ---
app.use("/gmail", gmailWebhook);

// --- React app (after `npm run build --prefix client`) ---
app.use(express.static(path.join(__dirname, "client/build")));
app.get(/^\/(?!api|gmail).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`LISAP server running on port ${PORT}`);
  keepWatchAlive();
});
