require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const db = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// WebSocket для реального времени
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Регистрация пользователя
  socket.on('register_user', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('user_online', userId);
  });

  // Отправка сообщения
  socket.on('send_message', (data) => {
    const { recipientId, message } = data;
    const recipientSocketId = onlineUsers.get(recipientId);
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('new_message', message);
    }
    
    // Сохраняем в БД (здесь должна быть логика сохранения)
    saveMessageToDB(data);
  });

  // Статус печати
  socket.on('typing', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', {
        userId: data.userId,
        isTyping: data.isTyping
      });
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit('user_offline', userId);
        break;
      }
    }
  });
});

// Подключение к БД
db.connect()
  .then(() => console.log('Подключено к PostgreSQL'))
  .catch(err => console.error('Ошибка подключения:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Сервер Бересты запущен на порту ${PORT}`);
});
