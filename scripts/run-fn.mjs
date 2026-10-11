// scripts/run-fn.mjs
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const http = args.includes("--http");
const [name, raw = ""] = args.filter((a) => a !== "--http");
const base = process.env.FUNC_URL ?? "http://localhost:7071";

if (!name) {
  console.error("Usage: npm run fn -- <functionName> [input | @file.json] [--http]");
  process.exit(1);
}

// "@file.json" reads the input from a file
const input = raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw;
const headers = { "Content-Type": "application/json" };

const res = http
  ? await fetch(`${base}/api/${name}`, {
      method: input ? "POST" : "GET",
      headers,
      body: input || undefined,
    })
  : await fetch(`${base}/admin/functions/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
    });

console.log(res.status, res.statusText);
const text = await res.text();
if (text) console.log(text);