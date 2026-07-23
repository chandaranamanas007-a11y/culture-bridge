import { io } from "socket.io-client";

// Create a socket factory so each tab/component gets
// the SAME socket instance, but we never auto-connect
// until the component is ready.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export { socket };
