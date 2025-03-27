const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ✅ Added CORS to allow requests from frontend (PORT 3000)
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Ensure this matches your frontend URL
        methods: ["GET", "POST"]
    }
});

const port = process.env.PORT || 5173;
const env = process.env.NODE_ENV || "development";


// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public/webrtc-html/webrtc-video-conference/public")));
app.use(express.static(path.join(__dirname, "node_modules")));

// Redirect to HTTPS
app.get("*", (req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https" && env !== "development") {
        return res.redirect(["https://", req.get("Host"), req.url].join(""));
    }
    next();
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

io.sockets.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    /**
     * Log actions to the client
     */
    function log(...messages) {
        console.log("Server:", ...messages);
        socket.emit("log", ["Server:", ...messages]);
    }

    /**
     * Handle messages between clients
     */
    socket.on("message", (message, toId = null, room = null) => {
        console.log(`Message received from ${socket.id}:`, message);

        if (toId) {
            console.log(`Sending message to ${toId}`);
            io.to(toId).emit("message", message, socket.id);
        } else if (room) {
            console.log(`Broadcasting message in room ${room}`);
            socket.broadcast.to(room).emit("message", message, socket.id);
        } else {
            console.log(`Broadcasting message to all`);
            socket.broadcast.emit("message", message, socket.id);
        }
    });

    let roomAdmin; // Save admin's socket ID

    /**
     * Room creation & joining
     */
    socket.on("create or join", (room) => {
        log("Create or Join room:", room);

        // Get number of clients in the room
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;

        console.log(`Room ${room} has ${numClients} client(s) connected.`);

        if (numClients === 0) {
            // Create the room
            socket.join(room);
            roomAdmin = socket.id;
            socket.emit("created", room, socket.id);
            console.log(`Room ${room} created by ${socket.id}`);
        } else if (numClients < 2) {
            // Allow joining if the room is not full
            log(`Client ${socket.id} joined room ${room}`);
            socket.join(room);
            io.to(socket.id).emit("joined", room, socket.id);
            io.sockets.in(room).emit("ready", socket.id);
            console.log(`User ${socket.id} joined room ${room}`);
        } else {
            // Notify user that the room is full
            socket.emit("room-full", room);
            console.log(`Room ${room} is full, ${socket.id} could not join.`);
        }
    });

    /**
     * Notify clients when a room is full
     */
    socket.on("room-full", (room) => {
        socket.emit("error", `The room ${room} is already full. Try another room.`);
    });

    /**
     * Kick a participant from a call
     */
    socket.on("kickout", (socketId, room) => {
        if (socket.id === roomAdmin) {
            io.to(socketId).emit("kickout");
            io.sockets.sockets.get(socketId)?.leave(room);
            console.log(`User ${socketId} was kicked out of room ${room}`);
        } else {
            console.log("Kickout request denied. Only room admin can kick users.");
        }
    });

    /**
     * Handle a participant leaving a room
     */
    socket.on("leave room", (room) => {
        socket.leave(room);
        socket.emit("left room", room);
        socket.broadcast.to(room).emit("message", { type: "leave" }, socket.id);
        console.log(`User ${socket.id} left room ${room}`);
    });

    /**
     * Handle user disconnection
     */
    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => {
            if (room !== socket.id) {
                socket.broadcast.to(room).emit("message", { type: "leave" }, socket.id);
            }
        });
        console.log(`User ${socket.id} is disconnecting.`);
    });

    socket.on("disconnect", () => {
        console.log(`User ${socket.id} disconnected.`);
    });
});

console.log("WebRTC signaling server is running...");

// Start server
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});



