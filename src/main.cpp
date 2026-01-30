#include <Arduino.h>
#include <NimBLEDevice.h>

/* ================= BLE ================= */
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHAR_CMD_UUID       "abcdefab-1234-1234-1234-abcdefabcdef"

NimBLEServer* pServer = nullptr;
NimBLECharacteristic* cmdChar = nullptr;
bool deviceConnected = false;

/* Forward declarations */
void forward();
void backward();
void left();
void right();
void F_L();
void F_R();
void B_L();
void B_R();
void stopCar();
void updateLed();
void handleBlink();
void resetAllStates();

/* ============== MOTOR PIN ============== */
#define ENA 25
#define IN1 27
#define IN2 26

#define ENB 13
#define IN3 14
#define IN4 12

/* ============== LED PIN ================ */
#define LED_F 23
#define LED_B 22

/* ============== BLINK ================== */
bool blinkEnable = false;
bool blinkState = false;
unsigned long lastBlinkTime = 0;
const unsigned long blinkInterval = 300;

/* ============== TIMEOUT ================ */
unsigned long lastCmdTime = 0;
const unsigned long CMD_TIMEOUT = 300;

/* ============== LED STATE ============== */
bool ledFState = false;
bool ledBState = false;

/* ============== SPEED ================== */
int SPEED_MAX = 255;
int SPEED_MIN = 180;
int currentSpeedFront = 200;
int currentSpeedBack = 200;

/* ========== SERVER CALLBACK (MỚI - XỬ LÝ RECONNECT) ============ */
class ServerCallback : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer) {
    deviceConnected = true;
    Serial.println("✅ Client connected");
  }

  void onDisconnect(NimBLEServer* pServer) {
    deviceConnected = false;
    Serial.println("❌ Client disconnected");
    
    // Reset tất cả states khi disconnect
    resetAllStates();
    
    // Restart advertising để có thể reconnect
    Serial.println("🔄 Restarting advertising...");
    NimBLEDevice::startAdvertising();
    Serial.println("✅ Ready for reconnection");
  }
};

/* ============ BLE CALLBACK (GIỮ NGUYÊN CŨ) ============== */
class CmdCallback : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic) {
    std::string val = pCharacteristic->getValue();
    if (val.length() == 0) {
      Serial.println("❌ Callback received but empty data");
      return;
    }

    char cmd = val[0];
    Serial.print("📨 Callback received: ");
    Serial.println(cmd);
    lastCmdTime = millis();

    switch (cmd) {
      case 'F': Serial.println("  → Forward"); forward(); break;
      case 'B': Serial.println("  → Backward"); backward(); break;
      case 'L': Serial.println("  → Left"); left(); break;
      case 'R': Serial.println("  → Right"); right(); break;
      case 'G': Serial.println("  → Forward-Left"); F_L(); break;
      case 'H': Serial.println("  → Forward-Right"); F_R(); break;
      case 'I': Serial.println("  → Backward-Left"); B_L(); break;
      case 'J': Serial.println("  → Backward-Right"); B_R(); break;
      case 'X': Serial.println("  → Stop"); stopCar(); break;

      case 'U': Serial.println("  → LED Front ON"); ledFState = true;  blinkEnable = false; updateLed(); break;
      case 'u': Serial.println("  → LED Front OFF"); ledFState = false; blinkEnable = false; updateLed(); break;
      case 'V': Serial.println("  → LED Back ON"); ledBState = true;  blinkEnable = false; updateLed(); break;
      case 'v': Serial.println("  → LED Back OFF"); ledBState = false; blinkEnable = false; updateLed(); break;

      case 'W': Serial.println("  → LED Blink START"); blinkEnable = true; break;
      case 'w': Serial.println("  → LED Blink STOP"); blinkEnable = false; updateLed(); break;

      case 'S': 
        if (val.length() >= 2) {
          currentSpeedFront = constrain((int)val[1], SPEED_MIN, SPEED_MAX);
          Serial.print("  → Front Speed: "); Serial.println(currentSpeedFront);
        }
        break;
      case 'T': 
        if (val.length() >= 2) {
          currentSpeedBack = constrain((int)val[1], SPEED_MIN, SPEED_MAX);
          Serial.print("  → Back Speed: "); Serial.println(currentSpeedBack);
        }
        break;
      
      default:
        Serial.print("❌ Unknown command: ");
        Serial.println(cmd);
    }
  }
};

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ESP32 BLE Car Starting ===");

  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(LED_F, OUTPUT);
  pinMode(LED_B, OUTPUT);

  stopCar();
  updateLed();

  /* ===== BLE INIT ===== */
  Serial.println("📡 Initializing BLE...");
  NimBLEDevice::init("ESP32_CAR");
  
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallback());  // ⭐ THÊM MỚI - XỬ LÝ DISCONNECT
  Serial.println("✅ Server created with callbacks");
  
  NimBLEService *service = pServer->createService(SERVICE_UUID);

  cmdChar = service->createCharacteristic(
    CHAR_CMD_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR | NIMBLE_PROPERTY::NOTIFY
  );

  Serial.println("📌 Setting BLE callbacks...");
  cmdChar->setCallbacks(new CmdCallback());
  Serial.println("✅ Callbacks set");
  
  // Set initial value
  cmdChar->setValue(std::string("X"));
  Serial.println("✅ Initial value set");
  
  service->start();
  Serial.println("✅ Service started");

  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->start();

  Serial.println("=================================");
  Serial.println("🎉 BLE Ready! Device: ESP32_CAR");
  Serial.println("=================================\n");
}

/* ================= LOOP (GIỮ NGUYÊN CƠ CHẾ POLLING CŨ) ================= */
void loop() {
  // Poll characteristic for new commands (CƠ CHẾ CŨ - HOẠT ĐỘNG TỐT)
  if (cmdChar != nullptr) {
    std::string val = cmdChar->getValue();
    if (val.length() > 0) {
      char cmd = val[0];
      Serial.print("📨 Polling received: ");
      Serial.println(cmd);
      lastCmdTime = millis();

      switch (cmd) {
        case 'F': Serial.println("  → Forward"); forward(); break;
        case 'B': Serial.println("  → Backward"); backward(); break;
        case 'L': Serial.println("  → Left"); left(); break;
        case 'R': Serial.println("  → Right"); right(); break;
        case 'G': Serial.println("  → Forward-Left"); F_L(); break;
        case 'H': Serial.println("  → Forward-Right"); F_R(); break;
        case 'I': Serial.println("  → Backward-Left"); B_L(); break;
        case 'J': Serial.println("  → Backward-Right"); B_R(); break;
        case 'X': Serial.println("  → Stop"); stopCar(); break;

        case 'U': Serial.println("  → LED Front ON"); ledFState = true;  blinkEnable = false; updateLed(); break;
        case 'u': Serial.println("  → LED Front OFF"); ledFState = false; blinkEnable = false; updateLed(); break;
        case 'V': Serial.println("  → LED Back ON"); ledBState = true;  blinkEnable = false; updateLed(); break;
        case 'v': Serial.println("  → LED Back OFF"); ledBState = false; blinkEnable = false; updateLed(); break;

        case 'W': Serial.println("  → LED Blink START"); blinkEnable = true; break;
        case 'w': Serial.println("  → LED Blink STOP"); blinkEnable = false; updateLed(); break;

        case 'S': 
          if (val.length() >= 2) {
            currentSpeedFront = constrain((int)val[1], SPEED_MIN, SPEED_MAX);
            Serial.print("  → Front Speed: "); Serial.println(currentSpeedFront);
          }
          break;
        case 'T': 
          if (val.length() >= 2) {
            currentSpeedBack = constrain((int)val[1], SPEED_MIN, SPEED_MAX);
            Serial.print("  → Back Speed: "); Serial.println(currentSpeedBack);
          }
          break;
      }
      
      // Clear the value after processing
      cmdChar->setValue(std::string(""));
    }
  }

  // Timeout check
  if (millis() - lastCmdTime > CMD_TIMEOUT) {
    stopCar();
  }
  
  handleBlink();
}

/* ================= RESET STATES (MỚI) ================= */
void resetAllStates() {
  Serial.println("🔄 Resetting all states...");
  
  stopCar();
  
  ledFState = false;
  ledBState = false;
  blinkEnable = false;
  blinkState = false;
  updateLed();
  
  currentSpeedFront = 200;
  currentSpeedBack = 200;
  
  lastCmdTime = 0;
  
  Serial.println("✅ All states reset");
}

/* ================= MOTOR ================= */
void forward() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, currentSpeedFront);
}

void backward() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  analogWrite(ENA, currentSpeedFront);
}

void left() {
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENB, currentSpeedBack);
}

void right() {
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENB, currentSpeedBack);
}

void F_L() { forward(); left(); }
void F_R() { forward(); right(); }
void B_L() { backward(); left(); }
void B_R() { backward(); right(); }

void stopCar() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
}

/* ================= LED ================= */
void updateLed() {
  digitalWrite(LED_F, ledFState);
  digitalWrite(LED_B, ledBState);
}

void handleBlink() {
  if (!blinkEnable) return;

  unsigned long now = millis();
  if (now - lastBlinkTime >= blinkInterval) {
    lastBlinkTime = now;
    blinkState = !blinkState;
    digitalWrite(LED_F, blinkState);
    digitalWrite(LED_B, blinkState);
  }
}