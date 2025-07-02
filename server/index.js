const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomCode -> { players: [], gameStarted: false, category: null, votes: {} }

const categories = {
  "Fruits": ["Apple", "Banana", "Orange", "Strawberry", "Watermelon slice", "Grapes", "Pineapple"],
  "Simple Animals": ["Cat", "Dog", "Fish", "Bird", "Turtle", "Frog", "Rabbit"],
  "Common Foods": ["Pizza slice", "Burger", "Hot dog", "Ice cream cone", "Cupcake", "French fries", "Donut"],
  "Nature Elements": ["Tree", "Flower", "Cloud", "Sun", "Leaf", "Mountain", "Rain"],
  "Household Objects": ["Lamp", "Chair", "Clock", "Cup", "Shoe", "Backpack", "Phone"],
  "Funny Accessories": ["Sunglasses", "Hat", "Bowtie", "Mustache", "Crazy socks", "Necklace", "Watch"],
  "Transportation": ["Bicycle", "Car", "Bus", "Boat", "Airplane", "Scooter", "Skateboard"],
  "Famous Anime Characters": ["Goku", "Naruto", "Sailor Moon", "Pikachu", "Luffy", "Totoro", "Astro Boy"]
};

function resetRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.gameStarted = false;
  room.category = null;
  room.votes = {};
  room.players.forEach(p => {
    p.drawing = null;
    p.assignedScene = null;
  });
}

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join-room', ({ roomCode, name, avatar, deviceId }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], gameStarted: false, category: null, votes: {} };
    }

    const room = rooms[roomCode];
    if (room.gameStarted) return socket.emit('game-already-started');
    if (room.players.some(p => p.name === name)) return socket.emit('name-taken');
    if (room.players.length >= 6) return socket.emit('room-full');
    if (room.players.some(p => p.avatar === avatar)) return socket.emit('avatar-taken');
    if (room.players.some(p => p.deviceId === deviceId)) return socket.emit('device-already-joined');

    const playerNumber = room.players.length + 1;
    room.players.push({ id: socket.id, name, avatar, drawing: null, playerNumber, assignedScene: null, deviceId });
    socket.join(roomCode);

    io.to(roomCode).emit('room-update', room.players.map(p => ({
      name: p.name,
      avatar: `${p.avatar} ${p.playerNumber}`,
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
      player.assignedScene = scenes[i] || "Random Scene";
      player.drawing = null;
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

    console.log(`Game started in room ${roomCode} with category ${chosenCategory}`);
  }

  socket.on('submit-drawing', ({ roomCode, imageData }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.drawing = imageData;

    if (room.players.every(p => p.drawing)) {
      startSlideshowPhase(roomCode);
    }
  });

  // ✅ NEW: Start slideshow automatically when timer ends
  socket.on('drawing-time-up', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    // Set empty drawing for anyone who didn't submit
    room.players.forEach(p => {
      if (!p.drawing) p.drawing = '';
    });

    startSlideshowPhase(roomCode);
  });

  function startSlideshowPhase(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const slides = room.players.map(p => ({
      name: p.name,
      avatar: `${p.avatar} ${p.playerNumber}`,
      assignedScene: p.assignedScene,
      imageData: p.drawing
    }));

    io.to(roomCode).emit('start-slideshow', {
      category: room.category,
      slides
    });

    // (Optional) trigger voting after 60s
    setTimeout(() => {
      io.to(roomCode).emit('start-voting', {
        players: room.players.map(p => ({
          name: p.name,
          avatar: `${p.avatar} ${p.playerNumber}`
        }))
      });
    }, 60000);
  }

  socket.on('submit-vote', ({ roomCode, voterName, votedForName }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (!room.votes) room.votes = {};
    room.votes[voterName] = votedForName;

    io.to(roomCode).emit('update-votes', room.votes);

    if (Object.keys(room.votes).length === room.players.length) {
      const voteCounts = {};
      Object.values(room.votes).forEach(name => {
        voteCounts[name] = (voteCounts[name] || 0) + 1;
      });

      let maxVotes = 0;
      let winners = [];
      for (const [name, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          winners = [name];
        } else if (count === maxVotes) {
          winners.push(name);
        }
      }

      io.to(roomCode).emit('voting-results', { winners, voteCounts });
      resetRoom(roomCode);
    }
  });

  socket.on('back-to-lobby', (roomCode) => {
    resetRoom(roomCode);
    const room = rooms[roomCode];
    if (!room) return;
    io.to(roomCode).emit('back-to-lobby');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        room.players.forEach((p, i) => {
          p.playerNumber = i + 1;
        });
        io.to(roomCode).emit('room-update', room.players.map(p => ({
          name: p.name,
          avatar: `${p.avatar} ${p.playerNumber}`,
          playerNumber: p.playerNumber
        })));
        if (room.players.length === 0) {
          delete rooms[roomCode];
          console.log(`Room ${roomCode} deleted`);
        }
        break;
      }
    }
  });
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
