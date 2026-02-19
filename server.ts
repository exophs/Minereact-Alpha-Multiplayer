import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";

async function startServer() {
  try {
    const app = express();
    const server = createServer(app);
    const io = new Server(server);
    const PORT = 3000;

    // Room State
  interface Room {
    id: string;
    name: string;
    password?: string;
    players: string[]; // socket ids
  }

  const rooms: Record<string, Room> = {};

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Send initial room list
    socket.emit("room_list", Object.values(rooms).map(r => ({ id: r.id, name: r.name, hasPassword: !!r.password, playerCount: r.players.length })));

    socket.on("create_room", ({ name, password }, callback) => {
      const id = Math.random().toString(36).substring(2, 9);
      rooms[id] = { id, name, password: password || undefined, players: [] };
      io.emit("room_list", Object.values(rooms).map(r => ({ id: r.id, name: r.name, hasPassword: !!r.password, playerCount: r.players.length })));
      callback({ success: true, roomId: id });
    });

    socket.on("join_room", ({ roomId, password }, callback) => {
      const room = rooms[roomId];
      if (!room) {
        return callback({ success: false, message: "Room not found" });
      }
      if (room.password && room.password !== password) {
        return callback({ success: false, message: "Incorrect password" });
      }
      
      socket.join(roomId);
      room.players.push(socket.id);
      
      // Notify others in room
      socket.to(roomId).emit("player_joined", { id: socket.id });
      
      // Update room list for everyone (player count changed)
      io.emit("room_list", Object.values(rooms).map(r => ({ id: r.id, name: r.name, hasPassword: !!r.password, playerCount: r.players.length })));
      
      callback({ success: true });
    });

    socket.on("leave_room", ({ roomId }) => {
      const room = rooms[roomId];
      if (room) {
        socket.leave(roomId);
        room.players = room.players.filter(id => id !== socket.id);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
            socket.to(roomId).emit("player_left", { id: socket.id });
        }
        io.emit("room_list", Object.values(rooms).map(r => ({ id: r.id, name: r.name, hasPassword: !!r.password, playerCount: r.players.length })));
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Clean up empty rooms if needed, or handle player leave
      for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.players.includes(socket.id)) {
            room.players = room.players.filter(id => id !== socket.id);
            if (room.players.length === 0) {
                delete rooms[roomId];
            } else {
                socket.to(roomId).emit("player_left", { id: socket.id });
            }
        }
      }
      io.emit("room_list", Object.values(rooms).map(r => ({ id: r.id, name: r.name, hasPassword: !!r.password, playerCount: r.players.length })));
    });

    // Game Sync Events (Basic)
    socket.on("player_move", ({ roomId, position, rotation }) => {
        socket.to(roomId).emit("player_moved", { id: socket.id, position, rotation });
    });

    socket.on("block_update", ({ roomId, x, y, z, type }) => {
        socket.to(roomId).emit("block_updated", { x, y, z, type });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
      // Serve static files in production (if needed later)
      app.use(express.static('dist'));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
