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

let confirmedAvatar = localStorage.getItem('selectedAvatar') || '🐾';

function confirmAvatar(avatar) {
  if (confirm(`Confirm avatar ${avatar}? One avatar per player.`)) {
    confirmedAvatar = avatar;
    localStorage.setItem('selectedAvatar', avatar);
    const avatarDisplay = document.getElementById('selectedAvatarDisplay');
    if (avatarDisplay) avatarDisplay.textContent = avatar;
    return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  const avatarDisplay = document.getElementById('selectedAvatarDisplay');
  if (avatarDisplay) avatarDisplay.textContent = confirmedAvatar;
});

function joinRoom() {
  const name = document.getElementById('name').value.trim();
  const room = document.getElementById('room').value.trim().toUpperCase();
  if (!name || !room) return alert('Please enter your name and room code!');
  currentRoomCode = room;
  const selectedAvatar = localStorage.getItem('selectedAvatar') || '🐾';
  socket.emit('join-room', { roomCode: room, name, deviceId, avatar: selectedAvatar });
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
      const avatarSpan = document.createElement('span');
      avatarSpan.textContent = p.avatar || '🐾';
      avatarSpan.style.marginRight = '8px';
      li.appendChild(avatarSpan);
      li.appendChild(document.createTextNode(p.name));
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

socket.on('room-full', () => alert('Room is full. Please try another room code.'));
socket.on('device-already-joined', () => alert('You have already joined this room from this device.'));
socket.on('name-taken', () => alert('This name is already taken in the room. Please choose another.'));
socket.on('avatar-taken', () => alert('That avatar is already taken by another player. Pick a unique one!'));

// Speech function with calm British male voice preference
function speakText(text, onEnd) {
  if (!('speechSynthesis' in window)) {
    onEnd();
    return;
  }

  function getVoice() {
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = ['Daniel', 'Google UK English Male', 'Microsoft George Desktop'];

    for (const name of preferredVoices) {
      const voice = voices.find(v => v.name === name);
      if (voice) return voice;
    }

    const britishVoice = voices.find(v => v.lang === 'en-GB');
    if (britishVoice) return britishVoice;

    return voices[0] || null;
  }

  function trySpeak() {
    const voice = getVoice();
    if (!voice) {
      onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.pitch = 0.8;
    utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  }

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      trySpeak();
    };
  } else {
    trySpeak();
  }
}

function startSlideshow(category, slides) {
  document.body.innerHTML = `
    <div class="header-bar"><h1>Scenez</h1></div>
    <div class="game-container">
      <div class="players-sidebar"><h3>Players</h3><ul id="playerList"></ul></div>
      <div class="canvas-area" style="text-align:center;">
        <h1>Slideshow: ${category || 'Slideshow'}</h1>
        <canvas id="slideshowCanvas"></canvas>
        <h2 id="sceneTitle"></h2>
        <h3 id="sceneAuthor"></h3>
        <div id="endControls" style="margin-top: 20px;"></div>
      </div>
      <div class="info-sidebar"></div>
    </div>
  `;

  const canvas = document.getElementById('slideshowCanvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  const titleEl = document.getElementById('sceneTitle');
  const authorEl = document.getElementById('sceneAuthor');
  const playerList = document.getElementById('playerList');

  // Show unique players on sidebar
  const uniquePlayers = [...new Map(slides.map(s => [s.name, s])).values()];
  uniquePlayers.forEach(p => {
    const li = document.createElement('li');
    const avatarSpan = document.createElement('span');
    avatarSpan.textContent = p.avatar || '🐾';
    avatarSpan.style.marginRight = '8px';
    li.appendChild(avatarSpan);
    li.appendChild(document.createTextNode(p.name));
    playerList.appendChild(li);
  });

  function highlightPlayer(name) {
    [...playerList.children].forEach(li => {
      li.classList.toggle('hover-highlight', li.textContent.includes(name));
    });
  }

  function animateDrawing(img, onComplete) {
    let progress = 0;
    const totalSteps = 100;
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width / 2) - (img.width / 2) * scale;
    const y = (canvas.height / 2) - (img.height / 2) * scale;

    function drawStep() {
      progress++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const clipHeight = (img.height * scale) * (progress / totalSteps);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, img.width * scale, clipHeight);
      ctx.clip();
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      ctx.restore();

      if (progress < totalSteps) {
        requestAnimationFrame(drawStep);
      } else {
        onComplete();
      }
    }
    drawStep();
  }

  // Show slides sequentially with narration, then the end screen
  function showSlide(i) {
    if (i === slides.length) {
      // All slides shown — show The End
      titleEl.textContent = '🎉 The End!';
      authorEl.textContent = '';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      [...playerList.children].forEach(li => li.classList.remove('hover-highlight'));

      speakText('The End', () => {
        const backBtn = document.createElement('button');
        backBtn.textContent = '⬅ Back to Menu';
        backBtn.style.position = 'absolute';
        backBtn.style.top = '20px';
        backBtn.style.right = '20px';
        backBtn.style.padding = '12px 24px';
        backBtn.style.fontSize = '1rem';
        backBtn.style.border = 'none';
        backBtn.style.borderRadius = '8px';
        backBtn.style.background = '#00f2fe';
        backBtn.style.color = '#000';
        backBtn.style.cursor = 'pointer';
        backBtn.style.fontWeight = 'bold';
        backBtn.addEventListener('click', () => location.reload());
        document.body.appendChild(backBtn);
      });
      return;
    }

    const slide = slides[i];
    titleEl.textContent = `Scene: ${slide.assignedScene || 'No scene assigned'}`;
    authorEl.textContent = `Drawn by ${slide.name || 'Unknown'}`;
    highlightPlayer(slide.name);

    const img = new Image();
    img.onload = () => {
      animateDrawing(img, () => {
        const narration = `Scene ${i + 1}: ${slide.assignedScene || 'No scene assigned'}. Drawn by ${slide.name || 'Unknown'}.`;
        speakText(narration, () => {
          setTimeout(() => showSlide(i + 1), 500);
        });
      });
    };
    img.onerror = () => {
      console.warn(`Failed to load image for slide ${i}: ${slide.name}`);
      setTimeout(() => showSlide(i + 1), 500);
    };
    img.src = slide.imageData || '';
  }

  showSlide(0);
}

socket.on('start-game', ({ category, players }) => {
  const name = document.getElementById('name').value.trim();
  const me = players.find(p => p.name === name);
  if (!me) return alert('Player data not found.');
  currentRoomCode = currentRoomCode || document.getElementById('room').value.trim().toUpperCase();

  document.body.innerHTML = `
    <div class="header-bar"><h1>Scenez</h1></div>
    <div class="game-container">
      <div class="players-sidebar"><h3>Players</h3><ul id="playerList"></ul></div>
      <div class="canvas-area">
        <canvas id="drawCanvas"></canvas>
        <div class="controls">
          <label>Color: <input type="color" id="colorPicker" value="#000000"></label>
          <label>Brush Size: <input type="range" id="brushSize" min="1" max="20" value="3"></label>
          <button id="clearBtn">Clear</button>
          <p id="status" class="status-text"></p>
          <p id="timer" style="font-weight: bold; margin-top: 8px; font-size: 1.1em;">Time left: 0:10</p>
        </div>
      </div>
      <div class="info-sidebar">
        <h2>Category</h2>
        <p>${category}</p>
        <h2>Your Scene</h2>
        <p class="scene-text">${me.assignedScene || 'No scene assigned'}</p>
      </div>
    </div>
  `;

  const canvas = document.getElementById('drawCanvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let brushColor = document.getElementById('colorPicker').value;
  let brushSize = parseInt(document.getElementById('brushSize').value);

  function onMouseDown(e) {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  }

  function onMouseMove(e) {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function onMouseUp() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseout', onMouseUp);

  document.getElementById('colorPicker').addEventListener('change', e => brushColor = e.target.value);
  document.getElementById('brushSize').addEventListener('input', e => brushSize = parseInt(e.target.value));
  document.getElementById('clearBtn').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

  const statusEl = document.getElementById('status');
  const timerEl = document.getElementById('timer');
  let timeLeft = 5; // 5 seconds
  let timerInterval = null;

  function updateTimer() {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseout', onMouseUp);
      document.getElementById('clearBtn').disabled = true;

      const imageData = canvas.toDataURL('image/png');
      socket.emit('submit-drawing', { roomCode: currentRoomCode, imageData });
      socket.emit('drawing-complete', currentRoomCode);

      const fallbackSlides = [{
        name: name,
        avatar: confirmedAvatar,
        assignedScene: document.querySelector('.scene-text')?.textContent || '',
        imageData: imageData
      }];

      startSlideshow(category, fallbackSlides);  // <-- Changed here to use category instead of "Your Scene"
      return;
    }

    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `Time left: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();

  const playerList = document.getElementById('playerList');
  players.forEach(p => {
    const li = document.createElement('li');
    const avatarSpan = document.createElement('span');
    avatarSpan.textContent = p.avatar || '🐾';
    avatarSpan.style.marginRight = '8px';
    li.appendChild(avatarSpan);
    li.appendChild(document.createTextNode(p.name));
    playerList.appendChild(li);
  });
});

socket.on('start-slideshow', ({ category, slides }) => {
  startSlideshow(category, slides);
});
