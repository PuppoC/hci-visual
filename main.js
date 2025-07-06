// main.js - Ultimate Audio Visualizer
// ...core setup...
let audioCtx, analyser, source, dataArray, bufferLength, animationId;
let mode = 'waveform', color = '#00fff7', sensitivity = 5;
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

function setupAudioNodes(streamOrBuffer) {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  if (source) source.disconnect();
  if (streamOrBuffer instanceof MediaStream) {
    source = audioCtx.createMediaStreamSource(streamOrBuffer);
  } else {
    source = audioCtx.createBufferSource();
    source.buffer = streamOrBuffer;
    source.connect(analyser);
    source.start();
  }
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function drawWaveform() {
  analyser.getByteTimeDomainData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.beginPath();
  let sliceWidth = canvas.width * 1.0 / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    let v = dataArray[i] / 128.0;
    let y = v * canvas.height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

function drawSpectrum() {
  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let barWidth = (canvas.width / bufferLength) * 2.5;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    let barHeight = dataArray[i] * sensitivity;
    ctx.fillStyle = color;
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }
}

// --- Particle Visualizer: Creative & Interactive ---
let particles = [];
let bgHue = 200;
let lastCrash = 0;
let lastBeatTime = 0, beatIntervals = [], tempo = 120;
function initParticles() {
  particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 1.2 + 0.5,
      hue: Math.random() * 360,
      orbit: Math.random() > 0.7,
      angle: Math.random() * Math.PI * 2,
      radius: Math.random() * 40 + 10
    });
  }
}
canvas.addEventListener('pointermove', e => {
  for (let p of particles) {
    let dx = p.x - e.clientX, dy = p.y - e.clientY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 100) {
      p.vx += dx / dist * 0.5;
      p.vy += dy / dist * 0.5;
    }
  }
});
canvas.addEventListener('pointerdown', e => {
  // Paint with sound: spawn new particles at pointer, colored by audio
  for (let i = 0; i < 10; i++) {
    let idx = Math.floor(Math.random() * bufferLength);
    let energy = dataArray ? dataArray[idx] / 255 : 0.5;
    particles.push({
      x: e.clientX,
      y: e.clientY,
      vx: (Math.random() - 0.5) * 6 * (1 + energy),
      vy: (Math.random() - 0.5) * 6 * (1 + energy),
      size: Math.random() * 6 + 2 + energy * 10,
      hue: (color ? parseInt(color.replace('#',''),16)%360 : Math.random()*360) + energy*120,
      radius: Math.random() * 60 + 10
    });
  }
});
function getDominantFrequency() {
  // Returns the frequency bin with the highest energy
  let max = -Infinity, idx = 0;
  for (let i = 0; i < bufferLength; i++) {
    if (dataArray[i] > max) {
      max = dataArray[i];
      idx = i;
    }
  }
  // Frequency in Hz
  let freq = idx * audioCtx.sampleRate / analyser.fftSize;
  return freq;
}

function detectDrumCrash() {
  // Look for sudden spikes in the top 10% of frequency bins
  let highBins = dataArray.slice(Math.floor(bufferLength * 0.85));
  let avgHigh = highBins.reduce((a, b) => a + b, 0) / highBins.length;
  let maxHigh = Math.max(...highBins);
  let now = performance.now();
  if (maxHigh > 220 && avgHigh > 80 && now - lastCrash > 400) {
    lastCrash = now;
    return true;
  }
  return false;
}
function drawParticles() {
  analyser.getByteFrequencyData(dataArray);
  // --- Enhanced Sync: Bass/Energy Detection ---
  let bass = 0, mid = 0, treble = 0;
  for (let i = 0; i < bufferLength; i++) {
    if (i < bufferLength * 0.15) bass += dataArray[i];
    else if (i < bufferLength * 0.5) mid += dataArray[i];
    else treble += dataArray[i];
  }
  bass /= bufferLength * 0.15;
  mid /= bufferLength * 0.35;
  treble /= bufferLength * 0.5;
  let avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

  // --- Pitch/Key detection ---
  let dominantFreq = getDominantFrequency();
  // Map frequency to hue (C4=261Hz, A4=440Hz, C5=523Hz)
  let keyHue = 200 + ((dominantFreq-261)%360);

  // --- Tempo estimation (simple beat detection) ---
  let now = performance.now();
  let beat = bass > 140 || avg > 120;
  if (beat && now - lastBeatTime > 200) {
    if (lastBeatTime > 0) {
      let interval = now - lastBeatTime;
      if (interval > 250 && interval < 2000) beatIntervals.push(interval);
      if (beatIntervals.length > 8) beatIntervals.shift();
      if (beatIntervals.length > 2) {
        let avgInt = beatIntervals.reduce((a,b)=>a+b,0)/beatIntervals.length;
        tempo = Math.round(60000/avgInt);
      }
    }
    lastBeatTime = now;
  }

  // --- Drum crash detection ---
  let drumCrash = detectDrumCrash();

  // --- Dynamic background: smaller, reacts to key/tempo ---
  bgHue = (bgHue + 0.05 + bass/800 + tempo/10000) % 360;
  ctx.globalAlpha = 0.12 + 0.08 * (bass/255);
  let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, `hsl(${keyHue},60%,${7+4*(bass/255)}%)`);
  grad.addColorStop(1, `hsl(${(keyHue+60)%360},60%,${9+4*(treble/255)}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

  // --- Particle/rhythm/dynamics ---
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    let idx = i % bufferLength;
    let energy = dataArray[idx] / 255;
    let bassEnergy = dataArray[Math.floor(idx * 0.2)] / 255;
    let rhythmMod = Math.sin(now/1000 * (tempo/60) + i) * 0.5 + 1;
    if (p.orbit) {
      p.angle += 0.008 + energy * 0.06 + bassEnergy * 0.08 + tempo/10000;
      p.x += Math.cos(p.angle) * p.radius * 0.006 * (1 + bassEnergy) * rhythmMod;
      p.y += Math.sin(p.angle) * p.radius * 0.006 * (1 + bassEnergy) * rhythmMod;
    }
    p.x += p.vx * (0.7 + energy * sensitivity * 0.08 + bassEnergy * 0.18) * rhythmMod;
    p.y += p.vy * (0.7 + energy * sensitivity * 0.08 + bassEnergy * 0.18) * rhythmMod;
    p.vx *= 0.98 - bassEnergy * 0.01; p.vy *= 0.98 - bassEnergy * 0.01;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    // --- Burst on beat, more on bass ---
    if (beat && Math.random() < 0.012 + bass/2000) {
      p.vx += (Math.random() - 0.5) * 4 * (1 + bass/255);
      p.vy += (Math.random() - 0.5) * 4 * (1 + bass/255);
      p.size += 0.5 + bass/400;
      p.hue = (keyHue + 60 + bass/8) % 360;
    }
    // --- Drum crash effect: flash and burst ---
    if (drumCrash && Math.random() < 0.5) {
      p.size += 2;
      p.hue = 60 + Math.random() * 60;
      p.vx += (Math.random() - 0.5) * 8;
      p.vy += (Math.random() - 0.5) * 8;
    }
    // --- Particle size and color sync (smaller, key-based) ---
    p.size = Math.max(0.5, p.size * 0.97 + 1.2 * bassEnergy);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size + energy * 1.2 + bassEnergy * 1.2, 0, 2 * Math.PI);
    ctx.fillStyle = `hsl(${keyHue + energy * 80 + bass/2},100%,${35+15*energy}%)`;
    ctx.globalAlpha = 0.32 + 0.18 * energy + 0.08 * bassEnergy;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // --- Lines pulse with mid/treble (less thick, key-based, less crowded) ---
  ctx.lineWidth = 0.7;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      let p1 = particles[i], p2 = particles[j];
      let dx = p1.x - p2.x, dy = p1.y - p2.y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 18 + 8 * (mid/255)) { // Less crowded
        ctx.strokeStyle = `hsl(${keyHue},100%,60%)`;
        ctx.globalAlpha = 0.06 + 0.06 * (treble/255);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
  // --- Drum crash flash ---
  if (drumCrash) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  // Limit particle count
  if (particles.length > 120) particles.splice(0, particles.length - 120);
}

// --- Animate ---
function animate() {
  if (!analyser) return;
  drawParticles();
  animationId = requestAnimationFrame(animate);
}

// --- UI events ---
document.getElementById('colorPicker').oninput = (e) => {
  color = e.target.value;
  for (let p of particles) p.hue = parseInt(color.replace('#',''),16)%360;
};
document.getElementById('sensitivity').oninput = (e) => {
  sensitivity = e.target.value;
};
document.getElementById('micBtn').onclick = async () => {
  showLoading(true);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  setupAudioNodes(stream);
  showLoading(false);
  animate();
};
document.getElementById('fileInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showLoading(true);
  const arrayBuffer = await file.arrayBuffer();
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
    // Stop previous source if any
    if (source && source.stop) try { source.stop(); } catch(e){}
    setupAudioNodes(buffer);
    showLoading(false);
    animate();
  }, () => { showLoading(false); });
};

// Add a hidden audio element for default audio
const defaultAudio = document.createElement('audio');
defaultAudio.id = 'default-audio';
defaultAudio.src = 'default.mp3'; // Place your default.mp3 in the project root
defaultAudio.crossOrigin = 'anonymous';
defaultAudio.style.display = 'none';
document.body.appendChild(defaultAudio);

// Add a button to play default audio
const playDefaultBtn = document.createElement('button');
playDefaultBtn.textContent = '▶ Play Default Audio';
playDefaultBtn.style.marginLeft = '0.5em';
playDefaultBtn.onclick = async () => {
  showLoading(true);
  if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
  defaultAudio.currentTime = 0;
  defaultAudio.play();
  const stream = defaultAudio.captureStream ? defaultAudio.captureStream() : defaultAudio.mozCaptureStream();
  setupAudioNodes(stream);
  showLoading(false);
  animate();
};
document.getElementById('controls').appendChild(playDefaultBtn);

// --- Loading Indicator ---
const loadingDiv = document.createElement('div');
loadingDiv.id = 'loading-indicator';
loadingDiv.style.position = 'fixed';
loadingDiv.style.top = '0';
loadingDiv.style.left = '0';
loadingDiv.style.width = '100vw';
loadingDiv.style.height = '100vh';
loadingDiv.style.display = 'flex';
loadingDiv.style.alignItems = 'center';
loadingDiv.style.justifyContent = 'center';
loadingDiv.style.background = 'rgba(0,0,0,0.7)';
loadingDiv.style.color = '#00fff7';
loadingDiv.style.fontSize = '2em';
loadingDiv.style.zIndex = '1000';
loadingDiv.style.display = 'none';
loadingDiv.innerHTML = 'Loading audio...';
document.body.appendChild(loadingDiv);
function showLoading(show) {
  loadingDiv.style.display = show ? 'flex' : 'none';
}

// Only particles mode
initParticles();

// --- UI: Hide/Show Top Bar ---
const ui = document.getElementById('ui');
const hideBtn = document.createElement('button');
hideBtn.id = 'hide-ui-btn';
hideBtn.innerHTML = '⤢';
hideBtn.title = 'Hide/show controls';
hideBtn.style.marginLeft = 'auto';
hideBtn.style.fontSize = '1.3em';
hideBtn.style.background = 'rgba(0,0,0,0.2)';
hideBtn.style.border = 'none';
hideBtn.style.color = '#00fff7';
hideBtn.style.cursor = 'pointer';
hideBtn.style.borderRadius = '5px';
hideBtn.style.padding = '0.2em 0.7em';
hideBtn.style.transition = 'background 0.2s';
hideBtn.onmouseenter = () => hideBtn.style.background = '#00fff7';
hideBtn.onmouseleave = () => hideBtn.style.background = 'rgba(0,0,0,0.2)';
ui.querySelector('#controls').appendChild(hideBtn);
hideBtn.onclick = () => {
  if (ui.style.top === '-100px') {
    ui.style.top = '0';
    hideBtn.innerHTML = '⤢';
  } else {
    ui.style.top = '-100px';
    hideBtn.innerHTML = '⤡';
  }
};
ui.style.transition = 'top 0.4s cubic-bezier(.7,0,.3,1)';
ui.style.top = '0';

// Update the UI header to be more futuristic and rename
const uiHeader = document.querySelector('#ui h1');
if (uiHeader) {
  uiHeader.textContent = '';
  uiHeader.innerHTML = `<span style="font-family: 'Orbitron', 'Segoe UI', Arial, sans-serif; font-size:1.5em; letter-spacing:0.12em; color:#00fff7; text-shadow:0 0 12px #00fff7, 0 0 32px #0ffb;">HCI <span style='color:#fff;'>Audio Visual</span></span>`;
}

// ...more advanced features coming next...
