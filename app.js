// ── CONFIG ──────────────────────────────────────────
// const APP_URL = 'https://script.google.com/macros/s/AKfycbzw7WLhirxNQTbYHiCD24ese2-LjPjRnc3UY4SlF2MT0xN7Uau_SAHw_05GndV8QSA/exec';

let gpsData = null;
let userIP = null;


const params = new URLSearchParams(window.location.search);

const employeeToken = params.get('token') || '';

console.log('TOKEN:', employeeToken);



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

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

  fetch(url)
    .then(r => r.json())
    .then(data => {

      console.log("LOCATION DATA:", data);

      const location =
        data.address?.road ||
        data.address?.suburb ||
        data.address?.city ||
        data.display_name ||
        `${lat}, ${lng}`;

      gpsData.locationName = location;

      document.getElementById('gps-detail').textContent =
        location;

    })
    .catch(err => {

      console.log(err);

      gpsData.locationName =
        `${lat}, ${lng}`;

    });
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

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    gpsData = {
    latitude: lat,
    longitude: lng,
    accuracy: position.coords.accuracy,
    locationName: lat + "," + lng
    };

    // GET REAL LOCATION NAME
    getLocationName(lat, lng);


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
      timeout: 45000,
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

      token: employeeToken,

      latitude:
        gpsData.latitude,

      longitude:
        gpsData.longitude,

      accuracy:
        gpsData.accuracy,

      locationName:
        gpsData.locationName,

      ip:
        userIP || 'unknown',

      userAgent:
        navigator.userAgent

    };

    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: action,
        token: employeeToken,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        accuracy: gpsData.accuracy,
        locationName: gpsData.locationName,
        ip: userIP || 'unknown',
        userAgent: navigator.userAgent
      })
    });

    const text = await response.text();

    console.log("RAW RESPONSE:", text);

    const data = JSON.parse(text);

    console.log('SERVER RESPONSE:', data);
    if (data.success) {

      showAlert(
        'success',
        '✅ ' + data.message
      );
    
      // CHECK-IN SUCCESS
      if (action === 'checkin') {
    
        // Disable check-in button
        const ciBtn = document.getElementById('btn-checkin');
        ciBtn.disabled = true;
        ciBtn.dataset.locked = 'true';
    
        // Enable check-out button
        const coBtn = document.getElementById('btn-checkout');
        coBtn.disabled = false;
        delete coBtn.dataset.locked;
    
        // Update status pills
        const checkinPill =
          document.getElementById('checkin-pill');
    
        const checkoutPill =
          document.getElementById('checkout-pill');
    
        if (checkinPill) {
          checkinPill.className =
            'status-pill done';
    
          checkinPill.innerHTML =
            '<span class="pill-icon">✅</span>Checked In';
        }
    
        if (checkoutPill) {
          checkoutPill.className =
            'status-pill pending';
    
          checkoutPill.innerHTML =
            '<span class="pill-icon">⏳</span>Awaiting Check-Out';
        }
    
      }
    
      // CHECK-OUT SUCCESS
      if (action === 'checkout') {
    
        const coBtn =
          document.getElementById('btn-checkout');
    
        coBtn.disabled = true;
        coBtn.dataset.locked = 'true';
    
        const checkoutPill =
          document.getElementById('checkout-pill');
    
        if (checkoutPill) {
          checkoutPill.className =
            'status-pill done';
    
          checkoutPill.innerHTML =
            '<span class="pill-icon">✅</span>Checked Out';
        }
    
      }
    
    }

  } catch (err) {

    console.log(err);

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

async function loadEmployee() {

  console.log("TOKEN:", employeeToken);

  if (!employeeToken) {

    console.log("NO TOKEN FOUND");

    document.getElementById('emp-name')
      .textContent = 'Missing Token';

    document.getElementById('emp-meta')
      .textContent = 'No attendance token provided';

    return;

  }

  try {

    const response = await fetch(
      '/api/employee?token=' +
      encodeURIComponent(employeeToken)
    );

    const text = await response.text();

    console.log("RAW API RESPONSE:", text);

    const data = JSON.parse(text);

    console.log("EMPLOYEE:", data);

    if (data.success) {

      document.getElementById('emp-name')
        .textContent = data.employee.name;

      document.getElementById('emp-meta')
        .textContent =
          data.employee.department +
          ' • ' +
          data.employee.employeeId;

    } else {

      document.getElementById('emp-name')
        .textContent = 'Employee Not Found';

      document.getElementById('emp-meta')
        .textContent = data.message;

    }

  } catch (err) {

    console.log(err);

    document.getElementById('emp-name')
      .textContent = 'Connection Error';

    document.getElementById('emp-meta')
      .textContent = err.toString();

  }

}
// ── START ──────────────────────────────────────────

window.addEventListener('load', () => {

document.getElementById('token').value = employeeToken;

loadEmployee();

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

  // START GPS IMMEDIATELY
  initGPS();
}

