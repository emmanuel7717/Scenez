const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomCode -> { players: [], gameStarted: false, category: null }

const categories = {
  "Fruits": [
    "Apple",
    "Banana",
    "Orange",
    "Strawberry",
    "Watermelon slice",
    "Grapes",
    "Pineapple"
  ],
  "Simple Animals": [
    "Cat",
    "Dog",
    "Fish",
    "Bird",
    "Turtle",
    "Frog",
    "Rabbit"
  ],
  "Common Foods": [
    "Pizza slice",
    "Burger",
    "Hot dog",
    "Ice cream cone",
    "Cupcake",
    "French fries",
    "Donut"
  ],
  "Nature Elements": [
    "Tree",
    "Flower",
    "Cloud",
    "Sun",
    "Leaf",
    "Mountain",
    "Rain"
  ],
  "Household Objects": [
    "Lamp",
    "Chair",
    "Clock",
    "Cup",
    "Shoe",
    "Backpack",
    "Phone"
  ],
  "Funny Accessories": [
    "Sunglasses",
    "Hat",
    "Bowtie",
    "Mustache",
    "Crazy socks",
    "Necklace",
    "Watch"
  ],
  "Transportation": [
    "Bicycle",
    "Car",
    "Bus",
    "Boat",
    "Airplane",
    "Scooter",
    "Skateboard"
  ],
  "Famous Anime Characters": [
    "Goku",
    "Naruto",
    "Sailor Moon",
    "Pikachu",
    "Luffy",
    "Totoro",
    "Astro Boy"
  ]
};

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join-room', ({ roomCode, name, avatar }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], gameStarted: false, category: null };
    }

    const room = rooms[roomCode];

    if (room.players.some(p => p.name === name)) {
      socket.emit('name-taken');
      return;
    }

    if (room.players.length >= 6) {
      socket.emit('room-full');
      return;
    }

    // Check if avatar already taken by another player in this room
    if (room.players.some(p => p.avatar === avatar)) {
      socket.emit('avatar-taken', 'This avatar is already taken in this room. Pick another!');
      return;
    }

    // Assign playerNumber as index + 1 (join order)
    const playerNumber = room.players.length + 1;

    room.players.push({ id: socket.id, name, avatar, drawing: null, playerNumber });
    socket.join(roomCode);

    // Emit updated room players list with exact avatars selected
    io.to(roomCode).emit('room-update', room.players.map(p => ({
      name: p.name,
      avatar: `${p.avatar} ${p.playerNumber}`, // show avatar + number
      playerNumber: p.playerNumber
    })));

    if (room.players.length === 6 && !room.gameStarted) {
      startGameForRoom(roomCode);
    }
  });

  socket.on('start-game-manual', (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.players.length < 3 || room.gameStarted) return;
    startGameForRoom(roomCode);
  });

  function startGameForRoom(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.gameStarted = true;

    const categoryNames = Object.keys(categories);
    const chosenCategory = categoryNames[Math.floor(Math.random() * categoryNames.length)];
    const scenes = categories[chosenCategory];
    room.category = chosenCategory;

    room.players.forEach((player, i) => {
      player.assignedScene = scenes[i];
    });

    io.to(roomCode).emit('start-game', {
      category: chosenCategory,
      players: room.players.map(p => ({
        name: p.name,
        avatar: `${p.avatar} ${p.playerNumber}`,
        assignedScene: p.assignedScene,
        playerNumber: p.playerNumber
      })),
    });
  }

  socket.on('submit-drawing', ({ roomCode, imageData }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.drawing = imageData;

    if (room.players.every(p => p.drawing)) {
      const slides = room.players.map(p => ({
        name: p.name,
        avatar: `${p.avatar} ${p.playerNumber}`,
        assignedScene: p.assignedScene,
        imageData: p.drawing
      }));

      io.to(roomCode).emit('start-slideshow', { category: room.category, slides });
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);

        // Reassign playerNumbers to keep consistent order
        room.players.forEach((p, i) => {
          p.playerNumber = i + 1;
        });

        io.to(roomCode).emit('room-update', room.players.map(p => ({
          name: p.name,
          avatar: `${p.avatar} ${p.playerNumber}`,
          playerNumber: p.playerNumber
        })));
      }
    }
  });
});

app.use(express.static('public'));
// ... all your existing code ...

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
