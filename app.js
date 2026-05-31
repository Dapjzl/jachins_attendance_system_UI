// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const GPS_THRESHOLD = 100;   

// ═══════════════════════════════════════════════════════════════
//  SINGLE SOURCE OF TRUTH
//  Everything reads from here; nothing computes state elsewhere.
// ═══════════════════════════════════════════════════════════════

const state = {
  // GPS
  gpsReady:    false,
  gpsAccuracy: Infinity,
  gpsData:     null,        
  statusLoaded: false,
  checkedIn:    false,
  checkedOut:   false,
  checkInTime:  null,
  checkOutTime: null,
  hoursWorked:  null,

  isSubmitting: false,
};

function tryFinalSync() {
  if (state.statusLoaded && state.gpsData) {
    syncButtonState();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SINGLE SYNC FUNCTION
//  Called after EVERY state mutation. This is the only place
//  that reads state and writes to the DOM buttons.
// ═══════════════════════════════════════════════════════════════

function syncButtonState() {
  const ciBtn = document.getElementById('btn-checkin');
  const coBtn = document.getElementById('btn-checkout');
  if (!ciBtn || !coBtn) return;

  const ready =
    state.statusLoaded &&
    state.gpsData &&
    state.gpsAccuracy <= GPS_THRESHOLD;


  if (!ready) {
    ciBtn.disabled = true;
    coBtn.disabled = true;
    console.log('[sync] waiting for full readiness');
    return;
  }

  ciBtn.disabled = state.checkedIn;

  coBtn.disabled = !(state.checkedIn && !state.checkedOut);

  console.log('[sync]',
    'checkedIn:', state.checkedIn,
    'checkedOut:', state.checkedOut,
    'ci:', ciBtn.disabled,
    'co:', coBtn.disabled
  );
}

// ═══════════════════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════════════════

function updateClock() {
  const now = new Date();
  document.getElementById('live-date').textContent =
    now.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('live-time').textContent =
    now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ═══════════════════════════════════════════════════════════════
//  IP
// ═══════════════════════════════════════════════════════════════

let userIP = null;

async function fetchIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    userIP = (await r.json()).ip || 'unknown';
  } catch {
    userIP = 'unknown';
  }
}

// ═══════════════════════════════════════════════════════════════
//  TOKEN
// ═══════════════════════════════════════════════════════════════

const employeeToken = new URLSearchParams(window.location.search).get('token') || '';

// ═══════════════════════════════════════════════════════════════
//  GPS
// ═══════════════════════════════════════════════════════════════

let _watchId = null;

function gpsAccuracyMeta(accuracy) {
  if (accuracy <=  20) return { cls: 'excellent',  label: 'Excellent',  emoji: '🟢' };
  if (accuracy <=  50) return { cls: 'good',       label: 'Good',       emoji: '🟡' };
  if (accuracy <= 100) return { cls: 'acceptable', label: 'Acceptable', emoji: '🟠' };
  return                      { cls: 'poor',       label: 'Poor',       emoji: '🔴' };
}

function setGPS(cls, title, detail) {
  const box = document.getElementById('gps-box');
  if (!box) return;
  box.className = 'gps-box ' + cls;
  const label = document.getElementById('gps-title');
  if (label) label.textContent = title;
  document.getElementById('gps-detail').textContent = detail;
}

function startGPSOnce() {
  document.getElementById('gps-box').removeEventListener('click', startGPSOnce);
  setGPS('acquiring', 'Acquiring GPS…', 'Please wait — works best outdoors');
  document.getElementById('gps-spinner').style.display = 'block';

  if (!navigator.geolocation) {
    setGPS('error', 'GPS unavailable', 'Your device does not support geolocation');
    document.getElementById('gps-spinner').style.display = 'none';
    return;
  }

  _watchId = navigator.geolocation.watchPosition(
    _onGPSSuccess,
    _onGPSError,
    { enableHighAccuracy: true, timeout: 45000, maximumAge: 0 }
  );
}

function _onGPSSuccess(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const meta = gpsAccuracyMeta(accuracy);

  state.gpsReady = accuracy <= GPS_THRESHOLD;

  document.getElementById('gps-spinner').style.display = 'none';

  state.gpsAccuracy    = accuracy;
  state.gpsReady       = accuracy <= GPS_THRESHOLD;
  state.gpsData        = { latitude, longitude, accuracy, locationName: `${latitude}, ${longitude}` };

  if (accuracy > GPS_THRESHOLD) {
    setGPS('poor', `GPS poor — ±${Math.round(accuracy)}m`,
      '🔴 Move outdoors, away from buildings');
  } else {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
    setGPS(meta.cls, `Location ready — ±${Math.round(accuracy)}m`,
      `${meta.emoji} ${meta.label} · Fetching address…`);
    _fetchLocationName(latitude, longitude);
  }

  syncButtonState();   
}

function _onGPSError(error) {
  document.getElementById('gps-spinner').style.display = 'none';
  state.gpsReady = false;
  setGPS('error', 'GPS error', error.message);
  syncButtonState();
}

function _fetchLocationName(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
    .then(r => r.json())
    .then(d => {
      const name = d.address?.road || d.address?.suburb || d.address?.city || d.display_name || `${lat}, ${lng}`;
      if (state.gpsData) state.gpsData.locationName = name;
      const meta = gpsAccuracyMeta(state.gpsAccuracy);
      setGPS(meta.cls, `Location ready — ±${Math.round(state.gpsAccuracy)}m`,
        `${meta.emoji} ${meta.label} · ${name}`);
    })
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE STATUS — called on page load
// ═══════════════════════════════════════════════════════════════

async function loadAttendanceState() {
  if (!employeeToken) return;

  try {
    const res  = await fetch(`/api/status?token=${encodeURIComponent(employeeToken)}`);
    const data = await res.json();

    if (!data.success) return;

    state.checkedIn    = !!data.checkedIn;
    state.checkedOut   = !!data.checkedOut;
    state.checkInTime  = data.checkInTime  || null;
    state.checkOutTime = data.checkOutTime || null;
    state.hoursWorked  = data.hoursWorked  || null;
    state.statusLoaded = true;
    state.statusLoaded = true;

    tryFinalSync();
    _applyStatusUI();
    syncButtonState();   // ← re-evaluate buttons after status loads

  } catch (err) {
    console.error('[Status] Failed:', err);
  }
}

function _applyStatusUI() {
  const checkinPill  = document.getElementById('checkin-pill');
  const checkoutPill = document.getElementById('checkout-pill');

  if (state.checkedIn && checkinPill) {
    checkinPill.className = 'status-pill done';
    checkinPill.innerHTML = `<span class="pill-icon">✅</span>Checked in at ${state.checkInTime || '—'}`;
  }

  if (state.checkedOut && checkoutPill) {
    checkoutPill.className = 'status-pill done';
    checkoutPill.innerHTML = `<span class="pill-icon">✅</span>Checked out at ${state.checkOutTime || '—'}` +
      (state.hoursWorked ? ` · ${state.hoursWorked}h` : '');
  } else if (state.checkedIn && checkoutPill) {
    checkoutPill.className = 'status-pill pending';
    checkoutPill.innerHTML = `<span class="pill-icon">⏳</span>Awaiting check-out`;
  }

  if (state.checkedIn && state.checkedOut) {
    showAlert('success', `✅ Attendance complete for today. Hours worked: ${state.hoursWorked || '—'}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEE PROFILE
// ═══════════════════════════════════════════════════════════════

async function loadEmployee() {
  if (!employeeToken) {
    document.getElementById('emp-name').textContent = 'Missing token';
    document.getElementById('emp-meta').textContent = 'No attendance token in URL';
    return;
  }
  try {
    const res  = await fetch(`/api/employee?token=${encodeURIComponent(employeeToken)}`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('emp-name').textContent = data.employee.name;
      document.getElementById('emp-meta').textContent =
        `${data.employee.department} · ${data.employee.employeeId}`;
    } else {
      document.getElementById('emp-name').textContent = 'Employee not found';
      document.getElementById('emp-meta').textContent = data.message || '';
    }
  } catch (err) {
    document.getElementById('emp-name').textContent = 'Connection error';
    document.getElementById('emp-meta').textContent = err.toString();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUBMIT ATTENDANCE
// ═══════════════════════════════════════════════════════════════

async function submitAction(action) {
  if (state.isSubmitting) return;

  if (!state.gpsData) {
    showAlert('error', '📍 GPS location required. Tap the GPS box to enable it.');
    return;
  }
  if (state.gpsAccuracy > GPS_THRESHOLD) {
    showAlert('error', `🔴 GPS accuracy too low (±${Math.round(state.gpsAccuracy)}m). Move outdoors and retry.`);
    return;
  }

  state.isSubmitting = true;

  const btn     = document.getElementById('btn-' + action);
  const spinner = document.getElementById(action === 'checkin' ? 'ci-spinner' : 'co-spinner');
  const label   = document.getElementById(action === 'checkin' ? 'ci-label'   : 'co-label');

  btn.disabled          = true;
  spinner.style.display = 'block';
  label.style.opacity   = '0';

  try {
    const res  = await fetch('/api/attendance', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        token:        employeeToken,
        latitude:     state.gpsData.latitude,
        longitude:    state.gpsData.longitude,
        accuracy:     state.gpsData.accuracy,
        locationName: state.gpsData.locationName,
        ip:           userIP || 'unknown',
        userAgent:    navigator.userAgent,
      }),
    });

    const data = await res.json();
    console.log('[Submit]', action, data);

    if (!data.success) {
      showAlert('error', '⚠️ ' + (data.message || 'Unknown error'));
    } else {
      showAlert('success', '✅ ' + data.message);

      if (action === 'checkin') {
        state.checkedIn   = true;
        state.checkInTime = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
        _applyStatusUI();
      }

      if (action === 'checkout') {
        state.checkedOut   = true;
        state.checkOutTime = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
        state.hoursWorked  = data.hoursWorked || null;
        _applyStatusUI();
      }
    }

  } catch (err) {
    console.error('[Submit] Network error:', err);
    showAlert('error', '🔌 Network error. Please try again.');
  }

  spinner.style.display = 'none';
  label.style.opacity   = '1';
  state.isSubmitting    = false;

  syncButtonState();  
}

// ═══════════════════════════════════════════════════════════════
//  ALERT
// ═══════════════════════════════════════════════════════════════

function showAlert(type, msg) {
  const el = document.getElementById('alert');
  el.textContent = msg;
  el.className   = type + ' show';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { el.className = ''; }, 7000);
}

// ═══════════════════════════════════════════════════════════════
//  PAGE INIT
// ═══════════════════════════════════════════════════════════════

window.addEventListener('load', async () => {
  const tokenInput = document.getElementById('token');
  if (tokenInput) tokenInput.value = employeeToken;

  
  document.getElementById('btn-checkin').disabled  = true;
  document.getElementById('btn-checkout').disabled = true;

  fetchIP();
  loadEmployee();
  loadAttendanceState();

  setGPS('waiting', 'Tap to enable location', 'Location permission is required');
  const gpsBox = document.getElementById('gps-box');
  gpsBox.style.cursor = 'pointer';
  gpsBox.addEventListener('click', startGPSOnce);
});