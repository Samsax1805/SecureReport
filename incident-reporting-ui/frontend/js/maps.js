// ==================== MAPS.JS ====================

let mapInstances = {};

function initMap(containerId, incidents = []) {
  if (mapInstances[containerId]) {
    return mapInstances[containerId];
  }
  
  const map = L.map(containerId).setView([0, 0], 2);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  safeIncidents.forEach(incident => {
    if (incident.lat && incident.lng) {
      L.marker([incident.lat, incident.lng])
        .addTo(map)
        .bindPopup(`<b>${incident.type}</b><br>${incident.status}`);
    }
  });
  
  mapInstances[containerId] = map;
  return map;
}

function loadIncidentsOnMap() {
  // Called from app.js when incidents are loaded
}

function getLocation(prefix) {
  const btn = event.target;
  const original = btn.innerHTML;
  if (!navigator.geolocation) {
    alert('Geolocation not supported');
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting...';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      [`${prefix}-lat`, `${prefix}-lng`].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.value = i === 0 ? lat : lng;
      });
      const preview = document.getElementById(`${prefix}-map-preview`);
      if (preview) {
        preview.innerHTML = `<div style="width:100%;height:200px;border-radius:8px;overflow:hidden;"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}" width="100%" height="100%" frameborder="0" style="border:0"></iframe></div><p style="margin-top:8px;font-size:13px;">📍 Accuracy: ${Math.round(accuracy)}m</p>`;
        preview.classList.remove('hidden');
      }
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Done';
      btn.classList.add('btn-primary');
      btn.disabled = false;
    },
    err => {
      alert('Location error: ' + (err.message || 'Unknown'));
      btn.innerHTML = original;
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview || !input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.maxWidth = '200px';
    img.style.maxHeight = '150px';
    img.style.borderRadius = '8px';
    preview.innerHTML = '';
    preview.appendChild(img);
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}