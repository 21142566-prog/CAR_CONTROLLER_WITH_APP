// ============================================
// LOGIN SYSTEM
// ============================================

// Tài khoản mặc định (có thể thay đổi theo nhu cầu)
const DEFAULT_USERS = [
  { username: 'admin', password: '12345' },
  { username: 'gunnnz', password: 'car123' }
];

// Kiểm tra xem người dùng đã đăng nhập hay chưa
function isUserLoggedIn() {
  const loginToken = localStorage.getItem('loginToken');
  const tokenExpiry = localStorage.getItem('tokenExpiry');
  
  if (!loginToken || !tokenExpiry) {
    return false;
  }
  
  // Kiểm tra xem token có hết hạn không (24 giờ)
  const now = new Date().getTime();
  if (now > parseInt(tokenExpiry)) {
    localStorage.removeItem('loginToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('loggedInUser');
    return false;
  }
  
  return true;
}

// Xử lý đăng nhập
function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  
  // Kiểm tra thông tin đăng nhập
  const user = DEFAULT_USERS.find(u => u.username === username && u.password === password);
  
  if (!user) {
    errorDiv.textContent = '❌ Tên đăng nhập hoặc mật khẩu không chính xác!';
    document.getElementById('password').value = '';
    return;
  }
  
  // Tạo token và lưu vào localStorage
  const token = generateToken();
  const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 giờ
  
  localStorage.setItem('loginToken', token);
  localStorage.setItem('tokenExpiry', expiryTime);
  localStorage.setItem('loggedInUser', username);
  
  console.log('✅ Đăng nhập thành công:', username);
  errorDiv.textContent = '';
  
  // Ẩn modal đăng nhập và hiển thị giao diện chính
  showMainInterface();
}

// Xử lý đăng xuất
function handleLogout(event) {
  event.preventDefault();
  
  // Ngắt kết nối BLE nếu đang kết nối
  if (device && device.gatt && device.gatt.connected) {
    manualDisconnect();
  }
  
  // Xóa token
  localStorage.removeItem('loginToken');
  localStorage.removeItem('tokenExpiry');
  localStorage.removeItem('loggedInUser');
  
  console.log('✅ Đã đăng xuất');
  
  // Hiển thị lại modal đăng nhập
  showLoginInterface();
}

// Tạo token (đơn giản)
function generateToken() {
  return Math.random().toString(36).substr(2) + Date.now().toString(36);
}

// Hiển thị giao diện đăng nhập
function showLoginInterface() {
  const loginModal = document.getElementById('loginModal');
  const appContainer = document.getElementById('appContainer');
  
  loginModal.classList.remove('hidden');
  appContainer.style.display = 'none';
  
  // Clear form
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').textContent = '';
  document.getElementById('username').focus();
}

// Hiển thị giao diện chính
function showMainInterface() {
  const loginModal = document.getElementById('loginModal');
  const appContainer = document.getElementById('appContainer');
  
  loginModal.classList.add('hidden');
  appContainer.style.display = 'flex';
  
  // Đảm bảo logout button có event listener
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    // Remove old listeners if any
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    
    // Add new listener
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  }
}

// BLE Configuration
let device, server, service, cmdChar;
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHAR_UUID = "abcdefab-1234-1234-1234-abcdefabcdef";

// Trạng thái các phím đang nhấn
let keyPressed = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

let lastCommand = null;
let sendInterval = null;
let heartbeatInterval = null;

// Command queue to prevent GATT conflicts
let commandQueue = [];
let isProcessingQueue = false;

const controlButtons = ['fwdBtn', 'bckBtn', 'leftBtn', 'rightBtn'];
const ledButtons = ['ledFrontBtn', 'ledBackBtn', 'ledBlinkBtn'];

// Trạng thái LED
let ledState = {
  front: false,
  back: false,
  blink: false
};

// Check Web Bluetooth support on page load
window.addEventListener('DOMContentLoaded', () => {
  console.log('=== BLE Compatibility Check ===');
  console.log('Browser User Agent:', navigator.userAgent);
  console.log('Web Bluetooth API available?', !!navigator.bluetooth);
  console.log('Secure context (HTTPS/localhost)?', window.isSecureContext);
  console.log('Current URL:', window.location.href);

  // 🔐 Kiểm tra đăng nhập
  console.log('🔐 Kiểm tra trạng thái đăng nhập...');
  if (isUserLoggedIn()) {
    console.log('✅ Người dùng đã đăng nhập:', localStorage.getItem('loggedInUser'));
    showMainInterface();
  } else {
    console.log('🔒 Người dùng chưa đăng nhập, hiển thị modal đăng nhập');
    showLoginInterface();
    
    // Thêm event listener cho form đăng nhập
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          handleLogin(event);
        }
      });
    }
  }
  
  if (!navigator.bluetooth) {
    console.error('❌ Web Bluetooth API not available!');
    console.error('⚠️  Make sure you are using Chrome, Edge, or Opera (not Firefox/Safari)');
    console.error('⚠️  Must use HTTPS or http://localhost:xxxx');
    document.getElementById('status').textContent = 'Web Bluetooth not supported';
    document.getElementById('connectBtn').disabled = true;
  }
  
  // Start clock
  updateClock();
  setInterval(updateClock, 1000);
});

// Handle page unload/navigation - End session before leaving
window.addEventListener('beforeunload', (event) => {
  if (device && device.gatt && device.gatt.connected) {
    console.log('⚠️ Page unloading while connected - ending session');
    
    // End Firebase session immediately (synchronous)
    if (window.currentSession && typeof endSession === 'function') {
      const endTime = new Date();
      const duration = Math.floor((endTime - window.sessionStartTime) / 1000);
      
      // Update session synchronously
      db.collection('sessions').doc(window.currentSession).update({
        endTime: firebase.firestore.FieldValue.serverTimestamp(),
        duration: duration,
        status: 'disconnected'
      }).catch(err => console.error('Error updating session:', err));
      
      window.currentSession = null;
      window.sessionStartTime = null;
    }
    
    // Disconnect BLE
    try {
      device.gatt.disconnect();
    } catch (err) {
      console.error('Error disconnecting BLE:', err);
    }
  }
});

// Handle visibility change (tab switch, minimize)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && device && device.gatt && device.gatt.connected) {
    console.log('⚠️ Page hidden while connected - may lose connection');
    // Note: BLE will automatically disconnect after ~30 seconds of inactivity
  }
});

// Update clock display
function updateClock() {
  const now = new Date();
  
  // Time
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
  
  // Date
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  document.getElementById('date').textContent = `${day}/${month}/${year}`;
}

// Reset all UI and states
function resetAllStates() {
  console.log('🔄 Resetting all UI states...');
  
  // Reset key states
  keyPressed = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
  
  lastCommand = null;
  stopContinuousSend();
  stopHeartbeat();
  
  // Reset LED states
  ledState = {
    front: false,
    back: false,
    blink: false
  };
  
  // Update LED button visuals
  document.getElementById('ledFrontBtn').classList.remove('active');
  document.getElementById('ledBackBtn').classList.remove('active');
  document.getElementById('ledBlinkBtn').classList.remove('active');
  
  // Reset speed slider
  document.getElementById('speedSlider').value = 200;
  document.getElementById('speedValue').textContent = '200';
  
  // Reset joystick visuals
  updateJoystickVisuals();
  
  console.log('✅ All states reset');
}

// Send command continuously every 100ms while holding button
function startContinuousSend() {
  if (sendInterval) clearInterval(sendInterval);
  sendInterval = setInterval(() => {
    const newCommand = getCommandFromKeyState();
    if (newCommand !== null && newCommand === lastCommand) {
      send(newCommand);
    }
  }, 100);
}

function stopContinuousSend() {
  if (sendInterval) {
    clearInterval(sendInterval);
    sendInterval = null;
  }
}

// Heartbeat to keep connection alive
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (!sendInterval && cmdChar && device && device.gatt.connected) {
      send('X');
    }
  }, 3000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Mapping tổ hợp phím thành lệnh
function getCommandFromKeyState() {
  const { forward, backward, left, right } = keyPressed;
  
  if (forward && !backward && !left && !right) return 'F';
  if (backward && !forward && !left && !right) return 'B';
  if (left && !right && !forward && !backward) return 'L';
  if (right && !left && !forward && !backward) return 'R';
  
  if (forward && left && !backward && !right) return 'G';
  if (forward && right && !backward && !left) return 'H';
  if (backward && left && !forward && !right) return 'I';
  if (backward && right && !forward && !left) return 'J';
  
  return null;
}

// Cập nhật lệnh dựa trên trạng thái phím
function updateCommand() {
  const newCommand = getCommandFromKeyState();
  
  if (newCommand === null) {
    if (lastCommand !== null && lastCommand !== 'X') {
      send('X');
      lastCommand = 'X';
    }
    stopContinuousSend();
  } else if (newCommand !== lastCommand) {
    send(newCommand);
    lastCommand = newCommand;
    startContinuousSend();
  }
  
  updateJoystickVisuals();
}

// Cập nhật hiển thị joystick
function updateJoystickVisuals() {
  const joysticks = document.querySelectorAll('.joystick');
  
  if (keyPressed.forward || keyPressed.backward) {
    joysticks[0]?.classList.add('active');
  } else {
    joysticks[0]?.classList.remove('active');
  }
  
  if (keyPressed.left || keyPressed.right) {
    joysticks[1]?.classList.add('active');
  } else {
    joysticks[1]?.classList.remove('active');
  }
}

// Setup sự kiện cho các nút điều khiển
function setupControlButtons() {
  const buttons = {
    'fwdBtn': 'forward',
    'bckBtn': 'backward',
    'leftBtn': 'left',
    'rightBtn': 'right'
  };

  Object.entries(buttons).forEach(([btnId, key]) => {
    const btn = document.getElementById(btnId);
    
    // Remove old listeners if any
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    const finalBtn = document.getElementById(btnId);
    
    finalBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      keyPressed[key] = true;
      finalBtn.classList.add('active');
      updateCommand();
    });
    finalBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      keyPressed[key] = false;
      finalBtn.classList.remove('active');
      updateCommand();
    });
    finalBtn.addEventListener('mouseleave', (e) => {
      keyPressed[key] = false;
      finalBtn.classList.remove('active');
      updateCommand();
    });
    finalBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keyPressed[key] = true;
      finalBtn.classList.add('active');
      updateCommand();
    });
    finalBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      keyPressed[key] = false;
      finalBtn.classList.remove('active');
      updateCommand();
    });
    finalBtn.addEventListener('touchcancel', (e) => {
      keyPressed[key] = false;
      finalBtn.classList.remove('active');
      updateCommand();
    });
  });
}

// helper that toggles between connect and disconnect
function toggleConnection() {
  if (device && device.gatt.connected) {
    manualDisconnect();
  } else {
    connect();
  }
}

async function connect() {
  try {
    // Disconnect if already connected
    if (device && device.gatt.connected) {
      console.log('⚠️ Already connected, disconnecting first...');
      await device.gatt.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('🔍 Scanning for BLE devices with service:', SERVICE_UUID);
    document.getElementById('status').textContent = 'Scanning...';
    
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID]
    });
    console.log('✅ Device found:', device.name);
    
    // Add disconnect listener
    device.addEventListener('gattserverdisconnected', onDisconnect);
    
    console.log('📡 Connecting to GATT server...');
    server = await device.gatt.connect();
    console.log('✅ GATT server connected');
    
    console.log('🔍 Getting primary service:', SERVICE_UUID);
    service = await server.getPrimaryService(SERVICE_UUID);
    console.log('✅ Service found');
    
    console.log('🔍 Getting characteristic:', CHAR_UUID);
    cmdChar = await service.getCharacteristic(CHAR_UUID);
    console.log('✅ Characteristic found');
    
    // Reset all states on new connection
    resetAllStates();
    
    // Send initial stop command
    await send('X');
    
    updateUIConnected(true);
    document.getElementById('status').textContent = 'Connected to ' + device.name;
    setupControlButtons();
    setupLEDButtons();
    
    // Start heartbeat
    startHeartbeat();
    console.log('💓 Heartbeat started');
    
    // ⭐ Start Firebase session tracking
    if (typeof startSession === 'function') {
      await startSession();
    }
    
    console.log('🎉 All connected and ready!');
  } catch (error) {
    console.error('❌ Connection error:', error.name, '-', error.message);
    document.getElementById('status').textContent = error.message;
    updateUIConnected(false);
  }
}

function onDisconnect() {
  console.log('⚠️ Device disconnected');
  
  // Clear command queue
  commandQueue = [];
  isProcessingQueue = false;
  
  // ⭐ End Firebase session tracking
  if (typeof endSession === 'function') {
    endSession();
  }
  
  updateUIConnected(false);
  document.getElementById('status').textContent = 'Disconnected - Click BLE button to reconnect';
  resetAllStates();
  
  // Clean up
  cmdChar = null;
  service = null;
  server = null;
}

function updateUIConnected(connected) {
  const connBtn = document.getElementById('connectBtn');
  // toggle color classes instead of disabling
  connBtn.classList.toggle('connected', connected);
  connBtn.classList.toggle('disconnected', !connected);
  // when connected the button still clickable to disconnect

  controlButtons.forEach(id => document.getElementById(id).disabled = !connected);
  ledButtons.forEach(id => document.getElementById(id).disabled = !connected);
  document.getElementById('speedSlider').disabled = !connected;
}

// Manual disconnect function
async function manualDisconnect() {
  if (!device || !device.gatt.connected) {
    console.warn('⚠️ No active connection to disconnect');
    return;
  }
  
  try {
    console.log('🔌 Manual disconnect requested');
    
    // End Firebase session first
    if (typeof endSession === 'function') {
      await endSession();
    }
    
    // Disconnect BLE
    device.gatt.disconnect();
    
    // onDisconnect will be called automatically
    console.log('✅ Disconnected successfully');
    
  } catch (error) {
    console.error('❌ Error during disconnect:', error);
    // Force cleanup
    onDisconnect();
  }
}

async function send(cmd, value = null) {
  if (!cmdChar) {
    console.warn('⚠️ No characteristic available to send');
    return;
  }
  
  if (!device || !device.gatt.connected) {
    console.warn('⚠️ Device not connected');
    return;
  }
  
  // Add to queue
  commandQueue.push({ cmd, value });
  
  // Process queue if not already processing
  if (!isProcessingQueue) {
    processCommandQueue();
  }
}

async function processCommandQueue() {
  if (commandQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }
  
  isProcessingQueue = true;
  const { cmd, value } = commandQueue.shift();
  
  let data;
  if (value !== null) {
    data = new Uint8Array([cmd.charCodeAt(0), value]);
  } else {
    data = new Uint8Array([cmd.charCodeAt(0)]);
  }
  
  try {
    await cmdChar.writeValue(data);
    // console.log('✅ BLE write ->', cmd, value !== null ? `[${cmd}, ${value}]` : cmd);
  } catch (err) {
    console.error('❌ BLE write failed:', err.message);
    if (err.message.includes('GATT Server is disconnected')) {
      onDisconnect();
      commandQueue = []; // Clear queue on disconnect
      isProcessingQueue = false;
      return;
    }
  }
  
  // Small delay between commands to prevent conflicts
  await new Promise(resolve => setTimeout(resolve, 20));
  
  // Process next command
  processCommandQueue();
}

// Single speed control for both motors
function setSpeed(value) {
  document.getElementById('speedValue').textContent = value;
  // Gửi speed cho cả 2 motors
  send('S', parseInt(value));
  send('T', parseInt(value));
}

// LED Toggle Functions
function toggleLED(ledType) {
  if (!cmdChar) return;
  
  if (ledType === 'front') {
    ledState.front = !ledState.front;
    const btn = document.getElementById('ledFrontBtn');
    if (ledState.front) {
      btn.classList.add('active');
      send('U');
      console.log('💡 LED Front ON');
    } else {
      btn.classList.remove('active');
      send('u');
      console.log('💡 LED Front OFF');
    }
  } else if (ledType === 'back') {
    ledState.back = !ledState.back;
    const btn = document.getElementById('ledBackBtn');
    if (ledState.back) {
      btn.classList.add('active');
      send('V');
      console.log('💡 LED Back ON');
    } else {
      btn.classList.remove('active');
      send('v');
      console.log('💡 LED Back OFF');
    }
  } else if (ledType === 'blink') {
    ledState.blink = !ledState.blink;
    const btn = document.getElementById('ledBlinkBtn');
    if (ledState.blink) {
      btn.classList.add('active');
      send('W');
      console.log('💡 LED Blink START');
    } else {
      btn.classList.remove('active');
      send('w');
      console.log('💡 LED Blink STOP');
    }
  }
}

function setupLEDButtons() {
  // Remove old listeners
  ['ledFrontBtn', 'ledBackBtn', 'ledBlinkBtn'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });
  
  // Add new listeners
  document.getElementById('ledFrontBtn').addEventListener('click', () => toggleLED('front'));
  document.getElementById('ledBackBtn').addEventListener('click', () => toggleLED('back'));
  document.getElementById('ledBlinkBtn').addEventListener('click', () => toggleLED('blink'));
}
