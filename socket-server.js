import http from "http";
import { Server } from "socket.io";
import "dotenv/config";

const SOCKET_PORT = process.env.SOCKET_PORT || 3001;

const server = http.createServer((req, res) => {
    // เปิด REST endpoint ง่ายๆ ไว้ให้ Next.js ฝั่ง API สั่งสะกิดมาหา Socket (HTTP-to-WebSocket Bridge)
    if (req.method === "POST" && req.url === "/emit") {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", () => {
            try {
                const { event, data } = JSON.parse(body);
                if (event) {
                    // กระจายของที่ได้ให้ลูกค้าทุกคนแบบ Real-time
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
    } else {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Sakura Market Socket.io Server is running.");
    }
});

const io = new Server(server, {
    cors: {
        origin: "*", // ยอมรับการเชื่อมต่อจาก Origin ใดๆ (กรณีอยู่ในช่วงพัฒนา สามารถเจาะจงโดเมนจริงทีหลังได้)
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

server.listen(SOCKET_PORT, () => {
    console.log(`🚀 Socket.io Server is running on port ${SOCKET_PORT}`);
});
