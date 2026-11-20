import type { CapacitorConfig } from "@capacitor/cli";
const target = process.env.CAPACITOR_APP_URL;
if (!target) throw new Error("CAPACITOR_APP_URL must be a real deployed website");
const remote = new URL(target);
if (remote.protocol !== "https:") throw new Error("Capacitor website requires HTTPS");
const config: CapacitorConfig = {
  appId: "vn.gochopam.rc48",
  appName: "Góc Hợp Âm",
  webDir: "www",
  server: { url: remote.href, cleartext: false, allowNavigation: [remote.hostname, "*.vercel.app", "*.chatgpt.site"] },
};
export default config;
