/** @format */

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Store connected users
const users = new Map();
const messages = new Map(); // Store messages for each conversation
const typingUsers = new Map(); // Store typing status

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User joins with username
  socket.on("join", (userData) => {
    const { username, userId } = userData;

    users.set(socket.id, {
      id: userId,
      username,
      socketId: socket.id,
      isOnline: true,
      lastSeen: new Date(),
    });

    socket.userId = userId;
    socket.username = username;

    // Send updated user list to all clients
    io.emit("users-updated", Array.from(users.values()));

    console.log(`${username} joined the chat`);
  });

  // Handle private messages
  socket.on("private-message", (data) => {
    const { recipientId, message, timestamp, messageId } = data;
    const sender = users.get(socket.id);

    if (sender) {
      // Find recipient socket
      const recipientSocket = Array.from(users.entries()).find(
        ([socketId, user]) => user.id === recipientId
      );

      if (recipientSocket) {
        const [recipientSocketId] = recipientSocket;

        const messageData = {
          id: messageId,
          senderId: sender.id,
          senderUsername: sender.username,
          recipientId,
          message,
          timestamp,
          isRead: false,
        };

        // Store message
        const conversationKey = [sender.id, recipientId].sort().join("-");
        if (!messages.has(conversationKey)) {
          messages.set(conversationKey, []);
        }
        messages.get(conversationKey).push(messageData);

        // Send to recipient
        io.to(recipientSocketId).emit("private-message", messageData);

        // Send confirmation to sender
        socket.emit("message-sent", { messageId, timestamp });
      }
    }
  });

  // Handle message read status
  socket.on("mark-messages-read", (data) => {
    const { senderId } = data;
    const currentUser = users.get(socket.id);

    if (currentUser) {
      const conversationKey = [currentUser.id, senderId].sort().join("-");
      const conversationMessages = messages.get(conversationKey);

      if (conversationMessages) {
        conversationMessages.forEach((msg) => {
          if (msg.recipientId === currentUser.id) {
            msg.isRead = true;
          }
        });

        // Notify sender that messages have been read
        const senderSocket = Array.from(users.entries()).find(
          ([socketId, user]) => user.id === senderId
        );

        if (senderSocket) {
          const [senderSocketId] = senderSocket;
          io.to(senderSocketId).emit("messages-read", {
            readBy: currentUser.id,
            conversationKey,
          });
        }
      }
    }
  });

  // Handle typing indicators
  socket.on("typing-start", (data) => {
    const { recipientId } = data;
    const sender = users.get(socket.id);

    if (sender) {
      const recipientSocket = Array.from(users.entries()).find(
        ([socketId, user]) => user.id === recipientId
      );

      if (recipientSocket) {
        const [recipientSocketId] = recipientSocket;
        io.to(recipientSocketId).emit("user-typing", {
          userId: sender.id,
          username: sender.username,
        });
      }
    }
  });

  socket.on("typing-stop", (data) => {
    const { recipientId } = data;
    const sender = users.get(socket.id);

    if (sender) {
      const recipientSocket = Array.from(users.entries()).find(
        ([socketId, user]) => user.id === recipientId
      );

      if (recipientSocket) {
        const [recipientSocketId] = recipientSocket;
        io.to(recipientSocketId).emit("user-stop-typing", {
          userId: sender.id,
        });
      }
    }
  });

  // Get conversation history
  socket.on("get-conversation", (data) => {
    const { recipientId } = data;
    const currentUser = users.get(socket.id);

    if (currentUser) {
      const conversationKey = [currentUser.id, recipientId].sort().join("-");
      const conversationMessages = messages.get(conversationKey) || [];

      socket.emit("conversation-history", {
        recipientId,
        messages: conversationMessages,
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      // Update user status to offline
      user.isOnline = false;
      user.lastSeen = new Date();

      // Remove from users map after a delay
      setTimeout(() => {
        users.delete(socket.id);
        io.emit("users-updated", Array.from(users.values()));
      }, 5000);

      // Immediately update users list with offline status
      io.emit("users-updated", Array.from(users.values()));

      console.log(`${user.username} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
