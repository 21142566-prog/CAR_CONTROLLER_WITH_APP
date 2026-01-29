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

const controlButtons = ['fwdBtn', 'bckBtn', 'leftBtn', 'rightBtn'];
const ledButtons = ['ledFrontBtn', 'ledBackBtn', 'ledBlinkBtn'];
const speedSliders = ['frontSpeed', 'backSpeed'];

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
  
  if (!navigator.bluetooth) {
    console.error('❌ Web Bluetooth API not available!');
    console.error('⚠️  Make sure you are using Chrome, Edge, or Opera (not Firefox/Safari)');
    console.error('⚠️  Must use HTTPS or http://localhost:xxxx');
    document.getElementById('status').textContent = '❌ Web Bluetooth not supported';
    document.getElementById('connectBtn').disabled = true;
  }
});

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
  const leftJoystick = document.getElementById('leftJoystick');
  const rightJoystick = document.getElementById('rightJoystick');
  
  if (keyPressed.forward || keyPressed.backward) {
    leftJoystick.classList.add('active');
  } else {
    leftJoystick.classList.remove('active');
  }
  
  if (keyPressed.left || keyPressed.right) {
    rightJoystick.classList.add('active');
  } else {
    rightJoystick.classList.remove('active');
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
    
    btn.addEventListener('mousedown', () => {
      keyPressed[key] = true;
      updateCommand();
    });
    btn.addEventListener('mouseup', () => {
      keyPressed[key] = false;
      updateCommand();
    });
    btn.addEventListener('touchstart', () => {
      keyPressed[key] = true;
      updateCommand();
    });
    btn.addEventListener('touchend', () => {
      keyPressed[key] = false;
      updateCommand();
    });
  });
}

async function connect() {
  try {
    console.log('🔍 Scanning for BLE devices with service:', SERVICE_UUID);
    document.getElementById('status').textContent = '🔍 Scanning...';
    
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }]
    });
    console.log('✅ Device found:', device.name);
    
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
    console.log('   Properties:', cmdChar.properties);
    console.log('   - read:', !!cmdChar.properties.read);
    console.log('   - write:', !!cmdChar.properties.write);
    console.log('   - writeWithoutResponse:', !!cmdChar.properties.writeWithoutResponse);
    console.log('   - notify:', !!cmdChar.properties.notify);
    console.log('   - indicate:', !!cmdChar.properties.indicate);
    
    updateUIConnected(true);
    document.getElementById('status').textContent = '✅ Connected';
    setupControlButtons();
    setupLEDButtons();
    console.log('🎉 All connected and ready!');
  } catch (error) {
    console.error('❌ Connection error:', error.name, '-', error.message);
    document.getElementById('status').textContent = '❌ ' + error.message;
  }
}

function onDisconnect() {
  updateUIConnected(false);
  document.getElementById('status').textContent = '❌ Disconnected';
  keyPressed = { forward: false, backward: false, left: false, right: false };
  lastCommand = null;
  stopContinuousSend();
  ledState = { front: false, back: false, blink: false };
  document.getElementById('ledFrontBtn').classList.remove('active');
  document.getElementById('ledBackBtn').classList.remove('active');
  document.getElementById('ledBlinkBtn').classList.remove('active');
}

function updateUIConnected(connected) {
  document.getElementById('connectBtn').disabled = connected;
  controlButtons.forEach(id => document.getElementById(id).disabled = !connected);
  ledButtons.forEach(id => document.getElementById(id).disabled = !connected);
  speedSliders.forEach(id => document.getElementById(id).disabled = !connected);
}

async function send(cmd, value = null) {
  if (!cmdChar) {
    console.warn('No characteristic available to send');
    return;
  }
  let data;
  if (value !== null) {
    data = new Uint8Array([cmd.charCodeAt(0), value]);
  } else {
    data = new Uint8Array([cmd.charCodeAt(0)]);
  }
  try {
    if (cmdChar.properties.writeWithoutResponse) {
      await cmdChar.writeValueWithoutResponse(data);
      console.log('✅ BLE write (no response) ->', cmd, data);
    } else if (cmdChar.properties.write) {
      await cmdChar.writeValue(data);
      console.log('✅ BLE write ->', cmd, data);
    } else {
      console.error('❌ Characteristic does not support write:', cmdChar.properties);
    }
  } catch (err) {
    console.error('❌ BLE write failed:', err.message);
    document.getElementById('status').textContent = '❌ Write failed: ' + err.message;
  }
}

function setFrontSpeed(value) {
  document.getElementById('frontSpeedValue').textContent = value;
  send('S', parseInt(value));
}

function setBackSpeed(value) {
  document.getElementById('backSpeedValue').textContent = value;
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
    } else {
      btn.classList.remove('active');
      send('u');
    }
  } else if (ledType === 'back') {
    ledState.back = !ledState.back;
    const btn = document.getElementById('ledBackBtn');
    if (ledState.back) {
      btn.classList.add('active');
      send('V');
    } else {
      btn.classList.remove('active');
      send('v');
    }
  } else if (ledType === 'blink') {
    ledState.blink = !ledState.blink;
    const btn = document.getElementById('ledBlinkBtn');
    if (ledState.blink) {
      btn.classList.add('active');
      send('W');
    } else {
      btn.classList.remove('active');
      send('w');
    }
  }
}

function setupLEDButtons() {
  document.getElementById('ledFrontBtn').addEventListener('click', () => toggleLED('front'));
  document.getElementById('ledBackBtn').addEventListener('click', () => toggleLED('back'));
  document.getElementById('ledBlinkBtn').addEventListener('click', () => toggleLED('blink'));
}
