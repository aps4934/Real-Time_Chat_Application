const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Database Setup
const db = new Database('chat.db');
db.pragma('journal_mode = WAL');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER, -- NULL if group message
    group_id INTEGER,     -- NULL if 1-1 message
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users (id),
    FOREIGN KEY (recipient_id) REFERENCES users (id),
    FOREIGN KEY (group_id) REFERENCES groups (id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
  CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);

  INSERT OR IGNORE INTO groups (id, name, created_by) VALUES (1, 'General Nexus', NULL);
`);

const SECRET_KEY = process.env.JWT_SECRET || 'your-very-secret-key';

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
  const { username, password, avatar_url } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?)').run(username, password_hash, avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`);
    const token = jwt.sign({ id: info.lastInsertRowid, username }, SECRET_KEY);
    res.json({ token, user: { id: info.lastInsertRowid, username, avatar_url } });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (user && await bcrypt.compare(password, user.password_hash)) {
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
    res.json({ token, user: { id: user.id, username: user.username, avatar_url: user.avatar_url } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- API Routes ---
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, avatar_url FROM users').all();
  res.json(users);
});

app.get('/api/messages/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const myId = jwt.verify(req.headers.authorization, SECRET_KEY).id;
  
  let messages;
  if (type === 'user') {
    messages = db.prepare(`
      SELECT m.*, u.username as sender_name, u.avatar_url as sender_avatar 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (sender_id = ? AND recipient_id = ?) 
         OR (sender_id = ? AND recipient_id = ?)
      ORDER BY created_at ASC
    `).all(myId, id, id, myId);
  } else {
    messages = db.prepare(`
      SELECT m.*, u.username as sender_name, u.avatar_url as sender_avatar 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE group_id = ?
      ORDER BY created_at ASC
    `).all(id);
  }
  res.json(messages);
});

// --- Socket.io ---
const onlineUsers = new Map(); // userId -> socketId

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth error'));
  try {
    const user = jwt.verify(token, SECRET_KEY);
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Auth error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);
  
  // Status: online
  io.emit('user_status', { userId, status: 'online' });

  // Handle message
  socket.on('send_message', (data) => {
    const { recipientId, groupId, content } = data;
    const stmt = db.prepare('INSERT INTO messages (sender_id, recipient_id, group_id, content) VALUES (?, ?, ?, ?)');
    const info = stmt.run(userId, recipientId || null, groupId || null, content);
    
    const message = {
      id: info.lastInsertRowid,
      sender_id: userId,
      recipient_id: recipientId,
      group_id: groupId,
      content,
      created_at: new Date().toISOString(),
      sender_name: socket.user.username
    };

    if (groupId) {
      io.to(`group_${groupId}`).emit('receive_message', message);
    } else if (recipientId) {
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        socket.to(recipientSocketId).emit('receive_message', message);
      }
      socket.emit('receive_message', message); // also send back to sender
    }
  });

  // Handle typing
  socket.on('typing', (data) => {
    const { recipientId, groupId } = data;
    if (groupId) {
      socket.to(`group_${groupId}`).emit('display_typing', { userId, groupId });
    } else {
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        socket.to(recipientSocketId).emit('display_typing', { userId });
      }
    }
  });

  // Join group rooms
  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('user_status', { userId, status: 'offline' });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 NexusChat Server running on port ${PORT}`);
});
