import { io, Socket } from "socket.io-client";

// เก็บ Instance ของ Socket ไว้เรียกใช้เพื่อป้องกันการสร้างเชื่อมต่อ (Connection) ซ้ำหลายรอบ
let socket: Socket | undefined;

export const getSocket = (): Socket | undefined => {
    // หากโปรเจคไม่มี NEXT_PUBLIC_SOCKET_URL ระบบจะได้ไม่แครช (Safe Fallback)
    if (!process.env.NEXT_PUBLIC_SOCKET_URL) {
        console.warn("Socket.io URL is missing in .env");
        return undefined;
    }

    if (!socket) {
        // กำหนด URL ของ Standalone socket server
        socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
            path: "/socket.io/",
            reconnectionAttempts: 5,     // ลองเชื่อมต่อซ้ำถ้าหลุด 5 ครั้ง
            reconnectionDelay: 2000,     // เว้นระยะการลองใหม่ทีละ 2 วิ
            autoConnect: true,
        });
    }
    return socket;
};
