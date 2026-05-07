// ==================== APP.JS ====================

let currentIncidentId = null;

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId)?.classList.add('active');
  window.scrollTo(0, 0);
}

function showStatusPopup(incidentId, oldStatus, newStatus) {
  const popup = document.createElement('div');
  popup.className = 'status-popup';
  popup.innerHTML = `
    <div class="status-popup-icon">${getStatusIcon(newStatus)}</div>
    <div class="status-popup-content">
      <h4>Incident Status Updated</h4>
      <p><strong>${incidentId}</strong> is now <span class="status-badge ${newStatus.toLowerCase().replace(' ', '-')}">${newStatus}</span></p>
      <small>Changed from ${oldStatus}</small>
    </div>
    <button class="status-popup-close" onclick="this.parentElement.remove()">✕</button>
  `;
  document.body.appendChild(popup);
  setTimeout(() => { if (popup.parentElement) popup.remove(); }, 5000);
}

function getStatusIcon(status) {
  if (status === 'Resolved') return '✅';
  if (status === 'In Progress') return '🔄';
  return '⏳';
}

async function updateIncidentStatus() {
  const status = document.getElementById('update-status-select')?.value;
  const notesInput = document.querySelector('#update-modal textarea');
  const notes = notesInput ? notesInput.value.trim() : '';

  if (!currentIncidentId) return;
  const incident = await DB.getIncidentById(currentIncidentId);
  const oldStatus = incident?.status || 'Unknown';

  if (oldStatus === status && !notes) {
    alert('No changes made');
    closeModal('update-modal');
    return;
  }

  const timelineEntry = {
    date: new Date().toISOString(),
    user: (await DB.getCurrentUser())?.name || 'System',
    notes: notes || null,
    action: oldStatus !== status ? `Status changed from ${oldStatus} to ${status}` : 'Added comment/update'
  };

  await DB.updateIncident(currentIncidentId, {
    status: status,
    updatedBy: (await DB.getCurrentUser())?.name,
    timeline: [...(incident.timeline || []), timelineEntry]
  });

  closeModal('update-modal');
  loadSecurityDashboard();
  showStatusPopup(currentIncidentId, oldStatus, status);
  updateNotifBadge();
}

async function loadStudentDashboard() {
  const user = await DB.getCurrentUser();
  
  console.log('📊 Loading dashboard for user:', user);
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  // Update user info
  const nameEl = document.getElementById('student-name');
  const headerEl = document.getElementById('student-header-name');
  const avatarEl = document.getElementById('student-avatar');
  
  if (nameEl) nameEl.textContent = user.name;
  if (headerEl) headerEl.textContent = user.name?.split(' ')[0] || 'User';
  if (avatarEl) avatarEl.textContent = getInitials(user.name);

  // Load profile fields
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileId = document.getElementById('profile-id');
  
  if (profileName) profileName.value = user.name || '';
  if (profileEmail) profileEmail.value = user.email || '';
  if (profileId) profileId.value = user.id || '';

  // Get ALL incidents from database
  const allIncidents = await DB.getIncidents();
  console.log('📊 Total incidents in system:', allIncidents.length);
  
  // ✅ CRITICAL: Filter incidents STRICTLY by current user's ID
  const userIncidents = Array.isArray(allIncidents) 
    ? allIncidents.filter(i => {
        const matchById = i.reportedBy === user.id;
        const matchByEmail = i.reportedBy === user.email;
        if (matchById || matchByEmail) {
          console.log('✅ Matched incident:', i.id, 'reportedBy:', i.reportedBy);
        }
        return matchById || matchByEmail;
      })
    : [];
  
  console.log('📊 User incidents found:', userIncidents.length, 'for user:', user.id);

  // Update stats with ONLY this user's incidents
  updateStudentStats(userIncidents);
  
  // Render table with ONLY this user's incidents
  renderStudentIncidentsTable(userIncidents);
  
  // Update notification badge
  updateNotifBadge();
}

function updateStudentStats(incidents) {
  console.log('📊 Updating stats with', incidents.length, 'incidents');
  
  const stats = {
    total: incidents.length,
    pending: incidents.filter(i => i.status === 'Pending').length,
    inProgress: incidents.filter(i => i.status === 'In Progress').length,
    resolved: incidents.filter(i => i.status === 'Resolved').length
  };
  
  console.log('📊 Stats:', stats);
  
  const fields = {
    'student-total-reports': stats.total,
    'student-pending': stats.pending,
    'student-progress': stats.inProgress,
    'student-resolved': stats.resolved
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      console.log('Updated', id, 'to', value);
    } else {
      console.error('❌ Element not found:', id);
    }
  });
}

function renderStudentIncidentsTable(incidents) {
  const tbody = document.getElementById('student-incidents-table');
  if (!tbody) {
    console.error('❌ Table body not found');
    return;
  }
  
  console.log('📊 Rendering table with', incidents.length, 'incidents');

  if (incidents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray" style="padding:2rem;">No incidents reported yet</td></tr>';
    console.log('✅ Table shows "No incidents"');
    return;
  }

  // Sort by newest first
  const sortedIncidents = [...incidents].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  tbody.innerHTML = sortedIncidents.map(incident => `
    <tr>
      <td><strong>${incident.id}</strong></td>
      <td>${incident.type}</td>
      <td>${formatDate(incident.createdAt)}</td>
      <td>${incident.location}</td>
      <td><span class="status-badge ${incident.status.toLowerCase().replace(' ', '-')}">${incident.status}</span></td>
      <td>
        <button class="action-btn" onclick="showIncidentDetail('${incident.id}')" title="View Details">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
  
  console.log('✅ Table rendered with', incidents.length, 'rows');
}

async function populateStudentTrackSelect() {
  const select = document.getElementById('student-track-select');
  if (!select) return;

  const incidents = await DB.getIncidents();
  const userId = (await DB.getCurrentUser())?.id;
  const userIncidents = Array.isArray(incidents) ? incidents.filter(i => i.reportedBy === userId) : [];

  select.innerHTML = '<option value="">Select incident...</option>';

  if (userIncidents.length === 0) {
    select.innerHTML += '<option value="" disabled>No incidents found</option>';
    return;
  }

  userIncidents.forEach(inc => {
    const option = document.createElement('option');
    option.value = inc.id;
    option.textContent = `${inc.id} - ${inc.type} (${inc.status})`;
    select.appendChild(option);
  });
}

async function loadStudentTrack() {
  const incidentId = document.getElementById('student-track-select')?.value;
  const detailDiv = document.getElementById('student-track-detail');

  if (!incidentId) {
    detailDiv?.classList.add('hidden');
    return;
  }

  const incident = await DB.getIncidentById(incidentId);
  if (!incident) return;

  detailDiv?.classList.remove('hidden');

  const timelineHTML = (incident.timeline || []).length === 0
    ? '<div style="padding:20px;text-align:center;color:#9ca3af;">No updates yet</div>'
    : incident.timeline.map(t => {
        const hasNotes = t.notes?.trim();
        const isComment = t.action?.includes('comment') || t.action?.includes('Comment');
        const isStatusChange = t.action?.includes('Status changed');
        
        let bgStyle = '';
        let borderStyle = '';
        
        if (isComment) {
          bgStyle = 'background:#f3e8ff;';
          borderStyle = 'border-left:4px solid #9333EA;';
        } else if (isStatusChange) {
          bgStyle = 'background:#dbeafe;';
          borderStyle = 'border-left:4px solid #3b82f6;';
        }
        
        return `
          <div class="timeline-item">
            <div class="timeline-date">${formatDate(t.date)}</div>
            <div class="timeline-content" style="${bgStyle} ${borderStyle}">
              <p class="text-sm" style="margin-bottom:${hasNotes ? '8px' : '0'};">
                <strong>${t.user || 'System'}</strong>: ${t.action || 'Updated'}
              </p>
              ${hasNotes ? `
                <div style="padding:10px;background:#fff;border-radius:6px;font-size:13px;color:#4b5563;margin-top:8px;border-left:3px solid #9333EA;">
                  💬 ${t.notes}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

  const hasLocation = incident.lat && incident.lng;

  detailDiv.innerHTML = `
    <div class="tracking-steps">
      <div class="tracking-step completed"><div class="step-circle"><i class="fas fa-check"></i></div><span class="step-label">Submitted</span></div>
      <div class="tracking-step ${incident.status !== 'Pending' ? 'completed' : ''}"><div class="step-circle"><i class="fas fa-check"></i></div><span class="step-label">Received</span></div>
      <div class="tracking-step ${incident.status === 'In Progress' ? 'active' : incident.status === 'Resolved' ? 'completed' : ''}"><div class="step-circle"><i class="fas fa-user-shield"></i></div><span class="step-label">In Progress</span></div>
      <div class="tracking-step ${incident.status === 'Resolved' ? 'completed' : ''}"><div class="step-circle"><i class="fas fa-check-circle"></i></div><span class="step-label">Resolved</span></div>
    </div>
    <div style="margin-top:2rem;">
      <h4 style="font-size:16px;font-weight:600;margin-bottom:1rem;">Activity Log & Security Comments</h4>
      <div class="timeline" style="margin-left:0.5rem;">${timelineHTML}</div>
    </div>
    ${hasLocation ? `
    <div style="margin-top:1.5rem;">
      <h4 style="font-size:16px;font-weight:600;margin-bottom:0.5rem;">📍 Location</h4>
      <div style="padding:12px;background:#f3e8ff;border-radius:8px;">
        <p style="font-size:14px;color:#6b21a8;"><strong>Coordinates:</strong> ${parseFloat(incident.lat).toFixed(6)}, ${parseFloat(incident.lng).toFixed(6)}</p>
        <div style="width:100%;height:200px;border-radius:6px;overflow:hidden;margin-top:8px;">
          <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${incident.lng-0.005},${incident.lat-0.005},${incident.lng+0.005},${incident.lat+0.005}&layer=mapnik&marker=${incident.lat},${incident.lng}" width="100%" height="100%" frameborder="0" style="border:0"></iframe>
        </div>
      </div>
    </div>` : ''}
    ${incident.assignedTo ? `<div style="margin-top:1.5rem;padding:1rem;background:#f3e8ff;border-radius:8px;"><p><strong>👮 Assigned to:</strong> ${incident.assignedTo}</p></div>` : ''}
  `;
}

function showStudentSection(section) {
  console.log('📍 Switching to section:', section);
  
  ['dashboard', 'track', 'report', 'profile'].forEach(s => {
    const el = document.getElementById('student-' + s + '-view');
    if (el) {
      el.classList.add('hidden');
      console.log('Hidden: student-' + s + '-view');
    }
  });

  const target = document.getElementById('student-' + section + '-view');
  if (target) {
    target.classList.remove('hidden');
    console.log('✅ Showing: student-' + section + '-view');
    
    if (section === 'dashboard') {
      loadStudentDashboard();
    } else if (section === 'track') {
      populateStudentTrackSelect();
    } else if (section === 'profile') {
      loadStudentProfile();
    }
  }

  document.querySelectorAll('#student-dashboard .nav-menu a').forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`#student-dashboard .nav-menu a[onclick*="${section}"]`);
  if (active) active.classList.add('active');
}

async function loadStudentProfile() {
  const user = await DB.getCurrentUser();
  if (!user) return;
  const fields = { 'profile-name': user.name, 'profile-email': user.email, 'profile-id': user.id };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || 'Not available';
  });
}

async function submitStudentReport() {
  const user = await DB.getCurrentUser();
  const isAnonymous = document.getElementById('student-anon')?.checked;
  const lat = document.getElementById('student-lat')?.value || null;
  const lng = document.getElementById('student-lng')?.value || null;
  const fileInput = document.getElementById('student-report-file');

  if (fileInput?.files?.[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      createIncidentWithImage({ name: file.name, type: file.type, size: file.size, data: e.target.result }, lat, lng, isAnonymous, user);
    };
    reader.readAsDataURL(file);
  } else {
    createIncidentWithImage(null, lat, lng, isAnonymous, user);
  }
}

async function createIncidentWithImage(imageData, lat, lng, isAnonymous, user) {
  console.log('📝 Creating incident for user:', user);
  console.log('📝 User ID:', user?.id);
  
  const incident = {
    type: document.getElementById('student-report-type')?.value,
    priority: document.getElementById('student-report-priority')?.value,
    location: document.getElementById('student-report-location')?.value,
    datetime: document.getElementById('student-report-datetime')?.value,
    description: document.getElementById('student-report-description')?.value,
    reportedBy: isAnonymous ? 'anonymous' : user?.id,
    reportedByName: isAnonymous ? 'Anonymous' : user?.name,
    anonymous: isAnonymous,
    evidence: imageData,
    lat, lng,
    createdAt: new Date().toISOString(),
    status: 'Pending',
    assignedTo: null,
    timeline: [{ 
      date: new Date().toISOString(), 
      user: isAnonymous ? 'Anonymous' : user?.name, 
      action: 'Report submitted' 
    }]
  };

  console.log('📝 Incident will be saved with reportedBy:', incident.reportedBy);

  const result = await DB.addIncident(incident);
  if (result.success) {
    alert('Report submitted!\nID: ' + result.incident.id);
    showStudentSection('dashboard');
    loadStudentDashboard();
    setTimeout(() => {
      updateNotifBadge();
    }, 500);
    
    ['student-report-type', 'student-report-location', 'student-report-description', 'student-lat', 'student-lng'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const preview = document.getElementById('student-map-preview');
    if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
    const fileInput = document.getElementById('student-report-file');
    if (fileInput) fileInput.value = '';
  }
}

async function loadSecurityDashboard() {
  const user = await DB.getCurrentUser();
  if (!user) return;

  document.getElementById('security-name').textContent = user.name;
  document.getElementById('security-avatar').textContent = getInitials(user.name);

  const stats = await DB.getStats();
  ['security-total', 'security-pending', 'security-progress', 'security-resolved'].forEach((id, i) => {
    const el = document.getElementById(id);
    const val = [stats.totalIncidents, stats.pending, stats.inProgress, stats.resolved][i];
    if (el) el.textContent = val;
  });

  renderSecurityIncidentsTable();
  populateOfficerSelect();
}

async function renderSecurityIncidentsTable() {
  const tbody = document.getElementById('security-incidents-table');
  if (!tbody) return;

  const incidents = await DB.getIncidents();
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  
  console.log('📊 Security dashboard - Total incidents:', safeIncidents.length);
  console.log('📊 Anonymous incidents:', safeIncidents.filter(i => i.anonymous).length);
  console.log('📊 Incidents with evidence:', safeIncidents.filter(i => i.evidence).length);

  if (safeIncidents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray">No incidents found</td></tr>';
    return;
  }

  tbody.innerHTML = safeIncidents.map(inc => {
    const hasImage = inc.evidence?.data || inc.evidence;
    const isAnonymous = inc.anonymous === true;
    
    console.log(`📋 Incident ${inc.id}:`, {
      anonymous: isAnonymous,
      hasEvidence: !!hasImage,
      evidenceName: inc.evidence?.name
    });
    
    return `
      <tr>
        <td>
          <strong>${inc.id}</strong>
          ${isAnonymous ? '<br><span style="font-size:11px;color:#9333EA;">🕵️ Anonymous</span>' : ''}
        </td>
        <td>${inc.type}</td>
        <td>${formatDate(inc.createdAt)}</td>
        <td>${inc.location || 'N/A'}</td>
        <td><span class="priority-badge ${inc.priority?.toLowerCase() || 'medium'}">${inc.priority || 'Medium'}</span></td>
        <td>${inc.reportedByName || 'Unknown'}</td>
        <td><span class="status-badge ${inc.status?.toLowerCase().replace(' ', '-') || 'pending'}">${inc.status || 'Pending'}</span></td>
        <td>${inc.assignedTo || 'Unassigned'}</td>
        <td>
          ${hasImage ? '<span style="margin-right:8px;cursor:pointer;" onclick="viewImage(\'' + inc.id + '\')" title="View Evidence">📎</span>' : ''}
          <button class="action-btn" onclick="openAssignModal('${inc.id}')" title="Assign Officer"><i class="fas fa-user-plus"></i></button>
          <button class="action-btn" onclick="openUpdateModal('${inc.id}')" title="Update Status"><i class="fas fa-sync-alt"></i></button>
          <button class="action-btn" onclick="showIncidentDetail('${inc.id}')" title="View Details"><i class="fas fa-eye"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function populateOfficerSelect() {
  const select = document.getElementById('assign-officer-select');
  if (!select) return;
  const officers = (await DB.getUsers()).filter(u => u.role === 'security' && u.active);
  select.innerHTML = '<option value="">Choose an officer...</option>' + officers.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
}

function openAssignModal(incidentId) { currentIncidentId = incidentId; document.getElementById('assign-incident-id').textContent = incidentId; openModal('assign-modal'); }
function openUpdateModal(incidentId) { currentIncidentId = incidentId; document.getElementById('update-incident-id').textContent = incidentId; openModal('update-modal'); }

async function assignOfficer() {
  const officer = document.getElementById('assign-officer-select')?.value;
  if (!officer || !currentIncidentId) return;
  await DB.updateIncident(currentIncidentId, { assignedTo: officer, updatedBy: (await DB.getCurrentUser())?.name });
  closeModal('assign-modal');
  loadSecurityDashboard();
  alert('Officer assigned!');
}

async function loadAdminDashboard() {
  const user = await DB.getCurrentUser();
  if (!user) return;

  document.getElementById('admin-name').textContent = user.name;
  document.getElementById('admin-avatar').textContent = getInitials(user.name);

  const stats = await DB.getStats();
  const mappings = [
    ['admin-total-users', stats.totalUsers],
    ['admin-total-reports', stats.totalIncidents],
    ['admin-active-officers', stats.activeOfficers],
    ['admin-resolution-rate', stats.resolutionRate + '%']
  ];
  mappings.forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });

  renderAdminUsersList();
}

async function renderAdminUsersList() {
  console.log('🔍 renderAdminUsersList called');
  
  const container = document.getElementById('admin-users-list');
  if (!container) {
    console.error('❌ Container not found');
    return;
  }

  const users = await DB.getUsers();
  const currentUser = await DB.getCurrentUser();
  
  console.log('📊 Total users:', users?.length || 0);
  console.log('Users:', users);

  // Convert to array and normalize data
  const safeUsers = Array.isArray(users) ? users : [];

  if (safeUsers.length === 0) {
    container.innerHTML = '<p style="padding:2rem;text-align:center;color:#6b7280;">No users found</p>';
    return;
  }

  container.innerHTML = safeUsers.map(user => {
    // DEBUG: Log each user's approval status
    console.log('\n👤 Checking user:', user.name);
    console.log('  - user.approved:', user.approved);
    console.log('  - typeof user.approved:', typeof user.approved);
    console.log('  - user.role:', user.role);
    
    // EXPLICIT checks - handle all possible values
    const isApproved = user.approved === true;
    const isPending = user.approved === false || user.approved === undefined || user.approved === null;
    const isNotAdmin = user.role !== 'admin';
    const shouldShowButtons = isPending && isNotAdmin;
    
    console.log('  - isApproved:', isApproved);
    console.log('  - isPending:', isPending);
    console.log('  - isNotAdmin:', isNotAdmin);
    console.log('  - shouldShowButtons:', shouldShowButtons);
    
    return `
      <div class="user-list-item" style="border-left: 4px solid ${shouldShowButtons ? '#10B981' : '#9333EA'}; padding-left: 1rem;">
        <div class="user-list-info">
          <div class="user-list-avatar">${getInitials(user.name)}</div>
          <div>
            <strong>${user.name}</strong>
            <span class="text-sm text-gray block">${user.email} • ${user.role}</span>
            ${isPending ? '<span class="status-badge pending" style="margin-top:0.25rem; display:inline-block;">⏳ Pending Approval</span>' : '<span class="status-badge resolved" style="margin-top:0.25rem; display:inline-block;">✅ Approved</span>'}
          </div>
        </div>
        <div class="flex gap-2 items-center" style="margin-top: 0.75rem;">
          ${shouldShowButtons ? `
            <button class="btn btn-primary btn-sm" onclick="approveUser('${user.id}')" style="background: #10B981; border: none;">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn-outline btn-sm" onclick="rejectUser('${user.id}')" style="border-color: #EF4444; color: #EF4444;">
              <i class="fas fa-times"></i> Reject
            </button>
          ` : '<span style="color: #9CA3AF; font-size: 12px;">' + (isApproved ? '✓ Approved' : '—') + '</span>'}
          ${user.role !== 'admin' ? `<button class="btn btn-outline btn-sm" onclick="openEditUserModal('${user.id}')"><i class="fas fa-edit"></i></button>` : ''}
          ${user.id !== currentUser?.id ? `<button class="btn btn-delete btn-sm" onclick="confirmDeleteUser('${user.id}', '${user.name}')"><i class="fas fa-trash"></i></button>` : ''}
          <label class="toggle-switch"><input type="checkbox" ${user.active ? 'checked' : ''} onchange="toggleUserStatus('${user.id}', this.checked)"><span class="toggle-slider"></span></label>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('✅ User list rendered');
}
async function approveUser(userId) {
  const result = await DB.approveUser(userId);
  if (result.success) { renderAdminUsersList(); loadAdminDashboard(); alert('User approved!'); }
  else alert(result.message);
}

async function rejectUser(userId) {
  if (confirm('Delete this user?')) {
    const result = await DB.rejectUser(userId);
    if (result.success) { renderAdminUsersList(); loadAdminDashboard(); alert('User removed.'); }
  }
}

async function toggleUserStatus(userId, active) {
  await DB.updateUser(userId, { active });
  alert(`User ${active ? 'activated' : 'deactivated'}!`);
}

function showAdminSection(section) {
  console.log('📊 Switching admin section to:', section);
  
  ['dashboard', 'users', 'settings', 'analytics', 'security'].forEach(s => {
    const el = document.getElementById('admin-' + s + '-view');
    if (el) {
      el.classList.add('hidden');
      console.log('Hidden: admin-' + s + '-view');
    }
  });

  const target = document.getElementById('admin-' + section + '-view');
  if (target) {
    target.classList.remove('hidden');
    console.log('✅ Showing: admin-' + section + '-view');
    
    if (section === 'users') {
      renderAdminUsersList();
    } else if (section === 'settings') {
      loadSettings();
    } else if (section === 'dashboard') {
      loadAdminDashboard();
    } else if (section === 'analytics') {
      setTimeout(() => {
        console.log('📊 Initializing admin analytics charts...');
        if (typeof initAdminAnalyticsCharts === 'function') {
          initAdminAnalyticsCharts();
          console.log('✅ Admin analytics charts initialized');
        }
      }, 300);
    }
  }

  document.querySelectorAll('#admin-dashboard .nav-menu a').forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`#admin-dashboard .nav-menu a[onclick*="${section}"]`);
  if (active) active.classList.add('active');
}

async function showIncidentDetail(incidentId) {
  console.log('🔍 showIncidentDetail called for:', incidentId);
  
  const incident = await DB.getIncidentById(incidentId);
  console.log('📊 Incident:', incident);
  console.log('📊 Timeline:', incident?.timeline);
  
  if (!incident) {
    console.error('❌ Incident not found:', incidentId);
    return;
  }

  // ✅ Fix 1: Validate image evidence
  const hasImage = incident.evidence?.data || incident.evidence;
  const imageData = incident.evidence?.data || incident.evidence;
  const imageName = incident.evidence?.name || 'Evidence';
  const imageSize = incident.evidence?.size || 0;

  // ✅ Fix 2: Validate coordinates BEFORE using them
  const lat = incident.lat !== undefined && incident.lat !== null ? parseFloat(incident.lat) : null;
  const lng = incident.lng !== undefined && incident.lng !== null ? parseFloat(incident.lng) : null;
  const hasValidLocation = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
  
  console.log('📍 Location check:', { lat, lng, hasValidLocation });

  document.getElementById('detail-modal-content').innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h2>${incident.id}</h2>
      <span class="status-badge ${incident.status.toLowerCase().replace(' ', '-')}">${incident.status}</span>
    </div>
    <p class="text-gray mb-2">
      Reported on ${formatDate(incident.createdAt)} • 
      <strong>${incident.location || 'N/A'}</strong>
    </p>
    
    <div class="form-grid mt-3">
      <div>
        <label class="text-sm text-gray">Type</label>
        <p><strong>${incident.type}</strong></p>
      </div>
      <div>
        <label class="text-sm text-gray">Priority</label>
        <p><span class="priority-badge ${incident.priority?.toLowerCase() || 'medium'}">${incident.priority || 'Medium'}</span></p>
      </div>
      <div>
        <label class="text-sm text-gray">Reported By</label>
        <p><strong>${incident.reportedByName || 'Unknown'}</strong></p>
      </div>
      <div>
        <label class="text-sm text-gray">Assigned To</label>
        <p><strong>${incident.assignedTo || 'Unassigned'}</strong></p>
      </div>
    </div>
    
    <div class="mt-3">
      <label class="text-sm text-gray">Description</label>
      <p class="mt-1">${incident.description || 'No description provided'}</p>
    </div>
    
    ${hasImage ? `
    <div class="mt-3">
      <label class="text-sm text-gray">Evidence</label>
      <div style="margin-top:8px;">
        <div style="position:relative;display:inline-block;">
          <img src="${imageData}" alt="${imageName}" style="max-width:200px;max-height:150px;border-radius:8px;cursor:pointer;" onclick="viewImage('${incident.id}')">
          <div style="position:absolute;bottom:8px;right:8px;background:rgba(147,51,234,0.9);color:white;padding:4px 8px;border-radius:4px;font-size:12px;cursor:pointer;" onclick="viewImage('${incident.id}')">👁️ View</div>
        </div>
        <p style="margin-top:8px;font-size:13px;color:#6b7280;">📄 ${imageName} • ${imageSize ? (imageSize/1024).toFixed(2) + ' KB' : 'Unknown size'}</p>
      </div>
    </div>` : ''}
    
    ${hasValidLocation ? `
    <div class="mt-3">
      <label class="text-sm text-gray">📍 Location</label>
      <div style="margin-top:8px;padding:12px;background:#f3e8ff;border-radius:8px;">
        <p style="font-size:14px;color:#6b21a8;">
          <strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}
        </p>
        <div style="width:100%;height:200px;border-radius:6px;overflow:hidden;margin-top:8px;">
          <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lng}" width="100%" height="100%" frameborder="0" style="border:0"></iframe>
        </div>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#9333EA;color:white;border-radius:6px;text-decoration:none;font-size:13px;">🗺️ Open in Google Maps</a>
      </div>
    </div>` : '<div class="mt-3"><label class="text-sm text-gray">📍 Location</label><p class="text-gray mt-1" style="font-size:13px;">' + (incident.lat || incident.lng ? '⚠️ Invalid coordinates' : 'No GPS coordinates') + '</p></div>'}
    
        <div class="mt-3">
      <h4 class="mb-2" style="font-size:16px;font-weight:600;color:#1F2937;">
        📋 Activity Timeline 
        <span style="font-size:13px;color:#6B7280;font-weight:normal;">
          (${Array.isArray(incident.timeline) ? incident.timeline.length : 0} updates)
        </span>
      </h4>
      
      ${Array.isArray(incident.timeline) && incident.timeline.length > 0 ? `
        <div class="timeline" style="margin-left:0.5rem;">
          ${incident.timeline.map((t, index) => {
            console.log(`🔍 Timeline entry ${index}:`, t);
            
            // Check for comment/notes in ANY field
            const noteText = t.notes?.trim() || t.comment?.trim() || t.text?.trim() || t.message?.trim();
            const hasNote = !!noteText;
            
            // Determine entry type for styling
            const actionLower = (t.action || '').toLowerCase();
            const isComment = actionLower.includes('comment') || t.type === 'comment';
            const isStatusChange = actionLower.includes('status');
            const isAssignment = actionLower.includes('assign');
            const isSubmission = actionLower.includes('submit');
            
            // Style based on type
            let bgStyle = 'background:#F9FAFB;';
            let borderStyle = 'border-left:4px solid #E5E7EB;';
            let icon = '📝';
            let titleColor = '#1F2937';
            
            if (isComment) {
              bgStyle = 'background:#F3E8FF;';
              borderStyle = 'border-left:4px solid #9333EA;';
              icon = '💬';
              titleColor = '#7C3AED';
            } else if (isStatusChange) {
              bgStyle = 'background:#DBEAFE;';
              borderStyle = 'border-left:4px solid #3B82F6;';
              icon = '🔄';
              titleColor = '#2563EB';
            } else if (isAssignment) {
              bgStyle = 'background:#D1FAE5;';
              borderStyle = 'border-left:4px solid #10B981;';
              icon = '👮';
              titleColor = '#059669';
            } else if (isSubmission) {
              bgStyle = 'background:#FEF3C7;';
              borderStyle = 'border-left:4px solid #F59E0B;';
              icon = '📤';
              titleColor = '#D97706';
            }
            
            return `
              <div class="timeline-item" style="margin-bottom:1rem;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="font-size:12px;color:#6B7280;">
                    <i class="far fa-clock"></i> ${formatDate(t.date)}
                  </span>
                  ${t.user ? `<span style="font-size:12px;color:#9CA3AF;">• by ${t.user}</span>` : ''}
                </div>
                <div style="${bgStyle} ${borderStyle} padding:12px;border-radius:6px;">
                  <p style="margin:0;font-size:14px;color:${titleColor};">
                    <strong>${icon}</strong> ${t.action || 'Updated'}
                  </p>
                  ${hasNote ? `
                    <div style="margin-top:10px;padding:10px;background:#FFFFFF;border-radius:4px;font-size:13px;color:#374151;border-left:3px solid #9333EA;">
                      <strong>💬 Comment:</strong> ${noteText}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="padding:40px;text-align:center;color:#9CA3AF;">
          <i class="fas fa-history" style="font-size:48px;margin-bottom:16px;display:block;opacity:0.3;"></i>
          <p>No activity yet. Incident just created.</p>
        </div>
      `}
    </div>
  `;
  
  console.log('✅ Detail modal content rendered');
  openModal('detail-modal');
}

async function viewImage(incidentId) {
  console.log('🖼️ viewImage called for:', incidentId);
  
  try {
    const incident = await DB.getIncidentById(incidentId);
    console.log('📊 Incident:', incident);
    console.log('📊 Evidence:', incident?.evidence);
    
    if (!incident) {
      alert('❌ Incident not found');
      return;
    }
    
    // Get image data from evidence
    let imageData = null;
    let fileName = 'Evidence';
    let fileSize = 0;
    let fileType = 'image/png';
    
    if (incident.evidence?.data) {
      imageData = incident.evidence.data;
      fileName = incident.evidence.name || 'Evidence';
      fileSize = incident.evidence.size || 0;
      fileType = incident.evidence.type || 'image/png';
    } else if (typeof incident.evidence === 'string') {
      imageData = incident.evidence;
    }
    
    if (!imageData) {
      alert('❌ No image found for this incident');
      return;
    }
    
    console.log('✅ Image data found:', { fileName, fileSize: (fileSize/1024).toFixed(2) + ' KB' });
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
      <div style="background:white;border-radius:12px;max-width:900px;width:90%;padding:20px;position:relative;max-height:90vh;overflow-y:auto;">
        <button onclick="this.closest('.modal-overlay').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:28px;cursor:pointer;color:#6B7280;">✕</button>
        <h3 style="margin-bottom:16px;color:#1F2937;">📄 Evidence - ${incident.id}</h3>
        
        <div style="text-align:center;">
          <img src="${imageData}" alt="${fileName}" style="max-width:100%;max-height:600px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          
          <div style="margin-top:16px;padding:16px;background:#F9FAFB;border-radius:8px;text-align:left;">
            <p style="margin:8px 0;"><strong>📄 File:</strong> ${fileName}</p>
            <p style="margin:8px 0;"><strong>📊 Type:</strong> ${fileType}</p>
            <p style="margin:8px 0;"><strong>📏 Size:</strong> ${(fileSize/1024).toFixed(2)} KB</p>
            <p style="margin:8px 0;"><strong>📅 Uploaded:</strong> ${incident.createdAt ? new Date(incident.createdAt).toLocaleString() : 'Unknown'}</p>
            <p style="margin:8px 0;"><strong>🔒 Report Type:</strong> ${incident.anonymous ? 'Anonymous' : 'Regular'}</p>
          </div>
          
          <a href="${imageData}" download="${fileName}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#9333EA;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
            <i class="fas fa-download"></i> Download Image
          </a>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
  } catch (error) {
    console.error('❌ Error viewing image:', error);
    alert('❌ Error loading image: ' + error.message);
  }
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) {
    const isOpening = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    
    if (isOpening) {
      updateNotifBadge();
      loadNotifMessages();
      console.log('🔔 Notification dropdown opened, badge updated');
    }
  }
}

async function loadNotifMessages() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  
  const user = await DB.getCurrentUser();
  if (!user) {
    list.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">Not logged in</div>';
    return;
  }
  
  const incidents = await DB.getIncidents();
  const clearedIds = JSON.parse(localStorage.getItem('secureReport_cleared_notifs_' + user.id) || '[]');
  
  const userIncidents = Array.isArray(incidents) ? incidents.filter(i => {
    return i.reportedBy === user.id && !clearedIds.includes(i.id);
  }) : [];
  
  if (userIncidents.length === 0) {
    list.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">All caught up! ✅</div>';
    return;
  }
  
  userIncidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  list.innerHTML = userIncidents.slice(0, 10).map(inc => {
    const statusColor = inc.status === 'Resolved' ? '#10B981' : inc.status === 'In Progress' ? '#3B82F6' : '#F59E0B';
    return `
      <div style="padding:16px;border-bottom:1px solid #f3f4f6;cursor:pointer;" onclick="viewMyIncident('${inc.id}')">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <strong style="font-size:14px;">${inc.id}</strong>
          <span style="font-size:11px;padding:4px 8px;background:${statusColor}20;color:${statusColor};border-radius:12px;">${inc.status}</span>
        </div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">${inc.type} - ${inc.location}</div>
        <div style="font-size:12px;color:#9ca3af;">📅 ${formatDate(inc.createdAt)}</div>
      </div>
    `;
  }).join('');
}

function viewMyIncident(incidentId) {
  toggleNotifDropdown();
  showStudentSection('track');
  setTimeout(() => {
    const select = document.getElementById('student-track-select');
    if (select) { select.value = incidentId; loadStudentTrack(); }
  }, 100);
}

function clearNotifications() {
  const user = DB.getCurrentUser();
  if (!user) return;
  
  const list = document.getElementById('notif-list');
  if (list) {
    list.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">All caught up! ✅</div>';
  }
  
  const headerBadge = document.getElementById('header-notif-badge');
  if (headerBadge) {
    headerBadge.style.display = 'none';
  }
  
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
  
  console.log('🔔 Notification bell cleared');
  
  const feedback = document.createElement('div');
  feedback.style.cssText = 'position:fixed;top:20px;right:20px;background:#10B981;color:white;padding:12px 20px;border-radius:8px;z-index:9999;animation:fadeIn 0.3s ease;';
  feedback.innerHTML = '✅ Notifications cleared';
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.style.opacity = '0';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
  
  setTimeout(() => {
    updateNotifBadge();
  }, 2000);
}

async function updateNotifBadge() {
  const incidents = await DB.getIncidents();
  const userId = (await DB.getCurrentUser())?.id;
  
  if (!userId) {
    const headerBadge = document.getElementById('header-notif-badge');
    if (headerBadge) headerBadge.style.display = 'none';
    return;
  }
  
  const clearedIds = JSON.parse(localStorage.getItem('secureReport_cleared_notifs_' + userId) || '[]');
  const allUserIncidents = Array.isArray(incidents) ? incidents.filter(i => i.reportedBy === userId) : [];
  const unreadIncidents = allUserIncidents.filter(i => !clearedIds.includes(i.id));
  const count = unreadIncidents.length;
  
  console.log('🔔 Badge update - Total:', allUserIncidents.length, 'Unread:', count);
  
  const headerBadge = document.getElementById('header-notif-badge');
  if (headerBadge) {
    if (count > 0) {
      headerBadge.textContent = count > 99 ? '99+' : count;
      headerBadge.style.display = 'flex';
      headerBadge.classList.add('updated');
      setTimeout(() => headerBadge.classList.remove('updated'), 500);
    } else {
      headerBadge.style.display = 'none';
    }
  }
  
  return { total: allUserIncidents.length, unread: count };
}

function getInitials(name) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'; }
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function getLocation(prefix) {
  const btn = event.target;
  const original = btn.innerHTML;
  if (!navigator.geolocation) { alert('Geolocation not supported'); return; }

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
        preview.innerHTML = `<div style="width:100%;height:200px;border-radius:8px;overflow:hidden;"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}" width="100%" height="100%" frameborder="0" style="border:0"></iframe></div><p style="margin-top:8px;font-size:13px;">📍 Accuracy: ${Math.round(accuracy)}m • <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:#9333EA;">Open in Google Maps</a></p>`;
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

async function submitAnonymousReport() {
  console.log('📝 submitAnonymousReport called');
  
  const lat = document.getElementById('anon-lat')?.value || null;
  const lng = document.getElementById('anon-lng')?.value || null;
  const fileInput = document.getElementById('anon-file');
  
  // Handle file upload if exists
  let evidenceData = null;
  
  if (fileInput?.files?.[0]) {
    const file = fileInput.files[0];
    console.log('📎 Processing anonymous report file:', file.name, file.type, file.size);
    
    // Read file as base64
    const imageData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    evidenceData = {
      data: imageData,
      name: file.name,
      type: file.type,
      size: file.size
    };
    console.log('✅ Evidence processed:', evidenceData.name, (evidenceData.size/1024).toFixed(2), 'KB');
  }
  
  const incident = {
    type: document.getElementById('anon-type')?.value,
    priority: document.getElementById('anon-priority')?.value,
    location: document.getElementById('anon-location')?.value,
    datetime: document.getElementById('anon-datetime')?.value,
    description: document.getElementById('anon-description')?.value,
    reportedBy: 'anonymous',
    reportedByName: 'Anonymous',
    anonymous: true,  // ✅ CRITICAL: Mark as anonymous
    evidence: evidenceData,  // ✅ Save evidence
    lat, lng,
    createdAt: new Date().toISOString(),
    status: 'Pending',
    assignedTo: null,
    timeline: [{
      date: new Date().toISOString(),
      user: 'Anonymous',
      action: 'Report submitted'
    }]
  };
  
  console.log('📝 Creating anonymous incident:', {
    id: 'will-be-generated',
    type: incident.type,
    anonymous: incident.anonymous,
    hasEvidence: !!incident.evidence,
    evidenceName: incident.evidence?.name
  });
  
  const result = await DB.addIncident(incident);
  
  if (result.success) {
    console.log('✅ Anonymous incident created:', result.incident.id);
    
    // Save the incident ID to localStorage
    localStorage.setItem('secureReport_lastAnonymousIncident', result.incident.id);
    localStorage.setItem('secureReport_lastAnonymousIncidentTime', new Date().toISOString());
    
    // Show success message with incident ID
    alert(`✅ Report submitted successfully!\n\n📋 Incident ID: ${result.incident.id}\n\n⚠️ SAVE THIS ID to track your report status!`);
    
    // Navigate to tracking page
    navigateTo('anonymous-track');
    
    // Auto-fill the tracking field
    setTimeout(() => {
      const trackInput = document.getElementById('track-id');
      if (trackInput) {
        trackInput.value = result.incident.id;
        trackAnonymousReport();
      }
    }, 300);
    
    // Clear form
    ['anon-type', 'anon-location', 'anon-datetime', 'anon-description', 'anon-lat', 'anon-lng'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('anon-map-preview');
    if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
    const filePreview = document.getElementById('anon-preview');
    if (filePreview) { filePreview.innerHTML = ''; filePreview.classList.add('hidden'); }
    
  } else {
    console.error('❌ Failed to submit report:', result);
    alert('❌ Failed to submit report: ' + (result.message || 'Unknown error'));
  }
}

async function trackAnonymousReport() {
  console.log('🔍 trackAnonymousReport called');
  
  const incidentId = document.getElementById('track-id')?.value?.trim();
  console.log('Searching for incident ID:', incidentId);
  
  if (!incidentId) {
    alert('Please enter an Incident ID');
    return;
  }
  
  try {
    // Get all incidents and find the anonymous one
    const incidents = await DB.getIncidents();
    console.log('📊 Total incidents:', incidents?.length || 0);
    
    // Find the specific incident by ID
    const incident = incidents.find(i => i.id === incidentId);
    console.log('🔍 Found incident:', incident);
    
    if (!incident) {
      console.error('❌ Incident not found:', incidentId);
      alert('❌ Incident not found: ' + incidentId + '\n\nPlease check the ID and try again.');
      return;
    }
    
    // Verify it's an anonymous report
    if (!incident.anonymous) {
      alert('⚠️ This is not an anonymous report. Please login to view this incident.');
      return;
    }
    
    console.log('✅ Anonymous incident found:', {
      id: incident.id,
      status: incident.status,
      type: incident.type,
      createdAt: incident.createdAt
    });
    
    // Display the tracking information
    const resultBox = document.getElementById('track-result');
    const trackIdDisplay = document.getElementById('track-id-display');
    const trackTypeDisplay = document.getElementById('track-type-display');
    const trackStatusDisplay = document.getElementById('track-status-display');
    const trackUpdateDisplay = document.getElementById('track-update-display');
    
    if (trackIdDisplay) trackIdDisplay.textContent = incident.id;
    if (trackTypeDisplay) trackTypeDisplay.textContent = incident.type;
    
    if (trackStatusDisplay) {
      trackStatusDisplay.innerHTML = `<span class="status-badge ${incident.status.toLowerCase().replace(' ', '-')}">${incident.status}</span>`;
    }
    
    if (trackUpdateDisplay) {
      // Get the latest update from timeline
      const latestUpdate = incident.timeline && incident.timeline.length > 0 
        ? incident.timeline[incident.timeline.length - 1]
        : null;
      
      trackUpdateDisplay.textContent = latestUpdate 
        ? `${formatDate(latestUpdate.date)} - ${latestUpdate.action}`
        : formatDate(incident.createdAt);
    }
    
    // Show the result box
    if (resultBox) {
      resultBox.classList.add('visible');
      resultBox.style.display = 'block';
      
      // Add timeline details if available
      if (incident.timeline && incident.timeline.length > 0) {
        const timelineHTML = incident.timeline.map(t => `
          <div style="margin-top:12px;padding:10px;background:#F9FAFB;border-radius:6px;border-left:3px solid #9333EA;">
            <div style="font-size:12px;color:#6B7280;margin-bottom:4px;">
              <i class="far fa-clock"></i> ${formatDate(t.date)}
            </div>
            <p style="margin:0;font-size:13px;color:#1F2937;">
              <strong>${t.user || 'System'}</strong>: ${t.action || 'Updated'}
            </p>
            ${t.notes ? `<p style="margin-top:6px;font-size:12px;color:#6B7280;">📝 ${t.notes}</p>` : ''}
          </div>
        `).join('');
        
        resultBox.innerHTML += `
          <div style="margin-top:20px;">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#1F2937;">📋 Activity Timeline</h4>
            ${timelineHTML}
          </div>
        `;
      }
    }
    
    // Scroll to result
    resultBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    console.log('✅ Tracking information displayed');
    
  } catch (error) {
    console.error('❌ Error tracking incident:', error);
    alert('❌ Error: ' + error.message);
  }
}

async function loadSettings() {
  const s = await DB.getSettings();
  const fields = {
    'setting-system-name': s.systemName, 'setting-email-notif': s.emailNotifications,
    'setting-anonymous': s.anonymousReports, 'setting-retention': s.dataRetention,
    'setting-maps-key': s.mapsApiKey, 'setting-maintenance': s.maintenanceMode,
    'setting-support-email': s.supportEmail
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val || '';
    }
  });
}

async function saveSettings() {
  const settings = {
    systemName: document.getElementById('setting-system-name')?.value || 'SecureReport',
    emailNotifications: document.getElementById('setting-email-notif')?.value || 'all',
    anonymousReports: document.getElementById('setting-anonymous')?.value || 'enabled',
    dataRetention: parseInt(document.getElementById('setting-retention')?.value) || 365,
    mapsApiKey: document.getElementById('setting-maps-key')?.value || '',
    maintenanceMode: document.getElementById('setting-maintenance')?.checked || false,
    supportEmail: document.getElementById('setting-support-email')?.value || 'admin@securereport.com'
  };
  await DB.saveSettings(settings);
  alert('Settings saved!');
}

async function resetSettings() { await DB.resetSettings(); loadSettings(); alert('Reset to default!'); }
async function saveSecuritySettings() {
  const settings = {
    passwordPolicy: document.querySelector('#admin-security-view select')?.value || 'Standard (6+ chars)',
    sessionTimeout: document.querySelector('#admin-security-view input[type="number"]')?.value || 30,
    sqlInjectionProtection: document.getElementById('security-sql-protection')?.checked || false,
    dataEncryption: document.getElementById('security-encryption')?.checked || false
  };
  
  localStorage.setItem('secureReport_security_settings', JSON.stringify(settings));
  console.log('✅ Security settings saved:', settings);
  alert('✅ Security settings saved successfully!');
}

function previewImage(input, previewId) {
  console.log('📷 Preview image called');
  console.log('Input:', input);
  console.log('Preview ID:', previewId);
  
  const preview = document.getElementById(previewId);
  console.log('Preview element:', preview);
  
  if (!preview) {
    console.error('❌ Preview element not found:', previewId);
    return;
  }
  
  if (!input.files || !input.files[0]) {
    console.log('No file selected');
    preview.innerHTML = '';
    preview.classList.add('hidden');
    return;
  }
  
  const file = input.files[0];
  console.log('File:', file.name, file.type, file.size);
  
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    console.error('❌ Not an image file:', file.type);
    preview.innerHTML = '<p style="color:red;">Please select an image file (PNG, JPG)</p>';
    preview.classList.remove('hidden');
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    console.log('✅ File loaded successfully');
    console.log('Image data length:', e.target.result.length);
    
    // Clear previous content
    preview.innerHTML = '';
    
    // Create image element
    const img = document.createElement('img');
    img.src = e.target.result;
    img.alt = file.name;
    img.style.cssText = `
      max-width: 200px;
      max-height: 150px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      object-fit: cover;
    `;
    
    // Create file info paragraph
    const fileInfo = document.createElement('p');
    fileInfo.style.cssText = 'margin-top: 8px; font-size: 13px; color: #6B7280;';
    fileInfo.innerHTML = `
      📄 ${file.name}<br>
      📏 ${(file.size / 1024).toFixed(2)} KB
    `;
    
    // Add to preview container
    preview.appendChild(img);
    preview.appendChild(fileInfo);
    preview.classList.remove('hidden');
    
    console.log('✅ Image preview displayed');
  };
  
  reader.onerror = function(error) {
    console.error('❌ Error reading file:', error);
    preview.innerHTML = '<p style="color:red;">Error loading image. Please try again.</p>';
    preview.classList.remove('hidden');
  };
  
  console.log('Reading file as Data URL...');
  reader.readAsDataURL(file);
}

async function showSecuritySection(section) {
  console.log('📊 Switching security section to:', section);
  
  // Hide all security views first
  ['dashboard', 'analytics', 'map'].forEach(s => {
    const el = document.getElementById('security-' + s + '-view');
    if (el) {
      el.classList.add('hidden');
      console.log('Hidden: security-' + s + '-view');
    }
  });

  // Show the target section
  const target = document.getElementById('security-' + section + '-view');
  if (target) {
    target.classList.remove('hidden');
    console.log('✅ Showing: security-' + section + '-view');
    
    // Load data for each section
    if (section === 'dashboard') {
      await loadSecurityDashboard();
    } else if (section === 'analytics') {
      // Wait for DOM to be ready
      setTimeout(async () => {
        console.log('📊 Initializing security analytics charts...');
        try {
          if (typeof initSecurityAnalyticsCharts === 'function') {
            await initSecurityAnalyticsCharts();
            console.log('✅ Security analytics charts initialized');
          } else {
            console.error('❌ initSecurityAnalyticsCharts function not found');
          }
        } catch (error) {
          console.error('❌ Error initializing charts:', error);
        }
      }, 300);
    } else if (section === 'map') {
      // Wait for DOM to be ready
      setTimeout(async () => {
        console.log('🗺️ Initializing security incident map...');
        try {
          if (typeof initSecurityMap === 'function') {
            await initSecurityMap();
            console.log('✅ Security incident map initialized');
          } else {
            console.error('❌ initSecurityMap function not found');
          }
        } catch (error) {
          console.error('❌ Error initializing map:', error);
        }
      }, 300);
    }
  }

  // Update active nav item
  document.querySelectorAll('#security-dashboard .nav-menu a').forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`#security-dashboard .nav-menu a[onclick*="${section}"]`);
  if (active) active.classList.add('active');
}

function confirmDeleteUser(userId, userName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal confirm-modal">
      <i class="fas fa-exclamation-triangle"></i><h3>Delete User?</h3>
      <p>Delete <strong>${userName}</strong>? This cannot be undone.</p>
      <div class="flex gap-2 justify-center">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-delete" onclick="executeDeleteUser('${userId}'); this.closest('.modal-overlay').remove();"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function executeDeleteUser(userId) {
  const currentUser = await DB.getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') { alert('Admins only'); return; }
  if (userId === currentUser.id) { alert('Cannot delete yourself'); return; }
  if ((await DB.getUserById(userId))?.role === 'admin') { alert('Cannot delete admins'); return; }

  const result = await DB.deleteUser(userId);
  if (result.success) {
    renderAdminUsersList(); loadAdminDashboard();
    const toast = document.createElement('div');
    toast.className = 'alert-box success fade-in';
    toast.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;padding:12px 20px;background:#D1FAE5;color:#065F46;border-radius:8px;';
    toast.innerHTML = '✅ User deleted';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

async function openEditUserModal(userId) {
  const user = await DB.getUserById(userId);
  if (!user) return;
  ['edit-user-id', 'edit-user-name', 'edit-user-email', 'edit-user-role'].forEach((id, i) => {
    const el = document.getElementById(id);
    const val = [user.id, user.name, user.email, user.role][i];
    if (el) el.value = val;
  });
  openModal('edit-user-modal');
}

async function saveEditUser() {
  const userId = document.getElementById('edit-user-id')?.value;
  if (!userId) return;
  await DB.updateUser(userId, {
    name: document.getElementById('edit-user-name')?.value,
    email: document.getElementById('edit-user-email')?.value,
    role: document.getElementById('edit-user-role')?.value
  });
  closeModal('edit-user-modal');
  renderAdminUsersList();
  alert('User updated!');
}

async function addNewUser() {
  const currentUser = await DB.getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') { alert('Admins only'); return; }

  const user = {
    name: document.getElementById('add-user-name')?.value,
    email: document.getElementById('add-user-email')?.value,
    role: document.getElementById('add-user-role')?.value,
    id: document.getElementById('add-user-id')?.value,
    password: document.getElementById('add-user-password')?.value,
    department: 'Staff'
  };

  if ((user.role === 'admin' || user.role === 'security') && currentUser.role !== 'admin') {
    alert('Only admins can create staff accounts'); return;
  }

  const result = await DB.addUser(user);
  if (result.success) {
    closeModal('add-user-modal');
    renderAdminUsersList(); loadAdminDashboard();
    alert('User added!');
    ['add-user-name', 'add-user-email', 'add-user-id', 'add-user-password'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } else alert(result.message);
}

async function addIncidentComment(incidentId, commentText) {
  const incident = await DB.getIncidentById(incidentId);
  if (!incident) return;
  await DB.updateIncident(incidentId, {
    timeline: [...(incident.timeline||[]), {
      date: new Date().toISOString(), action: 'Added comment',
      user: (await DB.getCurrentUser())?.name, comment: commentText, notes: commentText
    }]
  });
  loadSecurityDashboard();
}

function openAddCommentModal() {
  document.getElementById('comment-incident-id').textContent = currentIncidentId;
  document.getElementById('comment-text').value = '';
  openModal('comment-modal');
}

async function submitComment() {
  console.log('💬 submitComment called');
  
  const text = document.getElementById('comment-text')?.value?.trim();
  console.log('Comment text:', text);
  
  if (!text) {
    alert('Please enter a comment');
    return;
  }
  
  if (!currentIncidentId) {
    alert('No incident selected');
    return;
  }
  
  try {
    // Get current incident
    const incident = await DB.getIncidentById(currentIncidentId);
    console.log('📊 Current incident:', incident);
    
    if (!incident) {
      alert('Incident not found');
      return;
    }
    
    // Get current user
    const currentUser = await DB.getCurrentUser();
    console.log('👤 Current user:', currentUser);
    
    // Ensure timeline is an array
    const currentTimeline = Array.isArray(incident.timeline) ? incident.timeline : [];
    console.log('📋 Current timeline entries:', currentTimeline.length);
    
    // Create new timeline entry with MULTIPLE field names for compatibility
    const newEntry = {
      date: new Date().toISOString(),
      user: currentUser?.name || 'Security Staff',
      userId: currentUser?.id || 'unknown',
      action: 'Added comment/update',
      notes: text,           // ✅ Primary field
      comment: text,         // ✅ Backup field for compatibility
      type: 'comment'        // ✅ Type identifier
    };
    
    console.log('📝 New timeline entry:', newEntry);
    
    // Combine timelines
    const updatedTimeline = [...currentTimeline, newEntry];
    console.log('📊 Updated timeline length:', updatedTimeline.length);
    
    // Update incident with NEW timeline
    const result = await DB.updateIncident(currentIncidentId, {
      timeline: updatedTimeline
    });
    
    console.log('✅ DB.updateIncident result:', result);
    
    if (result.success) {
      // Close modal
      closeModal('comment-modal');
      
      // Clear comment field
      const commentInput = document.getElementById('comment-text');
      if (commentInput) commentInput.value = '';
      
      alert('✅ Comment added successfully!');
      
      // Refresh the incident detail view after short delay
      setTimeout(async () => {
        console.log('🔄 Refreshing incident detail view...');
        await showIncidentDetail(currentIncidentId);
      }, 300);
      
    } else {
      console.error('❌ Update failed:', result);
      alert('❌ Failed to add comment: ' + (result.message || 'Unknown error'));
    }
    
  } catch (error) {
    console.error('❌ Error in submitComment:', error);
    alert('❌ Error: ' + error.message);
  }
}

function filterUsers() {
  const search = document.getElementById('admin-user-search')?.value.toLowerCase();
  const items = document.querySelectorAll('#admin-users-list .user-list-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(search) ? 'flex' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  if (typeof initTheme === 'function') initTheme();
});

// Listen for storage changes (real-time updates across tabs)
window.addEventListener('storage', (e) => {
  if (e.key?.startsWith('secureReport_notif_count_')) {
    console.log('🔔 Storage change detected, updating badge');
    updateNotifBadge();
  }
  if (e.key === 'secureReport_incidents') {
    console.log('🔔 Incidents changed, updating badge');
    updateNotifBadge();
  }
});

// Poll for incident changes every 3 seconds
let lastIncidentCount = null;
setInterval(async () => {
  const user = await DB.getCurrentUser();
  if (!user) return;
  
  const incidents = await DB.getIncidents();
  const userIncidents = Array.isArray(incidents) ? incidents.filter(i => i.reportedBy === user.id) : [];
  const currentCount = userIncidents.length;
  
  if (lastIncidentCount !== null && currentCount !== lastIncidentCount) {
    console.log('🔔 Poll detected change:', lastIncidentCount, '→', currentCount);
    updateNotifBadge();
  }
  lastIncidentCount = currentCount;
}, 3000);

// Initialize poll counter on page load
document.addEventListener('DOMContentLoaded', async () => {
  const user = await DB.getCurrentUser();
  if (user) {
    const incidents = await DB.getIncidents();
    lastIncidentCount = Array.isArray(incidents) ? incidents.filter(i => i.reportedBy === user.id).length : 0;
  }
});

async function markAsRead(incidentId) {
  const user = await DB.getCurrentUser();
  if (!user) return;
  
  const clearedIds = JSON.parse(localStorage.getItem('secureReport_cleared_notifs_' + user.id) || '[]');
  
  if (!clearedIds.includes(incidentId)) {
    clearedIds.push(incidentId);
    localStorage.setItem('secureReport_cleared_notifs_' + user.id, JSON.stringify(clearedIds));
    updateNotifBadge();
    console.log('✅ Marked as read:', incidentId);
  }
}

function debugDashboard() {
  const user = DB.getCurrentUser();
  const incidents = DB.getIncidents();
  
  console.log('🔍 DASHBOARD DEBUG:', {
    currentUser: user,
    userId: user?.id,
    totalIncidents: Array.isArray(incidents) ? incidents.length : 0,
    userIncidents: Array.isArray(incidents) ? incidents.filter(i => i.reportedBy === user?.id).length : 0,
    allIncidentDetails: Array.isArray(incidents) ? incidents.map(i => ({ id: i.id, reportedBy: i.reportedBy, status: i.status })) : []
  });
  
  alert(`User ID: ${user?.id}\nTotal Incidents: ${Array.isArray(incidents) ? incidents.length : 0}\nYour Incidents: ${Array.isArray(incidents) ? incidents.filter(i => i.reportedBy === user?.id).length : 0}`);
}

async function debugUserDataIsolation() {
  const user = await DB.getCurrentUser();
  const allIncidents = await DB.getIncidents();
  
  console.log('🔍 DATA ISOLATION DEBUG:');
  console.log('Current User:', user);
  console.log('Current User ID:', user?.id);
  console.log('Current User Email:', user?.email);
  console.log('---');
  console.log('All Incidents in System:', Array.isArray(allIncidents) ? allIncidents.length : 0);
  if (Array.isArray(allIncidents)) {
    allIncidents.forEach(inc => {
      console.log(`- ${inc.id} | reportedBy: ${inc.reportedBy} | status: ${inc.status}`);
    });
  }
  console.log('---');
  
  const myIncidents = Array.isArray(allIncidents) ? allIncidents.filter(i => i.reportedBy === user?.id) : [];
  console.log('My Incidents (by ID):', myIncidents.length);
  myIncidents.forEach(inc => {
    console.log(`- ${inc.id} | reportedBy: ${inc.reportedBy}`);
  });
  console.log('---');
  
  alert(`User ID: ${user?.id}\nTotal Incidents: ${Array.isArray(allIncidents) ? allIncidents.length : 0}\nMy Incidents: ${myIncidents.length}`);
}
// ==================== DATABASE VIEWER FUNCTIONS ====================

async function viewDatabase(table) {
  const content = document.getElementById('database-content');
  if (!content) return;
  
  content.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:32px;color:#9333EA;"></i><p style="margin-top:16px;">Loading...</p></div>';
  
  // Update stats
  updateDatabaseStats();
  
  try {
    let data;
    if (table === 'users') data = await DB.getUsers();
    else if (table === 'incidents') data = await DB.getIncidents();
    else if (table === 'settings') data = await DB.getSettings();
    else if (table === 'auditLogs') data = await DB.getAuditLogs({ limit: 100 });
    else return;
    
    const dataArray = Array.isArray(data) ? data : [data];
    
    if (dataArray.length === 0) {
      content.innerHTML = '<p style="text-align:center;color:#6b7280;padding:40px;"><i class="fas fa-inbox" style="font-size:48px;color:#d1d5db;margin-bottom:16px;display:block;"></i>No data found</p>';
      return;
    }
    
    // Create table
    const headers = Object.keys(dataArray[0]);
    let html = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataArray.map(row => `
              <tr>
                ${headers.map(h => {
                  let val = row[h];
                  if (typeof val === 'object' && val !== null) {
                    val = JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '');
                  }
                  if (h === 'password') val = '********';
                  if (h === 'metadata' && typeof val === 'object') val = JSON.stringify(val).substring(0, 50) + '...';
                  return `<td>${val !== undefined && val !== null ? val : '-'}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:1rem;padding:12px;background:#f3e8ff;border-radius:6px;">
        <p style="color:#7c3aed;"><strong>📊 Total records:</strong> ${dataArray.length}</p>
      </div>
    `;
    
    content.innerHTML = html;
    
  } catch (error) {
    content.innerHTML = `<div style="text-align:center;padding:40px;color:red;"><i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:16px;display:block;"></i><p>Error: ${error.message}</p></div>`;
  }
}

async function updateDatabaseStats() {
  try {
    const stats = await DB.getDatabaseStats();
    
    const usersEl = document.getElementById('db-users-count');
    const incidentsEl = document.getElementById('db-incidents-count');
    const logsEl = document.getElementById('db-logs-count');
    const storageEl = document.getElementById('db-storage-size');
    
    if (usersEl) usersEl.textContent = stats.users;
    if (incidentsEl) incidentsEl.textContent = stats.incidents;
    if (logsEl) logsEl.textContent = stats.auditLogs;
    if (storageEl) storageEl.textContent = stats.storageMB > 0.01 ? `${stats.storageMB} MB` : `${stats.storageKB} KB`;
    
  } catch (error) {
    console.error('Error updating database stats:', error);
  }
}

async function exportDatabase() {
  try {
    const data = await DB.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureReport_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    await DB.logAudit('system', 'DATA_EXPORTED', (await DB.getCurrentUser())?.id || 'system', 'Database exported to JSON file');
    
    alert('✅ Database exported successfully!');
    
  } catch (error) {
    alert('❌ Export failed: ' + error.message);
  }
}

async function clearDatabase() {
  if (!confirm('⚠️ WARNING: This will delete ALL data (users, incidents, settings)!\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) return;
  
  const confirmText = prompt('Type "DELETE" to confirm:');
  if (confirmText !== 'DELETE') {
    alert('❌ Operation cancelled');
    return;
  }
  
  try {
    await DB.clearAllData();
    await DB.logAudit('system', 'DATABASE_CLEARED', 'system', 'All database data cleared by admin');
    
    alert('✅ Database cleared! Refreshing...');
    location.reload();
    
  } catch (error) {
    alert('❌ Clear failed: ' + error.message);
  }
}

// ==================== AUDIT LOG FUNCTIONS ====================

let currentAuditFilter = 'all';

async function loadAuditLogs(filter = 'all') {
  const content = document.getElementById('audit-logs-content');
  if (!content) return;
  
  content.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:32px;color:#9333EA;"></i><p style="margin-top:16px;">Loading audit logs...</p></div>';
  
  try {
    const filters = filter !== 'all' ? { category: filter } : {};
    const logs = await DB.getAuditLogs({ ...filters, limit: 200 });
    
    if (logs.length === 0) {
      content.innerHTML = '<p style="text-align:center;color:#6b7280;padding:40px;"><i class="fas fa-history" style="font-size:48px;color:#d1d5db;margin-bottom:16px;display:block;"></i>No audit logs found</p>';
      return;
    }
    
    const categoryColors = {
      login: '#3B82F6',
      incident: '#10B981',
      user: '#8B5CF6',
      settings: '#F59E0B',
      system: '#6B7280'
    };
    
    const actionIcons = {
      LOGIN_SUCCESS: 'fa-sign-in-alt',
      LOGIN_FAILED: 'fa-times-circle',
      LOGOUT: 'fa-sign-out-alt',
      INCIDENT_CREATED: 'fa-plus-circle',
      INCIDENT_UPDATED: 'fa-edit',
      INCIDENT_DELETED: 'fa-trash',
      INCIDENT_STATUS_CHANGED: 'fa-sync-alt',
      INCIDENT_ASSIGNED: 'fa-user-plus',
      USER_CREATED: 'fa-user-plus',
      USER_UPDATED: 'fa-user-edit',
      USER_DELETED: 'fa-user-times',
      USER_APPROVED: 'fa-check-circle',
      USER_REJECTED: 'fa-times-circle',
      USER_SIGNUP: 'fa-user-plus',
      SETTINGS_UPDATED: 'fa-cog',
      SETTINGS_RESET: 'fa-undo',
      DATABASE_INIT: 'fa-database',
      DATABASE_CLEARED: 'fa-trash-alt',
      DATA_EXPORTED: 'fa-download',
      AUDIT_CLEARED: 'fa-eraser'
    };
    
    let html = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Category</th>
              <th>Action</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr style="border-left:4px solid ${categoryColors[log.category] || '#6B7280'};">
                <td style="white-space:nowrap;">${formatDate(log.timestamp)}</td>
                <td>
                  <span style="padding:4px 8px;background:${categoryColors[log.category] || '#6B7280'}20;color:${categoryColors[log.category] || '#6B7280'};border-radius:12px;font-size:12px;font-weight:600;">
                    ${log.category}
                  </span>
                </td>
                <td>
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i class="fas ${actionIcons[log.action] || 'fa-circle'}" style="color:${categoryColors[log.category] || '#6B7280'};"></i>
                    ${log.action}
                  </span>
                </td>
                <td>${log.userId || 'system'}</td>
                <td style="max-width:400px;">${log.details}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:1rem;padding:12px;background:#f3e8ff;border-radius:6px;">
        <p style="color:#7c3aed;"><strong>📊 Total logs:</strong> ${logs.length} (showing last 200)</p>
      </div>
    `;
    
    content.innerHTML = html;
    
  } catch (error) {
    content.innerHTML = `<div style="text-align:center;padding:40px;color:red;"><i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:16px;display:block;"></i><p>Error: ${error.message}</p></div>`;
  }
}

function filterAuditLogs(filter) {
  currentAuditFilter = filter;
  loadAuditLogs(filter);
  
  // Update button states
  document.querySelectorAll('#audit-logs-page .btn-outline').forEach(btn => {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline');
  });
  event.target.classList.remove('btn-outline');
  event.target.classList.add('btn-primary');
}

function searchAuditLogs() {
  const searchTerm = document.getElementById('audit-search')?.value.toLowerCase();
  const rows = document.querySelectorAll('#audit-logs-content tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

async function exportAuditLogs() {
  try {
    const logs = await DB.getAuditLogs({ limit: 1000 });
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureReport_AuditLogs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Audit logs exported successfully!');
    
  } catch (error) {
    alert('❌ Export failed: ' + error.message);
  }
}

// Add to admin navigation
function showAdminSection(section) {
  // ... existing code ...
  
  if (section === 'audit-logs') {
    navigateTo('audit-logs-page');
    loadAuditLogs();
  }
}
// ==================== ADMIN NAVIGATION - FIXED ====================

async function showAdminSection(section) {
  console.log('📊 Switching admin section to:', section);
  
  // Hide all admin views first
  ['dashboard', 'users', 'settings', 'analytics', 'security', 'audit-logs'].forEach(s => {
    const el = document.getElementById('admin-' + s + '-view');
    if (el) {
      el.classList.add('hidden');
      console.log('Hidden: admin-' + s + '-view');
    }
  });

  // Show the target section
  const target = document.getElementById('admin-' + section + '-view');
  if (target) {
    target.classList.remove('hidden');
    console.log('✅ Showing: admin-' + section + '-view');
    
    // Load data for each section (async!)
    if (section === 'users') {
      await renderAdminUsersList();
    } else if (section === 'settings') {
      await loadSettings();
    } else if (section === 'dashboard') {
      await loadAdminDashboard();
    } else if (section === 'analytics') {
      // Small delay to ensure DOM is ready
      setTimeout(async () => {
        console.log('📊 Initializing admin analytics charts...');
        if (typeof initAdminAnalyticsCharts === 'function') {
          await initAdminAnalyticsCharts();
          console.log('✅ Admin analytics charts initialized');
        }
      }, 300);
    } else if (section === 'security') {
      // Security settings view - no async loading needed
      console.log('✅ Security settings view loaded');
    } else if (section === 'audit-logs') {
      await loadAuditLogs();
    }
  }

  // Update active nav item
  document.querySelectorAll('#admin-dashboard .nav-menu a').forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`#admin-dashboard .nav-menu a[onclick*="${section}"]`);
  if (active) active.classList.add('active');
}

// ==================== ADMIN DASHBOARD FUNCTIONS - ASYNC ====================

async function loadAdminDashboard() {
  const user = await DB.getCurrentUser();
  if (!user) {
    console.error('❌ No user logged in');
    navigateTo('login-page');
    return;
  }

  // Update user info
  const nameEl = document.getElementById('admin-name');
  const avatarEl = document.getElementById('admin-avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (avatarEl) avatarEl.textContent = getInitials(user.name);

  // Load stats (async!)
  const stats = await DB.getStats();
  const mappings = [
    ['admin-total-users', stats.totalUsers],
    ['admin-total-reports', stats.totalIncidents],
    ['admin-active-officers', stats.activeOfficers],
    ['admin-resolution-rate', stats.resolutionRate + '%']
  ];
  
  mappings.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? 0;
  });

  // Load users list
  await renderAdminUsersList();
}

async function renderAdminUsersList() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  const users = await DB.getUsers();
  const currentUser = await DB.getCurrentUser();
  const safeUsers = Array.isArray(users) ? users : [];

  if (safeUsers.length === 0) {
    container.innerHTML = '<p style="padding:2rem;text-align:center;color:#6b7280;">No users found</p>';
    return;
  }

  container.innerHTML = safeUsers.map(user => `
    <div class="user-list-item">
      <div class="user-list-info">
        <div class="user-list-avatar">${getInitials(user.name)}</div>
        <div>
          <strong>${user.name}</strong>
          <span class="text-sm text-gray block">${user.email} • ${user.role}</span>
          ${!user.approved ? '<span class="status-badge pending" style="margin-top:0.25rem;">Pending Approval</span>' : ''}
        </div>
      </div>
      <div class="flex gap-2 items-center">
        ${!user.approved && user.role === 'student' ? `
          <button class="btn btn-primary btn-sm" onclick="approveUser('${user.id}')"><i class="fas fa-check"></i> Approve</button>
          <button class="btn btn-outline btn-sm" onclick="rejectUser('${user.id}')"><i class="fas fa-times"></i> Reject</button>
        ` : ''}
        ${user.role !== 'admin' ? `<button class="btn btn-outline btn-sm" onclick="openEditUserModal('${user.id}')"><i class="fas fa-edit"></i></button>` : ''}
        ${user.id !== currentUser?.id ? `<button class="btn btn-delete btn-sm" onclick="confirmDeleteUser('${user.id}', '${user.name}')"><i class="fas fa-trash"></i></button>` : ''}
        <label class="toggle-switch"><input type="checkbox" ${user.active ? 'checked' : ''} onchange="toggleUserStatus('${user.id}', this.checked)"><span class="toggle-slider"></span></label>
      </div>
    </div>
  `).join('');
}

async function approveUser(userId) {
  const result = await DB.approveUser(userId);
  if (result.success) {
    await renderAdminUsersList();
    await loadAdminDashboard();
    alert('User approved!');
  } else {
    alert(result.message || 'Failed to approve user');
  }
}

async function rejectUser(userId) {
  if (confirm('Delete this user?')) {
    const result = await DB.rejectUser(userId);
    if (result.success) {
      await renderAdminUsersList();
      await loadAdminDashboard();
      alert('User removed.');
    }
  }
}

async function toggleUserStatus(userId, active) {
  await DB.updateUser(userId, { active });
  alert(`User ${active ? 'activated' : 'deactivated'}!`);
  await renderAdminUsersList();
}

// ==================== SETTINGS FUNCTIONS - ASYNC ====================

async function loadSettings() {
  const s = await DB.getSettings();
  const fields = {
    'setting-system-name': s.systemName,
    'setting-email-notif': s.emailNotifications,
    'setting-anonymous': s.anonymousReports,
    'setting-retention': s.dataRetention,
    'setting-maps-key': s.mapsApiKey,
    'setting-maintenance': s.maintenanceMode,
    'setting-support-email': s.supportEmail
  };
  
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val ?? '';
    }
  });
}

async function saveSettings() {
  const settings = {
    systemName: document.getElementById('setting-system-name')?.value || 'SecureReport',
    emailNotifications: document.getElementById('setting-email-notif')?.value || 'all',
    anonymousReports: document.getElementById('setting-anonymous')?.value || 'enabled',
    dataRetention: parseInt(document.getElementById('setting-retention')?.value) || 365,
    mapsApiKey: document.getElementById('setting-maps-key')?.value || '',
    maintenanceMode: document.getElementById('setting-maintenance')?.checked || false,
    supportEmail: document.getElementById('setting-support-email')?.value || 'admin@securereport.com'
  };
  
  await DB.saveSettings(settings);
  alert('Settings saved!');
}

async function resetSettings() {
  await DB.resetSettings();
  await loadSettings();
  alert('Reset to default!');
}

async function saveSecuritySettings() {
  const settings = {
    passwordPolicy: document.querySelector('#admin-security-view select')?.value || 'Standard (6+ chars)',
    sessionTimeout: document.querySelector('#admin-security-view input[type="number"]')?.value || 30,
    sqlInjectionProtection: document.getElementById('security-sql-protection')?.checked || false,
    dataEncryption: document.getElementById('security-encryption')?.checked || false
  };
  
  localStorage.setItem('secureReport_security_settings', JSON.stringify(settings));
  console.log('✅ Security settings saved:', settings);
  alert('✅ Security settings saved successfully!');
}

// ==================== USER MANAGEMENT MODALS - ASYNC ====================

async function openEditUserModal(userId) {
  const user = await DB.getUserById(userId);
  if (!user) return;
  
  ['edit-user-id', 'edit-user-name', 'edit-user-email', 'edit-user-role'].forEach((id, i) => {
    const el = document.getElementById(id);
    const val = [user.id, user.name, user.email, user.role][i];
    if (el) el.value = val ?? '';
  });
  
  openModal('edit-user-modal');
}

async function saveEditUser() {
  const userId = document.getElementById('edit-user-id')?.value;
  if (!userId) return;
  
  await DB.updateUser(userId, {
    name: document.getElementById('edit-user-name')?.value,
    email: document.getElementById('edit-user-email')?.value,
    role: document.getElementById('edit-user-role')?.value
  });
  
  closeModal('edit-user-modal');
  await renderAdminUsersList();
  alert('User updated!');
}

// ==================== ADD USER FUNCTION - FIXED ====================

async function addNewUser() {
  console.log('👤 Add User button clicked');
  
  try {
    const currentUser = await DB.getCurrentUser();
    console.log('Current user:', currentUser);
    
    if (!currentUser || currentUser.role !== 'admin') {
      alert('Only admins can create users');
      return;
    }

    // Collect form data
    const name = document.getElementById('add-user-name')?.value?.trim();
    const email = document.getElementById('add-user-email')?.value?.trim();
    const role = document.getElementById('add-user-role')?.value;
    const id = document.getElementById('add-user-id')?.value?.trim();
    const password = document.getElementById('add-user-password')?.value;
    const department = document.getElementById('add-user-department')?.value?.trim() || 'General';

    console.log('Form data:', { name, email, role, id, password, department });

    // Validate
    if (!name || !email || !password) {
      alert('Please fill in all required fields (Name, Email, Password)');
      return;
    }

    if (!role) {
      alert('Please select a role');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    // Check if email already exists
    const existingUser = await DB.getUserByEmail(email);
    if (existingUser) {
      alert('Email already registered: ' + email);
      return;
    }

    // Create user object
    const newUser = {
      name,
      email,
      role,
      id: id || undefined,
      password,
      department
    };

    console.log('Creating user:', newUser);

    // Add user to database
    const result = await DB.addUser(newUser);
    
    if (result.success) {
      console.log('✅ User created:', result.user);
      
      // Close modal
      closeModal('add-user-modal');
      
      // Refresh user list
      if (typeof renderAdminUsersList === 'function') {
        await renderAdminUsersList();
      }
      
      // Clear form
      ['add-user-name', 'add-user-email', 'add-user-id', 'add-user-password', 'add-user-department'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) el.value = '';
      });
      
      alert('✅ User created successfully!\n\nName: ' + result.user.name + '\nEmail: ' + result.user.email + '\nRole: ' + result.user.role + '\n\nThey can now login!');
      
    } else {
      alert('❌ Failed to create user: ' + (result.message || 'Unknown error'));
    }
    
  } catch (error) {
    console.error('❌ Add user error:', error);
    alert('❌ Error creating user: ' + error.message);
  }
}

// ✅ Make it globally accessible
window.addNewUser = addNewUser;
console.log('✅ addNewUser function attached to window');

async function confirmDeleteUser(userId, userName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal confirm-modal">
      <i class="fas fa-exclamation-triangle"></i><h3>Delete User?</h3>
      <p>Delete <strong>${userName}</strong>? This cannot be undone.</p>
      <div class="flex gap-2 justify-center">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-delete" onclick="executeDeleteUser('${userId}'); this.closest('.modal-overlay').remove();"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function executeDeleteUser(userId) {
  const currentUser = await DB.getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Admins only');
    return;
  }
  if (userId === currentUser.id) {
    alert('Cannot delete yourself');
    return;
  }
  const user = await DB.getUserById(userId);
  if (user?.role === 'admin') {
    alert('Cannot delete admins');
    return;
  }

  const result = await DB.deleteUser(userId);
  if (result.success) {
    await renderAdminUsersList();
    await loadAdminDashboard();
    
    const toast = document.createElement('div');
    toast.className = 'alert-box success fade-in';
    toast.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;padding:12px 20px;background:#D1FAE5;color:#065F46;border-radius:8px;';
    toast.innerHTML = '✅ User deleted';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// ==================== FILTER USERS - SYNC (no DB calls) ====================

function filterUsers() {
  const search = document.getElementById('admin-user-search')?.value.toLowerCase();
  const items = document.querySelectorAll('#admin-users-list .user-list-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(search) ? 'flex' : 'none';
  });
}

// ==================== GLOBAL LOGOUT - ASYNC ====================

async function handleLogout() {
  console.log('🚪 Logging out...');
  await DB.logout();
  
  // Clear form fields
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  
  // Redirect to login
  navigateTo('login-page');
  console.log('✅ Logged out successfully');
}

// ==================== MAKE FUNCTIONS GLOBALLY ACCESSIBLE ====================

// Ensure these functions are available globally for onclick handlers
window.showAdminSection = showAdminSection;
window.loadAdminDashboard = loadAdminDashboard;
window.renderAdminUsersList = renderAdminUsersList;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.toggleUserStatus = toggleUserStatus;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.saveSecuritySettings = saveSecuritySettings;
window.openEditUserModal = openEditUserModal;
window.saveEditUser = saveEditUser;
window.addNewUser = addNewUser;
window.confirmDeleteUser = confirmDeleteUser;
window.executeDeleteUser = executeDeleteUser;
window.filterUsers = filterUsers;
window.handleLogout = handleLogout;
// Make security functions globally accessible
window.showSecuritySection = showSecuritySection;
window.initSecurityAnalyticsCharts = initSecurityAnalyticsCharts;
window.initSecurityMap = initSecurityMap;
window.loadSecurityDashboard = loadSecurityDashboard;

console.log('✅ Security functions attached to window');