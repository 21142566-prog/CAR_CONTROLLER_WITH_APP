// Global variables
let allSessions = [];
let filteredSessions = [];
let usageChart = null;

// Load data when page loads
window.addEventListener('DOMContentLoaded', () => {
  console.log('📊 Statistics page loaded');
  loadSessions();
});

// ============================================
// LOAD SESSIONS FROM FIREBASE
// ============================================
async function loadSessions() {
  try {
    console.log('🔄 Loading sessions from Firebase...');
    
    const snapshot = await db.collection('sessions')
      .orderBy('startTime', 'desc')
      .get();
    
    allSessions = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      allSessions.push({
        id: doc.id,
        ...data,
        startTime: data.startTime?.toDate(),
        endTime: data.endTime?.toDate()
      });
    });
    
    console.log(`✅ Loaded ${allSessions.length} sessions`);
    
    // Update stats and table
    updateSummaryCards();
    filterSessions();
    updateChart();
    
  } catch (error) {
    console.error('❌ Error loading sessions:', error);
    document.getElementById('sessionsTableBody').innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Error loading data</div>
          <div class="empty-state-subtext">${error.message}</div>
        </td>
      </tr>
    `;
  }
}

// ============================================
// UPDATE SUMMARY CARDS
// ============================================
function updateSummaryCards() {
  const totalSessions = allSessions.length;
  
  // Calculate total duration
  let totalSeconds = 0;
  let validSessions = 0;
  let lastSessionDate = null;
  
  allSessions.forEach(session => {
    if (session.duration) {
      totalSeconds += session.duration;
      validSessions++;
    }
    if (session.startTime && (!lastSessionDate || session.startTime > lastSessionDate)) {
      lastSessionDate = session.startTime;
    }
  });
  
  // Update cards
  document.getElementById('totalSessions').textContent = totalSessions;
  
  // Total time
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  document.getElementById('totalTime').textContent = `${hours}h ${minutes}m`;
  
  // Last session
  if (lastSessionDate) {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('lastSession').textContent = lastSessionDate.toLocaleDateString('en-US', options);
  } else {
    document.getElementById('lastSession').textContent = 'N/A';
  }
  
  // Average duration
  if (validSessions > 0) {
    const avgSeconds = Math.floor(totalSeconds / validSessions);
    const avgMinutes = Math.floor(avgSeconds / 60);
    const avgSecs = avgSeconds % 60;
    document.getElementById('avgDuration').textContent = `${avgMinutes}m ${avgSecs}s`;
  } else {
    document.getElementById('avgDuration').textContent = '0m 0s';
  }
}

// ============================================
// FILTER SESSIONS
// ============================================
function filterSessions() {
  const dateFilter = document.getElementById('dateFilter').value;
  const limitFilter = document.getElementById('limitFilter').value;
  
  // Filter by date
  const now = new Date();
  let filtered = allSessions.filter(session => {
    if (!session.startTime) return false;
    
    switch(dateFilter) {
      case 'today':
        return session.startTime.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return session.startTime >= weekAgo;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return session.startTime >= monthAgo;
      default:
        return true;
    }
  });
  
  // Limit results
  if (limitFilter !== 'all') {
    filtered = filtered.slice(0, parseInt(limitFilter));
  }
  
  filteredSessions = filtered;
  updateTable();
}

// ============================================
// UPDATE TABLE
// ============================================
function updateTable() {
  const tbody = document.getElementById('sessionsTableBody');
  
  if (filteredSessions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-text">No sessions found</div>
          <div class="empty-state-subtext">Try adjusting your filters or connect your BLE device</div>
        </td>
      </tr>
    `;
    return;
  }
  
  let html = '';
  filteredSessions.forEach((session, index) => {
    const startTime = session.startTime ? 
      session.startTime.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : 'N/A';
    
    const endTime = session.endTime ? 
      session.endTime.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : 'N/A';
    
    const duration = session.duration ? formatDuration(session.duration) : 'N/A';
    
    const statusClass = session.status === 'connected' ? 'status-connected' : 'status-disconnected';
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${session.deviceName || 'Unknown'}</td>
        <td>${startTime}</td>
        <td>${endTime}</td>
        <td>${duration}</td>
        <td><span class="status-badge ${statusClass}">${session.status || 'unknown'}</span></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

// ============================================
// FORMAT DURATION
// ============================================
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// ============================================
// UPDATE CHART
// ============================================
function updateChart() {
  // Group sessions by date
  const sessionsPerDay = {};
  
  allSessions.forEach(session => {
    if (!session.startTime) return;
    
    const dateKey = session.startTime.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    if (!sessionsPerDay[dateKey]) {
      sessionsPerDay[dateKey] = {
        count: 0,
        duration: 0
      };
    }
    
    sessionsPerDay[dateKey].count++;
    sessionsPerDay[dateKey].duration += (session.duration || 0);
  });
  
  // Get last 7 days
  const labels = [];
  const sessionCounts = [];
  const durations = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    labels.push(dateKey);
    sessionCounts.push(sessionsPerDay[dateKey]?.count || 0);
    durations.push(Math.round((sessionsPerDay[dateKey]?.duration || 0) / 60)); // Convert to minutes
  }
  
  // Destroy old chart if exists
  if (usageChart) {
    usageChart.destroy();
  }
  
  // Create new chart
  const ctx = document.getElementById('usageChart').getContext('2d');
  usageChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Sessions',
          data: sessionCounts,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Duration (minutes)',
          data: durations,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Sessions'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Duration (min)'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
}

// ============================================
// EXPORT TO CSV
// ============================================
function exportToCSV() {
  if (allSessions.length === 0) {
    alert('No data to export!');
    return;
  }
  
  // Create CSV content
  let csv = 'ID,Device Name,Start Time,End Time,Duration (seconds),Status\n';
  
  allSessions.forEach(session => {
    const startTime = session.startTime ? session.startTime.toISOString() : '';
    const endTime = session.endTime ? session.endTime.toISOString() : '';
    
    csv += `"${session.id}","${session.deviceName || 'Unknown'}","${startTime}","${endTime}",${session.duration || 0},"${session.status || 'unknown'}"\n`;
  });
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ble-car-sessions-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  console.log('✅ CSV exported successfully');
}

// ============================================
// DELETE OLD SESSIONS
// ============================================
async function deleteOldSessions() {
  if (!confirm('Delete all sessions older than 30 days? This cannot be undone!')) {
    return;
  }
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const snapshot = await db.collection('sessions')
      .where('startTime', '<', cutoffDate)
      .get();
    
    if (snapshot.empty) {
      alert('No old sessions to delete.');
      return;
    }
    
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    alert(`✅ Deleted ${snapshot.size} old sessions`);
    loadSessions(); // Reload data
    
  } catch (error) {
    console.error('❌ Error deleting sessions:', error);
    alert('Error deleting sessions: ' + error.message);
  }
}