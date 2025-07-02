// Socket connection
const socket = io();

let currentRoomCode = null;

// Generate or retrieve a persistent device ID
function generateDeviceId() {
  return 'dev-' + Math.random().toString(36).substr(2, 9);
}

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = generateDeviceId();
  localStorage.setItem('deviceId', deviceId);
}

// Load confirmed avatar or default
let confirmedAvatar = localStorage.getItem('selectedAvatar') || '🐾';

// Confirm avatar function with user prompt
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

// On DOM ready, display confirmed avatar
document.addEventListener('DOMContentLoaded', () => {
  const avatarDisplay = document.getElementById('selectedAvatarDisplay');
  if (avatarDisplay) avatarDisplay.textContent = confirmedAvatar;
});

// Join a room with name, room code, and avatar
function joinRoom() {
  const name = document.getElementById('name').value.trim();
  const room = document.getElementById('room').value.trim().toUpperCase();
  if (!name || !room) return alert('Please enter your name and room code!');
  currentRoomCode = room;
  const selectedAvatar = localStorage.getItem('selectedAvatar') || '🐾';
  socket.emit('join-room', { roomCode: room, name, deviceId, avatar: selectedAvatar });
}

// Create a new room with 4-char alphanumeric code
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

// Update player list UI with avatars
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

// Manual game start validation for min 3 players
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

// Error event alerts
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

// Slideshow function — shows slides one by one with drawing animation & narration
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

  // Show slides sequentially with narration, then end screen + voting
  function showSlide(i) {
    if (i === slides.length) {
      // Show "The End" for 2 seconds
      titleEl.textContent = '🎉 The End!';
      authorEl.textContent = '';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      [...playerList.children].forEach(li => li.classList.remove('hover-highlight'));

      setTimeout(() => {
        showVotingPage(category, slides);
      }, 2000);
      return;
    }

    // Show current slide
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

// Voting page with grid of drawings to vote on
function showVotingPage(category, slides) {
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: 'Montserrat', sans-serif; background: #001f3f; color: #00f2fe; min-height: 100vh; display: flex; flex-direction: column; align-items: center;">
      <h1 style="margin-bottom: 5px;">🎨 Vote for the Best Drawing</h1>
      <p style="margin-top: 0; margin-bottom: 20px;">Hover and click to vote. Only one vote allowed. Can't vote for yourself.</p>
      <div id="voteGrid" style="display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 15px; width: 100%; max-width: 960px;"></div>
      <div id="voteResults" style="margin-top: 20px; max-height: 150px; overflow-y: auto; border-top: 1px solid #004466; padding-top: 10px; width: 100%; max-width: 960px;"></div>
      <p id="voteTimer" style="font-weight: bold; font-size: 1.2em; margin-top: 20px;"></p>
      <button id="backToMenuBtn" style="margin-top: 25px; padding: 12px 24px; font-size: 1rem; border: none; border-radius: 8px; background: #00f2fe; color: #000; cursor: pointer; font-weight: bold; display: none;">⬅ Back to Menu</button>
    </div>
  `;

  const voteGrid = document.getElementById('voteGrid');
  const voteResults = document.getElementById('voteResults');
  const voteTimer = document.getElementById('voteTimer');
  const backToMenuBtn = document.getElementById('backToMenuBtn');

  const votes = {};      // voterName -> votedForName
  const voteCounts = {}; // votedForName -> count

  // Current player name (try get from input or prompt)
  const currentPlayerName = document.getElementById('name')?.value.trim() || prompt('Enter your player name for voting:');

  // Create voting cards
  slides.forEach(slide => {
    voteCounts[slide.name] = 0;

    const card = document.createElement('div');
    card.style.border = '3px solid transparent';
    card.style.borderRadius = '10px';
    card.style.cursor = 'pointer';
    card.style.transition = 'border-color 0.3s ease, transform 0.3s ease';
    card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    card.style.textAlign = 'center';
    card.title = slide.name;

    const img = new Image();
    img.src = slide.imageData || '';
    img.alt = `Drawing by ${slide.name}`;
    img.style.width = '200px';
    img.style.height = '140px';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '8px';
    card.appendChild(img);

    const label = document.createElement('p');
    label.textContent = `${slide.avatar || '🐾'} ${slide.name}`;
    label.style.marginTop = '6px';
    label.style.fontWeight = '600';
    card.appendChild(label);

    card.addEventListener('click', () => {
      if (currentPlayerName === slide.name) {
        alert("You can't vote for yourself!");
        return;
      }
      votes[currentPlayerName] = slide.name;
      updateVotes();
      highlightSelected();
    });

    voteGrid.appendChild(card);
  });

  function highlightSelected() {
    [...voteGrid.children].forEach(card => {
      const name = card.title;
      if (votes[currentPlayerName] === name) {
        card.style.borderColor = '#00f2fe';
        card.style.transform = 'scale(1.05)';
        card.style.boxShadow = '0 0 12px #00f2fe';
      } else {
        card.style.borderColor = 'transparent';
        card.style.transform = 'scale(1)';
        card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      }
    });
  }

  function updateVotes() {
    // Reset counts
    Object.keys(voteCounts).forEach(name => voteCounts[name] = 0);
    Object.values(votes).forEach(votedName => {
      if (voteCounts[votedName] !== undefined) voteCounts[votedName]++;
    });

    // Show who voted for whom
    voteResults.innerHTML = '<strong>Votes:</strong><br>';
    Object.entries(votes).forEach(([voter, voted]) => {
      voteResults.innerHTML += `<div>${voter} voted for <strong>${voted}</strong></div>`;
    });
  }

  let voteTimeLeft = 10; // seconds
  voteTimer.textContent = `Time left to vote: ${voteTimeLeft}s`;

  const voteInterval = setInterval(() => {
    voteTimeLeft--;
    voteTimer.textContent = `Time left to vote: ${voteTimeLeft}s`;
    if (voteTimeLeft <= 0) {
      clearInterval(voteInterval);
      voteTimer.textContent = 'Voting ended!';

      finalizeVoting();
    }
  }, 1000);

  highlightSelected();

  function finalizeVoting() {
    // Disable voting
    [...voteGrid.children].forEach(card => card.style.cursor = 'default');

    // Highlight winners
    const maxVotes = Math.max(...Object.values(voteCounts));
    [...voteGrid.children].forEach(card => {
      const name = card.title;
      if (voteCounts[name] === maxVotes && maxVotes > 0) {
        card.style.borderColor = '#ffd700'; // gold border
        card.style.boxShadow = '0 0 15px 4px #ffd700';
        card.style.transform = 'scale(1.1)';
      } else {
        card.style.opacity = '0.4';
      }
    });

    backToMenuBtn.style.display = 'inline-block';
  }

  backToMenuBtn.addEventListener('click', () => {
    location.reload();
  });
}

// When game starts, build drawing interface with controls ABOVE the timer
socket.on('start-game', ({ category, players }) => {
  const name = document.getElementById('name').value.trim();
  const me = players.find(p => p.name === name);
  if (!me) return alert('Player data not found.');
  currentRoomCode = currentRoomCode || document.getElementById('room').value.trim().toUpperCase();

  document.body.innerHTML = `
    <div class="header-bar"><h1>Scenez</h1></div>
    <div class="game-container" style="display:flex; height:100vh; background:#011627; color:#00f2fe; font-family: 'Montserrat', sans-serif;">
      <div class="players-sidebar" style="width: 220px; border-right: 2px solid #004466; padding: 10px; overflow-y: auto;">
        <h3>Players</h3><ul id="playerList" style="list-style:none; padding: 0; margin: 0;"></ul>
      </div>
      <div class="canvas-area" style="flex-grow: 1; padding: 10px; display:flex; flex-direction: column; align-items: center;">
        <div class="controls" style="margin-bottom: 10px; display: flex; gap: 10px; align-items: center;">
          <label style="color:#00f2fe;">Color: <input type="color" id="colorPicker" value="#000000"></label>
          <label style="color:#00f2fe;">Brush Size: <input type="range" id="brushSize" min="1" max="20" value="3"></label>
          <button id="clearBtn" style="background:#00f2fe; color:#000; border:none; padding: 6px 12px; border-radius: 6px; cursor:pointer;">Clear</button>
        </div>
        <p id="timer" style="font-weight: bold; font-size: 1.3em; margin-bottom: 10px;">Time left: 1:30</p>
        <canvas id="drawCanvas" width="900" height="600" style="background:#022c43; border-radius: 10px; box-shadow: 0 0 15px #00f2fe;"></canvas>
      </div>
     <div class="info-sidebar" style="width: 220px; border-left: 2px solid #004466; padding: 10px;">
  <h3>Category</h3>
  <p id="categoryName">${category}</p>
  <h3>Scene</h3>
  <p id="sceneName">${me.assignedScene || 'No scene assigned'}</p>
</div>

  `;

  // Show players in sidebar
  const playerList = document.getElementById('playerList');
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    const avatarSpan = document.createElement('span');
    avatarSpan.textContent = p.avatar || '🐾';
    avatarSpan.style.marginRight = '8px';
    li.prepend(avatarSpan);
    playerList.appendChild(li);
  });

  // Drawing canvas setup
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Settings
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let brushColor = document.getElementById('colorPicker').value;
  let brushSize = parseInt(document.getElementById('brushSize').value, 10);

  // Event listeners
  function startDraw(e) {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }
  function draw(e) {
    if (!drawing) return;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }
  function endDraw() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseout', endDraw);

  // Controls
  document.getElementById('colorPicker').addEventListener('change', e => {
    brushColor = e.target.value;
  });
  document.getElementById('brushSize').addEventListener('input', e => {
    brushSize = parseInt(e.target.value, 10);
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Timer and auto-submit on zero
  const timerEl = document.getElementById('timer');
  let timeLeft = 90; // 1.5 min drawing time
  timerEl.style.display = 'block';

  const timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = 'Time is up! Submitting drawing...';
      submitDrawing();
    } else {
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      timerEl.textContent = `Time left: ${mins}:${secs.toString().padStart(2, '0')}`;
      timeLeft--;
    }
  }, 1000);

  // Submit drawing to server
  function submitDrawing() {
    // Disable drawing controls
    canvas.removeEventListener('mousedown', startDraw);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', endDraw);
    canvas.removeEventListener('mouseout', endDraw);
    document.getElementById('colorPicker').disabled = true;
    document.getElementById('brushSize').disabled = true;
    document.getElementById('clearBtn').disabled = true;
    timerEl.style.display = 'none';

    // Get image data as PNG base64
    const imageData = canvas.toDataURL('image/png');

    socket.emit('drawing-submitted', {
      roomCode: currentRoomCode,
      deviceId,
      imageData,
    });
  }
});

// Slideshow start event
socket.on('start-slideshow', ({ category, slides }) => {
  startSlideshow(category, slides);
});

// Confirm avatar selection button click
document.getElementById('confirmAvatarBtn')?.addEventListener('click', () => {
  const selected = document.querySelector('input[name="avatar"]:checked');
  if (!selected) return alert('Please select an avatar!');
  const avatar = selected.value;
  if (confirmAvatar(avatar)) {
    alert(`Avatar ${avatar} confirmed!`);
  }
});

// Ready button triggers joinRoom
document.getElementById('readyBtn')?.addEventListener('click', joinRoom);

// Create room button triggers createRoom
document.getElementById('createRoomBtn')?.addEventListener('click', createRoom);

// Start game manual button
document.getElementById('startManualBtn')?.addEventListener('click', startManualGame);
