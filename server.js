/** @format */

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowEIO3: true,
  },
});

app.use(cors());
app.use(express.json());

// Store connected users and their chat rooms
const connectedUsers = new Map();
const chatRooms = new Map();
const messageHistory = new Map();

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Get all online users
function getOnlineUsers() {
  return Array.from(connectedUsers.values());
}

// Create or get chat room between two users
function getChatRoomId(userId1, userId2) {
  return [userId1, userId2].sort().join("-");
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user joining
  socket.on("join", ({ username }) => {
    const user = {
      id: socket.id,
      username,
      isOnline: true,
    };

    connectedUsers.set(socket.id, user);

    // Send user ID back to the client
    socket.emit("user_joined", { userId: socket.id, username });

    // Broadcast updated user list to all clients
    io.emit("users_updated", getOnlineUsers());

    console.log(`${username} joined the chat`);
  });

  // Handle starting a chat
  socket.on("start_chat", ({ userId }) => {
    const currentUser = connectedUsers.get(socket.id);
    const targetUser = connectedUsers.get(userId);

    if (currentUser && targetUser) {
      const roomId = getChatRoomId(socket.id, userId);

      // Join both users to the room
      socket.join(roomId);
      io.sockets.sockets.get(userId)?.join(roomId);

      // Send chat history if exists
      const history = messageHistory.get(roomId) || [];
      socket.emit("chat_history", history);

      console.log(
        `Chat started between ${currentUser.username} and ${targetUser.username}`
      );
    }
  });

  // Handle sending messages
  socket.on("send_message", ({ receiverId, content }) => {
    const sender = connectedUsers.get(socket.id);
    const receiver = connectedUsers.get(receiverId);

    if (sender && receiver) {
      const roomId = getChatRoomId(socket.id, receiverId);

      const message = {
        id: generateId(),
        senderId: socket.id,
        senderName: sender.username,
        receiverId,
        content,
        timestamp: new Date(),
        isRead: false,
      };

      // Store message in history
      if (!messageHistory.has(roomId)) {
        messageHistory.set(roomId, []);
      }
      messageHistory.get(roomId).push(message);

      // Send message to both users in the room
      io.to(roomId).emit("message_received", message);

      console.log(
        `Message from ${sender.username} to ${receiver.username}: ${content}`
      );
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`${user.username} disconnected`);
      connectedUsers.delete(socket.id);

      // Broadcast updated user list
      io.emit("users_updated", getOnlineUsers());
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
