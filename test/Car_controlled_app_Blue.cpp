#include "BluetoothSerial.h"

BluetoothSerial SerialBT;

// ===== MOTOR PIN =====
#define ENA 25
#define IN1 27
#define IN2 26

#define ENB 13
#define IN3 14
#define IN4 12

// ===== LED PIN =====
#define LED_F 23
#define LED_B 22

// ===== BLINK =====
bool blinkEnable = false;
bool blinkState = false;
unsigned long lastBlinkTime = 0;
const unsigned long blinkInterval = 300;

// ===== TIMEOUT =====
unsigned long lastCmdTime = 0;
const unsigned long CMD_TIMEOUT = 300;

// ===== LED STATE =====
bool ledFState = false;
bool ledBState = false;

// ===== SPEED =====
int SPEED_MAX = 255; // 0 - 255
int SPEED_MIN = 180;
int SPEED_MID = 200;

void setup() {
  Serial.begin(115200);
  SerialBT.begin("ESP32_CAR"); // Tên Bluetooth
  Serial.println("Bluetooth Ready!");

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
}

void loop() {
  if (SerialBT.available()) {
    char cmd = SerialBT.read();
    Serial.println(cmd);

    lastCmdTime = millis();

    switch (cmd) {
      case 'F': forward(); break;
      case 'B': backward(); break;
      case 'L': left(); break;
      case 'R': right(); break;
      case 'G': F_L(); break;
      case 'H': F_R(); break;
      case 'I': B_L(); break;
      case 'J': B_R(); break;
      case 'X': stopCar(); break;

      case 'U': ledFState = true;  blinkEnable = false; updateLed(); break;
      case 'u': ledFState = false; blinkEnable = false; updateLed(); break;
      case 'V': ledBState = true;  blinkEnable = false; updateLed(); break;
      case 'v': ledBState = false; blinkEnable = false; updateLed(); break;

      case 'W': blinkEnable = true; break;
      case 'w': blinkEnable = false; updateLed(); break;

    }
  }
  if (millis() - lastCmdTime > CMD_TIMEOUT){
    stopCar();
  }
  handleBlink();
}

// =====================
// ===== MOTOR =====

// Tiến 
void forward() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, SPEED_MID);
}

// lùi
void backward() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  analogWrite(ENA, SPEED_MID);
}

// trái
void left() {
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH); 
  analogWrite(ENB, SPEED_MAX);
}

// phải
void right() {
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENB, SPEED_MAX);
}

// tiến + trái
void F_L() {
  forward();
  left();
}

// tiến + phải
void F_R() {
  forward();
  right();
}

// lùi + trái
void B_L() {
  backward();
  left();
}

// lùi + phải
void B_R() {
  backward();
  right();
}

// dừng
void stopCar() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
}

// =====================
// ===== LED =====
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
