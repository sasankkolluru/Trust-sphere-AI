import { spawn } from "node:child_process";
import process from "node:process";

const python =
  process.platform === "win32" ? ".\\.venv\\Scripts\\python.exe" : "./.venv/bin/python";

const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--app-dir",
    "ai-service",
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
    "--reload",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
