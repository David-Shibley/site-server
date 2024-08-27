// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');

const app = express();
app.use(express.json());
app.use(cors());

const redisClient = redis.createClient({
    url: process.env.REDIS_URL,
});
redisClient.connect();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('gameOver', async (room, players) => {
        io.to(room).emit('gameOver', players);
    });
    socket.on('setDice', async (room, dice) => {
        io.to(room).emit('setDice', dice);
    });
    socket.on('updateDiceOwner', async (room, player) => {
        io.to(room).emit('updateDiceOwner', player);
    });

    socket.on('updateCardOwner', async (room, card, player) => {
        io.to(room).emit('updateCardOwner', card, player);
        console.log('updateCardOwner', room, card, player);
    });

    socket.on('startGame', async (room, dice) => {
        io.to(room).emit('startGame', dice);
    });

    socket.on('nextTurn', async (room, players) => {
        io.to(room).emit('nextTurn', players);
    });

    socket.on('assassinate', async (room, player) => {
        io.to(room).emit('assassinate', player);
    });

    socket.on('coup', async (room, player) => {
        io.to(room).emit('coup', player);
    });

    socket.on('challenge', async (room) => {
        io.to(room).emit('challenge');
    });

    socket.on('joinRoom', async (room, player) => {
        socket.join(room);
        let roomData = await redisClient.get(room);
        roomData = roomData ? JSON.parse(roomData) : [];
        
        const existingPlayer = roomData.find(p => p.id === socket.id);
        if (!existingPlayer) {
            roomData.push({ ...player, id: socket.id });
            await redisClient.set(room, JSON.stringify(roomData));
        }
        
        io.to(room).emit('updatePlayers', roomData);
    });

    socket.on('leaveRoom', async (room, playerId) => {
        let roomData = await redisClient.get(room);
        if (roomData) {
            roomData = JSON.parse(roomData).filter(player => player.id !== playerId);
            if (roomData.length === 0) {
                await redisClient.del(room);
            } else {
                await redisClient.set(room, JSON.stringify(roomData));
            }
            io.to(room).emit('updatePlayers', roomData);
        }
        socket.leave(room);
    });

    socket.on('disconnect', async () => {
        const rooms = await redisClient.keys('*')
        for (const room of rooms) {
            let roomData = await redisClient.get(room);
            console.log('roomData', roomData, rooms);
            if (roomData) {
                roomData = JSON.parse(roomData).filter(player => player.id !== socket.id);
                if (roomData.length === 0) {
                    console.log('delete room', room);
                    await redisClient.del(room);
                    console.log('deleted room', room);
                } else {
                    await redisClient.set(room, JSON.stringify(roomData));
                }
                io.to(room).emit('updatePlayers', roomData);
            }
        }
        console.log('user disconnected');
    });
});

server.listen(4000, () => {
  console.log('Listening on port 4000');
});
