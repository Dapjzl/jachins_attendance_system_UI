// ── CONFIG ──────────────────────────────────────────
const APP_URL = 'https://script.google.com/macros/s/AKfycbzw7WLhirxNQTbYHiCD24ese2-LjPjRnc3UY4SlF2MT0xN7Uau_SAHw_05GndV8QSA/exec';

let gpsData = null;
let userIP = null;

// ── CLOCK ───────────────────────────────────────────
function updateClock() {
  const now = new Date();

  document.getElementById('live-date').textContent =
    now.toLocaleDateString('en-NG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

  document.getElementById('live-time').textContent =
    now.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
}

setInterval(updateClock, 1000);
updateClock();

// ── FETCH USER IP ──────────────────────────────────
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

// ── GPS UI ─────────────────────────────────────────
function setGPS(cls, title, detail) {
  var box = document.getElementById('gps-box'); if (!box) return;

  box.className = 'gps-box ' + cls;

  var label = document.getElementById('gps-title'); if (label) label.textContent = title;

  document.getElementById('gps-detail').textContent = detail;
}

// ── GET LOCATION NAME (fire-and-forget, never blocks) ──
function getLocationName(lat, lng) {
  var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng;
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var name = (d.address && (d.address.road || d.address.suburb || d.address.city))
        || d.display_name || null;
      if (name && gpsData) {
        gpsData.locationName = name;
        document.getElementById('gps-detail').textContent =
          name + ' \u2022 \u00b1' + gpsData.accuracy + 'm';
      }
    })
    .catch(function() { /* non-fatal — coordinates already stored */ });
}

// ── GPS CORE ────────────────────────────────────────
var _watchId     = null;
var _hardTimer   = null;
var _gotFirstFix = false;

async function checkLocationPermission() {

if (!navigator.permissions) return;

try {

  const result = await navigator.permissions.query({
    name: 'geolocation'
  });

  console.log('Permission:', result.state);

  if (result.state === 'denied') {

    _gpsError(
      'Location Blocked',
      'Enable location permission in browser settings.'
    );

  }

} catch (e) {
  console.log(e);
}
}


function initGPS() {

  console.log("GPS INIT STARTED");

  const spinner =
    document.getElementById('gps-spinner');

  spinner.style.display = 'block';

  if (!navigator.geolocation) {

    alert("Geolocation not supported");

    return;
  }

  navigator.geolocation.getCurrentPosition(

    function(position) {

      console.log("GPS SUCCESS");

      gpsData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        locationName: "GPS Acquired"
      };

      console.log(gpsData);

      document.getElementById(
        'gps-spinner'
      ).style.display = 'none';

      setGPS(
        'ready',
        'Location Acquired',
        'GPS ready for attendance'
      );

      document.getElementById(
        'btn-checkin'
      ).disabled = false;

      document.getElementById(
        'btn-checkout'
      ).disabled = false;

      alert("GPS READY");

    },

    function(error) {

      console.log(error);

      alert(
        "GPS ERROR: " +
        error.code +
        " / " +
        error.message
      );

      setGPS(
        'error',
        'GPS Failed',
        error.message
      );

    },

    {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    }

  );

}



function _gpsError(title, detail) {
  setGPS('error', title, detail);
  document.getElementById('gps-spinner').style.display = 'none';
}

// ── END GPS CORE ────────────────────────────────────

function updateButtons() {
  var hasGPS = gpsData !== null;

  var ciBtn = document.getElementById('btn-checkin');
  var coBtn = document.getElementById('btn-checkout');

  // Only enable if GPS exists
  if (ciBtn && !ciBtn.dataset.locked) {
    ciBtn.disabled = !hasGPS;
  }

  if (coBtn && !coBtn.dataset.locked) {
    coBtn.disabled = !hasGPS;
  }

  console.log('[GPS] updateButtons() — hasGPS:', hasGPS,
    '| ciBtn.disabled:', ciBtn ? ciBtn.disabled : 'N/A',
    '| coBtn.disabled:', coBtn ? coBtn.disabled : 'N/A');
}

// ── SUBMIT ATTENDANCE ──────────────────────────────
async function submitAction(action) {

  if (!gpsData) {

    showAlert(
      'error',
      '📍 GPS location required before attendance.'
    );

    return;
  }

  const spinner =
    document.getElementById(
      action === 'checkin'
        ? 'ci-spinner'
        : 'co-spinner'
    );

  const label =
    document.getElementById(
      action === 'checkin'
        ? 'ci-label'
        : 'co-label'
    );

  const btn =
    document.getElementById('btn-' + action);

  btn.disabled = true;

  spinner.style.display = 'block';

  label.style.opacity = '0';

  try {

    const payload = {
      action: action,
      token: document.getElementById('token').value,

      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      accuracy: gpsData.accuracy,
      locationName: gpsData.locationName,

      ip: userIP || 'unknown',

      userAgent: navigator.userAgent
    };

    
    
const response = await fetch(APP_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain;charset=utf-8'
  },
  body: JSON.stringify(payload)
});

const data = await response.json();

console.log("SERVER RESPONSE:", data);




    const data = await response.json();

    if (data.success) {

      showAlert(
        'success',
        '✅ ' + data.message
      );

      setTimeout(() => {
        location.reload();
      }, 2500);

    } else {

      btn.disabled = false;

      showAlert(
        'error',
        '⚠️ ' + data.message
      );
    }

  } catch (err) {

    btn.disabled = false;

    showAlert(
      'error',
      '🔌 Network error occurred.'
    );
  }

  spinner.style.display = 'none';

  label.style.opacity = '1';
}

// ── ALERT ──────────────────────────────────────────
function showAlert(type, msg) {

  const el = document.getElementById('alert');

  el.textContent = msg;

  el.className = type + ' show';

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  setTimeout(() => {
    el.className = '';
  }, 7000);
}

// ── START ──────────────────────────────────────────

window.addEventListener('load', () => {

setGPS(
  'waiting',
  'Tap to Enable Location',
  'Location permission is required'
);

const gpsBox = document.getElementById('gps-box');

gpsBox.style.cursor = 'pointer';

gpsBox.addEventListener('click', startGPSOnce);

document.getElementById('btn-checkin').disabled = true;
document.getElementById('btn-checkout').disabled = true;

});

function startGPSOnce() {

const gpsBox = document.getElementById('gps-box');

gpsBox.removeEventListener('click', startGPSOnce);

setGPS(
  'waiting',
  'Requesting GPS...',
  'Please allow location access'
);
checkLocationPermission();
document.getElementById('gps-box')
.addEventListener('click', initGPS);
}