import { readFileSync } from "node:fs";

const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (project.settings?.rootDirectory !== "Frontend") {
  throw new Error("Set the Vercel project's Root Directory to Frontend.");
}
const backend = process.env.BACKEND_API_URL?.replace(/\/+$/, "");
if (!backend || backend !== process.env.AZURE_API_URL) {
  throw new Error("Vercel Production BACKEND_API_URL must match the Azure API HTTPS URL.");
}
if (process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) {
  throw new Error("Remove NEXT_PUBLIC_API_BASE_URL to keep authentication on the same-origin proxy.");
}
if (!process.env.FRONTEND_URL?.startsWith("https://")) {
  throw new Error("FRONTEND_URL must be the stable production HTTPS origin.");
}
console.log("Vercel project root and production backend connection verified.");
