import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ---- Helpers ----
function isBase64(str) {
  if (typeof str !== "string") return false;
  // Base64 must be multiple of 4 and only contain base64 chars + padding
  return /^[A-Za-z0-9+/]+={0,2}$/.test(str) && str.length % 4 === 0;
}

function decodeItem(item) {
  if (Array.isArray(item)) return item.map(decodeItem);
  if (typeof item === "object" && item !== null) {
    for (const k in item) {
      const v = item[k];
      if (typeof v === "string") {
        if (isBase64(v)) {
          try {
            const buf = Buffer.from(v, "base64");
            const decoded = buf.toString("utf-8");
            item[k] = /�/.test(decoded) ? v : decoded; // keep original if invalid UTF-8
          } catch {
            item[k] = v;
          }
        } else {
          item[k] = v; // not base64, keep as is
        }
      } else if (typeof v === "object") {
        item[k] = decodeItem(v);
      }
    }
  }
  return item;
}

// ---- Config ----
const MAIN_URL = Buffer.from("aHR0cHM6Ly9wcml2YXRlYXBpZGF0YS5wYWdlcy5kZXY=", "base64").toString("utf-8");
// This decodes to "https://privateapidata.pages.dev"

const HEADERS = {
  "cf-access-client-id": Buffer.from(
    "ODMzMDQ5YjA4N2FjZjZlNzg3Y2VkZmQ4NWQxY2NkYjguYWNjZXNz",
    "base64"
  ).toString("utf-8"),
  "cf-access-client-secret": Buffer.from(
    "MDJkYjI5NmE5NjFkNzUxM2MzMTAyZDc3ODVkZjQxMTNlZmYwMzZiMmQ1N2QwNjBmZmNjMmJhM2JhODIwYzZhYQ==",
    "base64"
  ).toString("utf-8"),
  "user-agent": "Dart/3.8 (dart:io)"
};

// ---- Endpoints ----
const ENDPOINTS = {
  link: `${MAIN_URL}/links.json`,
  link2: `${MAIN_URL}/links2.json`,
  link3: `${MAIN_URL}/links3.json`,
  link4: `${MAIN_URL}/links4.json`,
  link5: `${MAIN_URL}/links5.json`
};

// ---- Fetch JSON ----
async function fetchJson(url) {
  console.log(`[INFO] Fetching ${url}`);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const data = await res.json();
  return decodeItem(data);
}

// ---- Create /link → /link5 endpoints ----
Object.keys(ENDPOINTS).forEach(key => {
  app.get(`/${key}`, async (req, res) => {
    console.log(`[INFO] Request received for /${key}`);
    try {
      const data = await fetchJson(ENDPOINTS[key]);
      res.json(data);
    } catch (e) {
      console.error(`[ERROR] /${key} failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
});

// ---- Fetch item by ID across all links ----
app.get("/links/:id", async (req, res) => {
  const id = req.params.id;
  console.log(`[INFO] Fetching item for ID: ${id}`);
  try {
    let found = null;
    for (const url of Object.values(ENDPOINTS)) {
      const data = await fetchJson(url);
      const arr =
        data.AllMovieDataList ||
        data.allMovieDataList ||
        data.webSeriesDataList ||
        [];
      const item = arr.find(i => i.id === id || i.ID === id);
      if (item) {
        found = item;
        break;
      }
    }
    if (!found) return res.status(404).json({ error: "Item not found" });
    res.json(found);
  } catch (e) {
    console.error(`[ERROR] /links/:id failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ---- Start server ----
const PORT = 5000;