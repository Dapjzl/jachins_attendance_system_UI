// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════

const GPS_ACCURACY_EXCELLENT  = 20;
const GPS_ACCURACY_GOOD       = 50;
const GPS_ACCURACY_ACCEPTABLE = 100;   

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════

let isSubmitting = false;
let gpsData      = null;
let userIP       = null;

const params        = new URLSearchParams(window.location.search);
const employeeToken = params.get('token') || '';

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
//  IP FETCH
// ═══════════════════════════════════════════════════════════════

async function fetchIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    userIP = d.ip || 'unknown';
  } catch {
    userIP = 'unknown';
  }
}
fetchIP();

// ═══════════════════════════════════════════════════════════════
//  GPS UI HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Sets the GPS status box appearance.
 * @param {'waiting'|'acquiring'|'excellent'|'good'|'acceptable'|'poor'|'error'} cls
 */
function setGPS(cls, title, detail) {
  const box = document.getElementById('gps-box');
  if (!box) return;
  box.className = 'gps-box ' + cls;
  const label = document.getElementById('gps-title');
  if (label) label.textContent = title;
  document.getElementById('gps-detail').textContent = detail;
}

/**
 * Returns display metadata for a given accuracy in metres.
 */
function getAccuracyMeta(accuracy) {
  if (accuracy <= GPS_ACCURACY_EXCELLENT)  return { cls: 'excellent',   label: 'Excellent',   emoji: '🟢' };
  if (accuracy <= GPS_ACCURACY_GOOD)       return { cls: 'good',        label: 'Good',        emoji: '🟡' };
  if (accuracy <= GPS_ACCURACY_ACCEPTABLE) return { cls: 'acceptable',  label: 'Acceptable',  emoji: '🟠' };
  return                                          { cls: 'poor',         label: 'Poor',        emoji: '🔴' };
}

// ═══════════════════════════════════════════════════════════════
//  REVERSE GEOCODE (fire-and-forget)
// ═══════════════════════════════════════════════════════════════

function getLocationName(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
    .then(r => r.json())
    .then(data => {
      const location =
        data.address?.road    ||
        data.address?.suburb  ||
        data.address?.city    ||
        data.display_name     ||
        `${lat}, ${lng}`;
      gpsData.locationName = location;
      const meta = getAccuracyMeta(gpsData.accuracy);
      if (meta.cls !== 'poor') {
        document.getElementById('gps-detail').textContent =
          `${meta.emoji} ${meta.label} · ±${Math.round(gpsData.accuracy)}m · ${location}`;
      }
    })
    .catch(() => {
      gpsData.locationName = `${lat}, ${lng}`;
    });
}

// ═══════════════════════════════════════════════════════════════
//  GPS ACQUISITION
// ═══════════════════════════════════════════════════════════════

let _watchId = null;

function startGPSOnce() {
  const gpsBox = document.getElementById('gps-box');
  gpsBox.removeEventListener('click', startGPSOnce);

  setGPS('acquiring', 'Acquiring GPS…', 'Please wait — this may take a moment outdoors');
  document.getElementById('gps-spinner').style.display = 'block';

  if (!navigator.geolocation) {
    setGPS('error', 'GPS Unavailable', 'Your device does not support geolocation');
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
  const lat      = position.coords.latitude;
  const lng      = position.coords.longitude;
  const accuracy = position.coords.accuracy;
  const meta     = getAccuracyMeta(accuracy);

  gpsData = {
    latitude:     lat,
    longitude:    lng,
    accuracy:     accuracy,
    locationName: `${lat}, ${lng}`,   // updated async by getLocationName
  };

  document.getElementById('gps-spinner').style.display = 'none';

  if (accuracy > GPS_ACCURACY_ACCEPTABLE) {
    setGPS(
      'poor',
      `GPS Poor — ±${Math.round(accuracy)}m`,
      '🔴 Too inaccurate. Move outdoors and away from buildings.'
    );
    _lockButtons();
    return;
  }

  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }

  setGPS(
    meta.cls,
    `Location Ready — ±${Math.round(accuracy)}m`,
    `${meta.emoji} ${meta.label} · Fetching address…`
  );

  getLocationName(lat, lng);
  _unlockButtons();
}

function _onGPSError(error) {
  document.getElementById('gps-spinner').style.display = 'none';
  setGPS('error', 'GPS Error', error.message);
  _lockButtons();
}

// ═══════════════════════════════════════════════════════════════
//  BUTTON STATE HELPERS
// ═══════════════════════════════════════════════════════════════


function _lockButtons() {
  const ci = document.getElementById('btn-checkin');
  const co = document.getElementById('btn-checkout');
  if (ci && !ci.dataset.stateLocked) ci.disabled = true;
  if (co && !co.dataset.stateLocked) co.disabled = true;
}

function _unlockButtons() {

  const ci = document.getElementById('btn-checkin');
  const co = document.getElementById('btn-checkout');

  if (ci && ci.dataset.stateAllowed === 'true' && !ci.dataset.stateLocked) ci.disabled = false;
  if (co && co.dataset.stateAllowed === 'true' && !co.dataset.stateLocked) co.disabled = false;
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE STATE — load on page start
// ═══════════════════════════════════════════════════════════════

async function loadAttendanceState() {
  if (!employeeToken) return;

  const ciBtn       = document.getElementById('btn-checkin');
  const coBtn       = document.getElementById('btn-checkout');
  const checkinPill = document.getElementById('checkin-pill');
  const checkoutPill = document.getElementById('checkout-pill');

  try {
    const response = await fetch(`/api/status?token=${encodeURIComponent(employeeToken)}`);
    const data     = await response.json();

    if (!data.success) return;

    const { checkedIn, checkedOut, checkInTime, checkOutTime, hoursWorked } = data;

    if (!checkedIn) {
      // ── State A: fresh day ─────────────────────────────────
      ciBtn.dataset.stateAllowed  = 'true';
      coBtn.dataset.stateAllowed  = 'false';
      coBtn.dataset.stateLocked   = 'true';
      coBtn.disabled              = true;

      if (checkinPill)  checkinPill.className  = 'status-pill pending';
      if (checkoutPill) checkoutPill.className = 'status-pill pending';

    } else if (checkedIn && !checkedOut) {
      // ── State B: checked in, awaiting check-out ────────────
      ciBtn.dataset.stateAllowed  = 'false';
      ciBtn.dataset.stateLocked   = 'true';
      ciBtn.disabled              = true;

      coBtn.dataset.stateAllowed  = 'true';

      if (checkinPill) {
        checkinPill.className = 'status-pill done';
        checkinPill.innerHTML = `<span class="pill-icon">✅</span>Checked In at ${checkInTime}`;
      }
      if (checkoutPill) {
        checkoutPill.className = 'status-pill pending';
        checkoutPill.innerHTML = `<span class="pill-icon">⏳</span>Awaiting Check-Out`;
      }

    } else {
      // ── State C: day complete ──────────────────────────────
      ciBtn.dataset.stateAllowed  = 'false';
      ciBtn.dataset.stateLocked   = 'true';
      ciBtn.disabled              = true;

      coBtn.dataset.stateAllowed  = 'false';
      coBtn.dataset.stateLocked   = 'true';
      coBtn.disabled              = true;

      if (checkinPill) {
        checkinPill.className = 'status-pill done';
        checkinPill.innerHTML = `<span class="pill-icon">✅</span>Checked In at ${checkInTime}`;
      }
      if (checkoutPill) {
        checkoutPill.className = 'status-pill done';
        checkoutPill.innerHTML = `<span class="pill-icon">✅</span>Checked Out at ${checkOutTime}${hoursWorked ? ' · ' + hoursWorked + 'h' : ''}`;
      }

      showAlert('success', `✅ Attendance completed for today. You worked ${hoursWorked || '—'} hours.`);
    }

  } catch (err) {
    console.error('[Status] Failed to load attendance state:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEE PROFILE
// ═══════════════════════════════════════════════════════════════

async function loadEmployee() {
  if (!employeeToken) {
    document.getElementById('emp-name').textContent = 'Missing Token';
    document.getElementById('emp-meta').textContent = 'No attendance token provided';
    return;
  }
  try {
    const response = await fetch(`/api/employee?token=${encodeURIComponent(employeeToken)}`);
    const data     = await response.json();
    if (data.success) {
      document.getElementById('emp-name').textContent = data.employee.name;
      document.getElementById('emp-meta').textContent =
        `${data.employee.department} • ${data.employee.employeeId}`;
    } else {
      document.getElementById('emp-name').textContent = 'Employee Not Found';
      document.getElementById('emp-meta').textContent = data.message;
    }
  } catch (err) {
    document.getElementById('emp-name').textContent = 'Connection Error';
    document.getElementById('emp-meta').textContent = err.toString();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUBMIT ATTENDANCE
// ═══════════════════════════════════════════════════════════════

async function submitAction(action) {
  if (isSubmitting) return;

  // ── Pre-flight GPS check ───────────────────────────────────
  if (!gpsData) {
    showAlert('error', '📍 GPS location required before attendance.');
    return;
  }

  if (gpsData.accuracy > GPS_ACCURACY_ACCEPTABLE) {
    showAlert('error', `🔴 GPS accuracy is too low (±${Math.round(gpsData.accuracy)}m). Move outdoors and try again.`);
    return;
  }

  isSubmitting = true;

  const spinnerId = action === 'checkin' ? 'ci-spinner' : 'co-spinner';
  const labelId   = action === 'checkin' ? 'ci-label'   : 'co-label';
  const btn       = document.getElementById('btn-' + action);
  const spinner   = document.getElementById(spinnerId);
  const label     = document.getElementById(labelId);

  btn.disabled          = true;
  spinner.style.display = 'block';
  label.style.opacity   = '0';

  try {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        token:        employeeToken,
        latitude:     gpsData.latitude,
        longitude:    gpsData.longitude,
        accuracy:     gpsData.accuracy,
        locationName: gpsData.locationName,
        ip:           userIP || 'unknown',
        userAgent:    navigator.userAgent,
      }),
    });

    const data = await response.json();
    console.log('[Submit]', action, data);

    if (!data.success) {
      btn.disabled = false;
      showAlert('error', '⚠️ ' + data.message);
      isSubmitting = false;
      spinner.style.display = 'none';
      label.style.opacity   = '1';
      return;
    }

    // ── Success path ───────────────────────────────────────
    showAlert('success', '✅ ' + data.message);

    const ciBtn        = document.getElementById('btn-checkin');
    const coBtn        = document.getElementById('btn-checkout');
    const checkinPill  = document.getElementById('checkin-pill');
    const checkoutPill = document.getElementById('checkout-pill');

    if (action === 'checkin') {
      ciBtn.disabled          = true;
      ciBtn.dataset.stateLocked = 'true';
      coBtn.disabled          = false;
      coBtn.dataset.stateLocked = '';
      coBtn.dataset.stateAllowed = 'true';

      if (checkinPill) {
        checkinPill.className = 'status-pill done';
        checkinPill.innerHTML = '<span class="pill-icon">✅</span>Checked In';
      }
      if (checkoutPill) {
        checkoutPill.className = 'status-pill pending';
        checkoutPill.innerHTML = '<span class="pill-icon">⏳</span>Awaiting Check-Out';
      }
    }

    if (action === 'checkout') {
      coBtn.disabled          = true;
      coBtn.dataset.stateLocked = 'true';

      if (checkoutPill) {
        checkoutPill.className = 'status-pill done';
        checkoutPill.innerHTML = `<span class="pill-icon">✅</span>Checked Out · ${data.hoursWorked}h`;
      }
    }

  } catch (err) {
    console.error('[Submit] Network error:', err);
    showAlert('error', '🔌 Network error. Please try again.');
    btn.disabled = false;
  }

  spinner.style.display = 'none';
  label.style.opacity   = '1';
  isSubmitting          = false;
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

window.addEventListener('load', () => {
  const tokenInput = document.getElementById('token');
  if (tokenInput) tokenInput.value = employeeToken;

  // Both buttons disabled until GPS + attendance state allow them
  document.getElementById('btn-checkin').disabled  = true;
  document.getElementById('btn-checkout').disabled = true;

  loadEmployee();
  loadAttendanceState();   // sets data-state* flags; GPS will read them later

  setGPS('waiting', 'Tap to Enable Location', 'Location permission is required');
  const gpsBox = document.getElementById('gps-box');
  gpsBox.style.cursor = 'pointer';
  gpsBox.addEventListener('click', startGPSOnce);
});