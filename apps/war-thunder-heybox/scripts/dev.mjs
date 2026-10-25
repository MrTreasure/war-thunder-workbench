import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// The local Browser Mock proxy runs in Node. Prefer the working IPv4 route on
// this development host; real mini-program requests still use the phone Host.
const options = process.env.NODE_OPTIONS || "";
const nodeOptions = /--dns-result-order(?:=|\s)/.test(options)
  ? options
  : `${options} --dns-result-order=ipv4first`.trim();
const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "hb-sdk", "dev", ...process.argv.slice(2)],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 130 : 1);
});
