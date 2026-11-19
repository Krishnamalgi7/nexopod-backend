
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Store = require("../models/Store");
const SuperAdmin = require("../models/SuperAdmin");

let io;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  // Authenticate Shop Owners and Super Admins.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (typeof token !== "string" || !token) {
        return next(new Error("Authentication required."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Shop Owner authentication.
      if (decoded.role === "shopOwner") {
        if (!mongoose.Types.ObjectId.isValid(decoded.storeId)) {
          return next(new Error("Invalid Shop Owner token."));
        }

        const store = await Store.findOne({
          _id: decoded.storeId,
          isActive: true,
        }).select("_id name contactNumber isActive");

        if (!store) {
          return next(new Error("Shop Owner access is no longer authorized."));
        }

        socket.data.role = "shopOwner";
        socket.data.storeId = store._id.toString();
        socket.data.phone = store.contactNumber;

        return next();
      }

      // Super Admin authentication.
      if (
        typeof decoded.userId !== "string" ||
        !mongoose.isValidObjectId(decoded.userId)
      ) {
        return next(new Error("Invalid authentication token."));
      }

      const superAdmin = await SuperAdmin.findById(decoded.userId).select("_id");

      if (!superAdmin) {
        return next(new Error("Super Admin account not found."));
      }

      socket.data.role = "superAdmin";
      socket.data.superAdminId = superAdmin._id.toString();

      return next();
    } catch (error) {
      return next(new Error("Invalid or expired session."));
    }
  });

  io.on("connection", async (socket) => {
    try {
      // Super Admin joins the admin notification room.
      if (socket.data.role === "superAdmin") {
        socket.join("super-admin");

        console.log("[Socket] Super Admin connected.");

        return;
      }

      // Shop Owner joins their own store room.
      if (socket.data.role === "shopOwner") {
        const room = `store:${socket.data.storeId}`;

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
      }
    } catch (error) {
      console.error(
        "[Socket] Connection authorization failed:",
        error.message,
      );

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
