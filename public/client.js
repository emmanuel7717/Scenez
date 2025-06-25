const socket = io();

let currentRoomCode = null;

function generateDeviceId() {
  return 'dev-' + Math.random().toString(36).substr(2, 9);
}

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = generateDeviceId();
  localStorage.setItem('deviceId', deviceId);
}

function joinRoom() {
  const name = document.getElementById('name').value.trim();
  const room = document.getElementById('room').value.trim().toUpperCase();
  if (!name || !room) return alert('Please enter your name and room code!');

  currentRoomCode = room;
  socket.emit('join-room', { roomCode: room, name, deviceId });
}

function createRoom() {
  const roomInput = document.getElementById('room');
  const newCode = generateRoomCode();
  roomInput.value = newCode;
  alert(`Room code generated: ${newCode}. Share this with your friends to join!`);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

socket.on('room-update', (players) => {
  const list = document.getElementById('players');
  if (list) {
    list.innerHTML = '';
    players.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.name;
      list.appendChild(li);
    });
  }
});

function startManualGame() {
  const room = document.getElementById('room').value.trim().toUpperCase();
  const playerCount = document.querySelectorAll('#players li').length;

  if (playerCount < 3) {
    alert('You need at least 3 players to start the game.');
    return;
  }

  if (room) {
    socket.emit('start-game-manual', room);
  }
}

socket.on('room-full', () => {
  alert('Room is full. Please try another room code.');
});

socket.on('device-already-joined', () => {
  alert('You have already joined this room from this device.');
});

socket.on('name-taken', () => {
  alert('This name is already taken in the room. Please choose another.');
});

socket.on('start-game', ({ category, players }) => {
  alert(`Game starting!\nCategory: ${category}`);

  const name = document.getElementById('name').value.trim();
  const me = players.find(p => p.name === name);

  if (!me) {
    alert('Player data not found.');
    return;
  }

  document.body.innerHTML = `
    <div style="text-align:center; font-family: Arial, sans-serif; padding: 20px;">
      <h1>Category: ${category}</h1>
      <h2>Your scene to draw:</h2>
      <p style="font-size:1.5em; font-weight:bold;">${me.assignedScene}</p>
      <canvas id="drawCanvas" width="600" height="400" style="border:2px solid #333; background:#fff; cursor: crosshair;"></canvas>
      <div style="margin-top:10px;">
        <label>Color: <input type="color" id="colorPicker" value="#000000"></label>
        <label style="margin-left: 15px;">Brush Size: <input type="range" id="brushSize" min="1" max="20" value="3"></label>
      </div>
      <button id="clearBtn" style="margin-top:10px;">Clear</button>
      <button id="submitBtn" style="margin-top:10px; margin-left:15px;">Submit Drawing</button>
      <p id="status" style="color:green; font-weight:bold;"></p>
    </div>
  `;

  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let brushColor = document.getElementById('colorPicker').value;
  let brushSize = parseInt(document.getElementById('brushSize').value);

  canvas.addEventListener('mousedown', e => {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseout', () => drawing = false);

  document.getElementById('colorPicker').addEventListener('change', e => {
    brushColor = e.target.value;
  });
  document.getElementById('brushSize').addEventListener('input', e => {
    brushSize = parseInt(e.target.value);
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  document.getElementById('submitBtn').addEventListener('click', () => {
    const imageData = canvas.toDataURL('image/png');
    socket.emit('submit-drawing', { roomCode: currentRoomCode, imageData });
    document.getElementById('status').textContent = 'Drawing submitted! Waiting for others...';
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('clearBtn').disabled = true;
  });
});

socket.on('start-slideshow', ({ category, slides }) => {
  document.body.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
      <h1>Slideshow: ${category || 'Your Story'}</h1>
      <canvas id="slideshowCanvas" width="600" height="400" style="border:2px solid #333; background:#fff;"></canvas>
      <h2 id="sceneTitle"></h2>
      <h3 id="sceneAuthor"></h3>
    </div>
  `;

  const canvas = document.getElementById('slideshowCanvas');
  const ctx = canvas.getContext('2d');
  const titleEl = document.getElementById('sceneTitle');
  const authorEl = document.getElementById('sceneAuthor');

  function showSlide(i) {
    if (i >= slides.length) {
      titleEl.textContent = 'The End';
      authorEl.textContent = '';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const slide = slides[i];
    titleEl.textContent = `Scene: ${slide.assignedScene}`;
    authorEl.textContent = `Drawn by ${slide.name}`;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      let x = (canvas.width / 2) - (img.width / 2) * scale;
      let y = (canvas.height / 2) - (img.height / 2) * scale;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      const narration = `Scene ${i + 1}: ${slide.assignedScene}. Drawn by ${slide.name}.`;

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(narration);
        utterance.onend = () => {
          setTimeout(() => showSlide(i + 1), 1000);
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => showSlide(i + 1), 7000);
      }
    };

    img.src = slide.imageData;
  }

  showSlide(0);
});