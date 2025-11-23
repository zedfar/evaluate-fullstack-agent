import "dotenv/config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const target = process.env.VITE_API_URL || "http://localhost:3000";
console.log("Proxy target:", target);

// Reverse proxy /api/* -> backend
app.use(
  "/api",
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { "^/api": "" },
  })
);

// Serve Vite build static content
app.use(express.static("dist"));

// SPA fallback (must be last)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(process.env.PORT || 5178, () => {
  console.log(`Running on port ${process.env.PORT || 5178}`);
});
