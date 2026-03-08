// ============================================
// FIREBASE TRACKING FOR BLE CAR APP
// ============================================

// Current session tracking (accessible globally for cleanup)
window.currentSession = null;
window.sessionStartTime = null;

// ============================================
// 1. START SESSION - Gọi khi kết nối BLE
// ============================================
async function startSession() {
  try {
    window.sessionStartTime = new Date();
    
    // Tạo session mới trong Firestore
    const sessionRef = await db.collection('sessions').add({
      startTime: firebase.firestore.FieldValue.serverTimestamp(),
      deviceName: getDeviceName(),
      status: 'connected',
      endTime: null,
      duration: 0
    });
    
    window.currentSession = sessionRef.id;
    console.log('📊 Session started:', window.currentSession);
    
    return window.currentSession;
  } catch (error) {
    console.error('❌ Error starting session:', error);
  }
}

// ============================================
// 2. END SESSION - Gọi khi disconnect BLE
// ============================================
async function endSession() {
  if (!window.currentSession) {
    console.warn('⚠️ No active session to end');
    return;
  }
  
  try {
    const endTime = new Date();
    const duration = Math.floor((endTime - window.sessionStartTime) / 1000); // seconds
    
    // Update session với endTime và duration
    await db.collection('sessions').doc(window.currentSession).update({
      endTime: firebase.firestore.FieldValue.serverTimestamp(),
      duration: duration,
      status: 'disconnected'
    });
    
    console.log(`📊 Session ended: ${window.currentSession} (${duration}s)`);
    
    window.currentSession = null;
    window.sessionStartTime = null;
  } catch (error) {
    console.error('❌ Error ending session:', error);
  }
}

// ============================================
// 3. LOG ACTION - Gọi khi điều khiển xe
// ============================================
async function logAction(action, value = null) {
  if (!window.currentSession) {
    console.warn('⚠️ No active session for logging action');
    return;
  }
  
  try {
    await db.collection('actions').add({
      sessionId: window.currentSession,
      action: action,
      value: value,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`📝 Action logged: ${action}`, value);
  } catch (error) {
    console.error('❌ Error logging action:', error);
  }
}

// ============================================
// 4. GET TOTAL STATS - Lấy thống kê tổng
// ============================================
async function getTotalStats() {
  try {
    const snapshot = await db.collection('sessions').get();
    
    let totalSessions = 0;
    let totalDuration = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      totalSessions++;
      totalDuration += data.duration || 0;
    });
    
    return {
      totalSessions: totalSessions,
      totalDuration: totalDuration,
      totalHours: (totalDuration / 3600).toFixed(2)
    };
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    return null;
  }
}

// ============================================
// 5. GET RECENT SESSIONS - Lấy lịch sử gần đây
// ============================================
async function getRecentSessions(limit = 10) {
  try {
    const snapshot = await db.collection('sessions')
      .orderBy('startTime', 'desc')
      .limit(limit)
      .get();
    
    const sessions = [];
    snapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return sessions;
  } catch (error) {
    console.error('❌ Error getting recent sessions:', error);
    return [];
  }
}

// ============================================
// 6. GET SESSION ACTIONS - Lấy actions của 1 session
// ============================================
async function getSessionActions(sessionId) {
  try {
    const snapshot = await db.collection('actions')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'asc')
      .get();
    
    const actions = [];
    snapshot.forEach(doc => {
      actions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return actions;
  } catch (error) {
    console.error('❌ Error getting session actions:', error);
    return [];
  }
}

// ============================================
// 7. DELETE OLD SESSIONS - Xóa sessions cũ
// ============================================
async function deleteOldSessions(daysOld = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const snapshot = await db.collection('sessions')
      .where('startTime', '<', cutoffDate)
      .get();
    
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`🗑️ Deleted ${snapshot.size} old sessions`);
    
    return snapshot.size;
  } catch (error) {
    console.error('❌ Error deleting old sessions:', error);
    return 0;
  }
}

// ============================================
// 8. DISPLAY STATS ON PAGE - Hiển thị stats
// ============================================
async function displayStats() {
  const stats = await getTotalStats();
  if (!stats) return;
  
  console.log('📊 Total Stats:', stats);
  console.log(`   Sessions: ${stats.totalSessions}`);
  console.log(`   Duration: ${stats.totalDuration}s (${stats.totalHours} hours)`);
  
  // Có thể thêm vào UI
  // document.getElementById('totalSessions').textContent = stats.totalSessions;
  // document.getElementById('totalHours').textContent = stats.totalHours;
}

console.log('✅ Firebase tracker loaded');

// ============================================
// HELPER: GET DEVICE NAME - Lấy tên thiết bị dựa trên platform
// ============================================
function getDeviceName() {
  // Ưu tiên tên BLE device nếu có
  if (device && device.name) {
    return device.name;
  }
  
  // Detect platform type
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  if (/Android/i.test(ua)) {
    return 'Android Device';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS Device';
  } else if (/Windows/i.test(platform)) {
    return 'Windows PC';
  } else if (/Mac/i.test(platform)) {
    return 'Mac Computer';
  } else if (/Linux/i.test(platform)) {
    return 'Linux Device';
  } else {
    return 'Unknown Device';
  }
}