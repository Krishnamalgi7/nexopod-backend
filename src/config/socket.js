const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Store = require("../models/Store");

let io;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (typeof token !== "string" || !token) {
        return next(new Error("Shop Owner authentication required."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (
        decoded.role !== "shopOwner" ||
        !mongoose.Types.ObjectId.isValid(decoded.storeId) ||
        typeof decoded.phone !== "string"
      ) {
        return next(new Error("Invalid Shop Owner token."));
      }

      const store = await Store.findOne({
        _id: decoded.storeId,
        contactNumber: decoded.phone,
        isActive: true,
      }).select("_id name contactNumber isActive");

      if (!store) {
        return next(new Error("Shop Owner access is no longer authorized."));
      }

      socket.data.storeId = store._id.toString();
      socket.data.phone = store.contactNumber;

      next();
    } catch (error) {
      next(new Error("Invalid or expired Shop Owner session."));
    }
  });

  io.on("connection", async (socket) => {
    const room = `store:${socket.data.storeId}`;

    try {
      socket.join(room);

      const store = await Store.findOne({
        _id: socket.data.storeId,
        contactNumber: socket.data.phone,
        isActive: true,
      }).select("_id");

      if (!store) {
        socket.disconnect(true);
        return;
      }

      console.log("[Socket] Shop Owner connected to store room.");
    } catch (error) {
      console.error("[Socket] Connection authorization failed:", error.message);
      socket.disconnect(true);
    }
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
};

const disconnectStoreSockets = (storeId) => {
  if (!io) return;

  io.in(`store:${storeId}`).disconnectSockets(true);
};

module.exports = {
  initializeSocket,
  getIO,
  disconnectStoreSockets,
};
