const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomCode -> { players: [], gameStarted: false }

const categories = {
  "Alien Invasion": [
    "Aliens land", "Humans react", "Military responds",
    "Aliens retaliate", "Big battle", "Peace is achieved"
  ],
  "Haunted House": [
    "Creepy door creaks open", "Ghost appears", "Scream in the night",
    "Search for the ghost", "Discover hidden room", "Escape the house"
  ],
  "Underwater Adventure": [
    "Dive into the deep sea", "Discover a sunken ship", "Meet a giant squid",
    "Find hidden treasure", "Escape a dangerous shark", "Return safely to surface"
  ],
  "Space Station": [
    "Launch into orbit", "Fix broken equipment", "Alien signal detected",
    "Spacewalk repair mission", "Meteor shower danger", "Safe return to Earth"
  ],
  "Medieval Quest": [
    "Meet the king", "Fight off bandits", "Find a magical sword",
    "Rescue the princess", "Defeat the dragon", "Celebrate victory feast"
  ],
  "Jungle Safari": [
    "Enter the jungle", "Spot wild animals", "Cross a rickety bridge",
    "Find ancient ruins", "Encounter a tribe", "Return to camp"
  ],
  "Robot Factory": [
    "Factory assembly line", "Robot malfunction", "Fix the robot",
    "Escape factory shutdown", "Robot rebellion", "Restore power"
  ],
  "Pirate Adventure": [
    "Find the treasure map", "Sail through storms", "Fight enemy pirates",
    "Discover hidden island", "Escape from sea monsters", "Buried treasure found"
  ],
  "Wild West": [
    "Enter the town", "Showdown at high noon", "Train robbery",
    "Rescue the sheriff", "Horse chase", "Celebrate at the saloon"
  ],
  "Superhero Mission": [
    "City under attack", "Save civilians", "Fight supervillain",
    "Team up with heroes", "Defuse the bomb", "Victory parade"
  ],
  "Mystery Detective": [
    "Crime scene investigation", "Find clues", "Interrogate suspects",
    "Discover secret passage", "Catch the culprit", "Solve the mystery"
  ],
  "Fantasy Kingdom": [
    "Explore enchanted forest", "Meet the wizard", "Battle evil sorcerer",
    "Find the magic crystal", "Protect the kingdom", "Coronation ceremony"
  ],
  "Time Travel": [
    "Enter the time machine", "Ancient civilization", "Future city",
    "Avoid paradox", "Fix the timeline", "Return to present"
  ],
  "Circus Show": [
    "Welcome to the circus", "Perform daring acrobatics", "Tame the lions",
    "Clown comedy act", "Big top finale", "Audience applause"
  ]
};

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join-room', ({ roomCode, name }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], gameStarted: false };
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

    room.players.push({ id: socket.id, name, drawing: null });
    socket.join(roomCode);

    io.to(roomCode).emit('room-update', room.players.map(p => ({ name: p.name })));

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

    room.players.forEach((player, i) => {
      player.assignedScene = scenes[i];
    });

    io.to(roomCode).emit('start-game', {
      category: chosenCategory,
      players: room.players.map(p => ({ name: p.name, assignedScene: p.assignedScene })),
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
        assignedScene: p.assignedScene,
        imageData: p.drawing
      }));

      const category = room.players[0].assignedScene ? Object.keys(categories).find(cat =>
        categories[cat].includes(room.players[0].assignedScene)
      ) : 'Your Story';

      io.to(roomCode).emit('start-slideshow', { category, slides });
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomCode).emit('room-update', room.players.map(p => ({ name: p.name })));
      }
    }
  });
});

app.use(express.static('public'));

server.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});