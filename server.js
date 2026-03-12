/**
 * Custom Server — Next.js + Socket.io process เดียว (โดเมนเดียว)
 * ใช้กับ npm run dev:all และ npm run start
 */
import "dotenv/config";
import http from "http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
// รองรับการเข้า dev ผ่าน tunnel/มือถือ: bind 0.0.0.0 แทน localhost
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io/",
  });

  // POST /emit — ให้ API ฝั่ง Next ส่ง event มา broadcast (เช่น เมื่อมีผู้ใช้สมัคร)
  function handleEmit(req, res) {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { event, data } = JSON.parse(body);
        if (event) {
          io.emit(event, data);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "Emitted successfully" }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "Event name is required" }));
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Invalid JSON format" }));
      }
    });
  }

  // ใส่ handler ของเราไว้ก่อน Socket.io — /emit และ /socket.io ไม่ส่งเข้า Next
  httpServer.prependListener("request", (req, res) => {
    const pathname = (req.url || "").split("?")[0];
    if (req.method === "POST" && pathname === "/emit") {
      handleEmit(req, res);
      return;
    }
    if (pathname.startsWith("/socket.io")) return;
    handle(req, res);
  });

  // Forward WebSocket upgrade ให้ Next.js (HMR /_next/webpack-hmr) — Socket.io จัดการเฉพาะ /socket.io
  // ถ้าไม่ forward → HMR WebSocket fail → dev client ทำ full page reload loop บนมือถือ
  const nextUpgradeHandler = typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;
  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = (req.url || "").split("?")[0];
    if (pathname.startsWith("/socket.io")) return; // ให้ Socket.io จัดการเอง
    if (nextUpgradeHandler) nextUpgradeHandler(req, socket, head);
  });

  io.on("connection", (socket) => {
    console.log("Socket client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Socket client disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port} (Next + Socket.io)`);
      if (dev) console.log("  NODE_ENV=development");

      // ปลดล็อคร้านที่เจ้าของไม่ออนไลน์เกิน N วัน — รันอัตโนมัติทุก 24 ชม. (ปิดได้ด้วย CRON_RELEASE_OFFLINE_ENABLED=false)
      const cronEnabled = process.env.CRON_RELEASE_OFFLINE_ENABLED !== "false";
      if (cronEnabled) {
        const runRelease = () => {
          const base = `http://127.0.0.1:${port}`;
          const secret = process.env.CRON_SECRET || "";
          fetch(`${base}/api/cron/release-offline-locks`, {
            method: "GET",
            headers: secret ? { "X-Cron-Secret": secret } : {},
          })
            .then((r) => r.json())
            .then((data) => console.log("[cron] release-offline-locks:", data?.released ?? data))
            .catch((err) => console.error("[cron] release-offline-locks error:", err.message));
        };
        setTimeout(runRelease, 60 * 1000);
        setInterval(runRelease, 24 * 60 * 60 * 1000);
      }

      // ลบแจ้งเตือนเก่ากว่า N วัน — รันอัตโนมัติทุก 10 วัน (ปิดได้ด้วย CRON_CLEANUP_NOTIFICATIONS_ENABLED=false)
      const cleanupCronEnabled = process.env.CRON_CLEANUP_NOTIFICATIONS_ENABLED !== "false";
      if (cleanupCronEnabled) {
        const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
        const base = `http://127.0.0.1:${port}`;
        const secret = process.env.CRON_SECRET || "";
        const runCleanup = () => {
          fetch(`${base}/api/cron/cleanup-old-notifications`, {
            method: "GET",
            headers: secret ? { "X-Cron-Secret": secret } : {},
          })
            .then((r) => r.json())
            .then((data) => console.log("[cron] cleanup-old-notifications:", data?.notificationsDeleted ?? 0, "+", data?.userNotificationsDeleted ?? 0))
            .catch((err) => console.error("[cron] cleanup-old-notifications error:", err.message));
        };
        setTimeout(runCleanup, 5 * 60 * 1000);
        setInterval(runCleanup, tenDaysMs);
      }
    });
});
