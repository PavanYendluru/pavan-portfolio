/**
 * Han Nguyen Portfolio — Smooth Scroll & Frame Animation Engine
 * Synchronizes 240 Full HD video frames with whole-page scroll progression.
 */

const FRAME_COUNT = 240;
const INITIAL_BUFFER_THRESHOLD = 1; // Instant unlock: show portfolio immediately!

// DOM Elements
const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const preloader = document.getElementById('preloader');
const loadPercentage = document.getElementById('load-percentage');
const progressBar = document.getElementById('progress-bar');
const scrubFill = document.getElementById('scrub-fill');
const topNav = document.getElementById('top-nav');

// State
const images = new Array(FRAME_COUNT);
let loadedCount = 0;
let isUnlocked = false;
let currentFrame = 0;
let targetFrame = 0;
let lastDrawnFrame = -1;
let lastScrollY = 0;

// Path helper (frames/frame_000000.png ... frames/frame_000239.png)
function getFramePath(index) {
  const padded = String(index).padStart(6, '0');
  return `frames/frame_${padded}.png`;
}

// Adjust canvas resolution for Retina and screen size
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);

  // Redraw current frame with new dimensions immediately
  drawFrame(Math.round(currentFrame), true);
}

// Draw frame: pushed backwards with breathing room for clear face visibility
function drawFrame(frameIndex, forceRedraw = false) {
  if (frameIndex === lastDrawnFrame && !forceRedraw) return;

  const img = getLoadedImage(frameIndex);
  if (!img) return;

  const cWidth = canvas.width;
  const cHeight = canvas.height;
  const imgW = img.naturalWidth || 1920;
  const imgH = img.naturalHeight || 1080;

  // Solid yellow fill matching the frames' background (#FDC810)
  ctx.fillStyle = '#FDC810';
  ctx.fillRect(0, 0, cWidth, cHeight);

  // Scaled containment with breathing room & header clearance
  const headerOffset = Math.round(cHeight * 0.09); // Space for sticky top navigation
  const availableH = cHeight - headerOffset;
  const fitScale = Math.min(cWidth / imgW, availableH / imgH);
  // Scale factor 0.77 keeps the character proportional and pushed back
  const scale = fitScale * 0.77;
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  // Centered horizontally
  const offsetX = (cWidth - drawW) / 2;
  // Positioned comfortably down below the header so the hair is 100% visible on first load
  const offsetY = headerOffset + Math.max(30, (availableH - drawH) * 0.52);

  // Draw image
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  lastDrawnFrame = frameIndex;
}

// Smart fallback: returns the target frame, or the nearest available loaded frame
function getLoadedImage(index) {
  if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
    return images[index];
  }
  // Find nearest loaded frame to eliminate any blank flashes
  for (let offset = 1; offset < FRAME_COUNT; offset++) {
    const prev = index - offset;
    if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
      return images[prev];
    }
    const next = index + offset;
    if (next < FRAME_COUNT && images[next] && images[next].complete && images[next].naturalWidth > 0) {
      return images[next];
    }
  }
  return null;
}

// Instant unlock function
function unlockExperience() {
  if (isUnlocked) return;
  isUnlocked = true;
  if (preloader) {
    preloader.classList.add('loaded');
  }
  updateScrollProgress();
}

// Preloader routine with progressive concurrent downloading
function preloadFrames() {
  // Safety timeout: Never hold user back, show portfolio immediately within 250ms
  setTimeout(unlockExperience, 250);

  // Load Frame 0 first with highest priority
  const firstImg = new Image();
  firstImg.src = getFramePath(0);
  images[0] = firstImg;
  firstImg.onload = () => {
    loadedCount++;
    updateProgress();
    drawFrame(0, true);
    unlockExperience();
    loadRemainingFrames();
  };
  firstImg.onerror = () => {
    unlockExperience();
    loadRemainingFrames();
  };
}

function loadRemainingFrames() {
  const queue = [];
  for (let i = 1; i < FRAME_COUNT; i++) {
    queue.push(i);
  }

  // Preload in batches of 16 concurrent requests for maximum HTTP/2 throughput
  const CONCURRENT_DOWNLOADS = 16;
  let activeDownloads = 0;

  function loadNext() {
    while (activeDownloads < CONCURRENT_DOWNLOADS && queue.length > 0) {
      const idx = queue.shift();
      activeDownloads++;

      const img = new Image();
      img.src = getFramePath(idx);
      images[idx] = img;

      img.onload = () => {
        loadedCount++;
        activeDownloads--;
        updateProgress();
        loadNext();
      };

      img.onerror = () => {
        activeDownloads--;
        loadNext();
      };
    }
  }

  loadNext();
}

function updateProgress() {
  const percentage = Math.min(100, Math.floor((loadedCount / FRAME_COUNT) * 100));
  if (loadPercentage) loadPercentage.textContent = percentage;
  if (progressBar) progressBar.style.width = `${percentage}%`;

  // Instant unlock as soon as first frame is ready
  if (!isUnlocked && loadedCount >= 1) {
    unlockExperience();
  }
}

// Map scroll position to target frame (3x faster motion speed)
function updateScrollProgress() {
  const scrollY = window.scrollY || window.pageYOffset;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

  // 3x faster frame advancement
  const SPEED_MULTIPLIER = 3.0;
  targetFrame = Math.min(FRAME_COUNT - 1, progress * (FRAME_COUNT - 1) * SPEED_MULTIPLIER);

  // Bottom scrub bar
  if (scrubFill) {
    scrubFill.style.width = `${Math.min(100, progress * 100 * SPEED_MULTIPLIER).toFixed(2)}%`;
  }

  // Sticky nav subtle elevation on scroll
  if (topNav) {
    if (scrollY > 50) {
      topNav.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)';
    } else {
      topNav.style.boxShadow = 'none';
    }
  }

  lastScrollY = scrollY;
}

// Kinetic inertial smoothing loop (3x snappier Lerp)
function animationLoop() {
  const diff = targetFrame - currentFrame;

  // Snappier 3x damping factor: 0.27 (0.09 * 3) for instant, fluid 3x motion
  if (Math.abs(diff) > 0.001) {
    currentFrame += diff * 0.27;
    const frameIndex = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(currentFrame)));
    drawFrame(frameIndex);
  }

  requestAnimationFrame(animationLoop);
}

// Smooth anchor scrolling handler
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href').slice(1);
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      e.preventDefault();
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Event Listeners
window.addEventListener('resize', resizeCanvas, { passive: true });
window.addEventListener('scroll', updateScrollProgress, { passive: true });

// Initial boot
resizeCanvas();
preloadFrames();
requestAnimationFrame(animationLoop);
