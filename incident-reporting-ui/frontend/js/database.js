// ==================== DATABASE - IndexedDB (500MB+ Storage) + Audit Logging ====================

// Initialize Dexie (IndexedDB wrapper)
const db = new Dexie('SecureReportDB');

// Define database schema with auditLogs table
db.version(1).stores({
  users: '++id, email, role, active, approved',
  incidents: '++id, reportedBy, status, type, createdAt',
  settings: 'key',
  currentUser: 'id',
  auditLogs: '++id, timestamp, action, userId, category'  // ✅ NEW: Audit logs table
});

// Initialize database with default data
async function initDatabase() {
  console.log('📦 Initializing IndexedDB...');
  
  // Check if users exist
  const userCount = await db.users.count();
  
  if (userCount === 0) {
    // Create default admin
    await db.users.add({
      id: 'ADMIN001',
      name: 'System Administrator',
      email: 'admin@securereport.com',
      password: btoa('admin123'),
      role: 'admin',
      department: 'IT',
      active: true,
      approved: true,
      verified: true,
      createdAt: new Date().toISOString()
    });
    
    // Create default security officer
    await db.users.add({
      id: 'SEC001',
      name: 'Officer Samsax',
      email: 'smith@security.com',
      password: btoa('security123'),
      role: 'security',
      department: 'Security',
      active: true,
      approved: true,
      verified: true,
      createdAt: new Date().toISOString()
    });
    
    // Log initial setup
    await logAudit('system', 'DATABASE_INIT', 'system', 'Initial database setup completed');
    
    console.log('✅ Default users created');
  }
  
  // Check if settings exist
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkPut([
      { key: 'systemName', value: 'SecureReport' },
      { key: 'emailNotifications', value: 'all' },
      { key: 'anonymousReports', value: 'enabled' },
      { key: 'dataRetention', value: 365 },
      { key: 'mapsApiKey', value: '' },
      { key: 'maintenanceMode', value: false },
      { key: 'supportEmail', value: 'admin@securereport.com' }
    ]);
    console.log('✅ Default settings created');
  }
  
  console.log('✅ IndexedDB initialized (500MB+ storage)');
}

// ==================== AUDIT LOGGING FUNCTIONS ====================

async function logAudit(category, action, userId, details, metadata = {}) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      category: category,  // 'login', 'incident', 'user', 'settings', 'system'
      action: action,      // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
      userId: userId,      // User who performed the action
      details: details,    // Human-readable description
      meta: metadata,  // Additional data (IP, user agent, etc.)
      success: true
    };
    
    await db.auditLogs.add(logEntry);
    console.log('📝 Audit log:', action, details);
    
    // Auto-cleanup: Keep only last 1000 logs
    const count = await db.auditLogs.count();
    if (count > 1000) {
      const oldLogs = await db.auditLogs.orderBy('timestamp').limit(count - 1000).toArray();
      await db.auditLogs.bulkDelete(oldLogs.map(l => l.id));
    }
    
    return logEntry;
  } catch (error) {
    console.error('❌ Failed to log audit:', error);
    return null;
  }
}

async function getAuditLogs(filters = {}) {
  try {
    let collection = db.auditLogs.orderBy('timestamp').reverse();
    
    if (filters.category) {
      collection = collection.filter(log => log.category === filters.category);
    }
    if (filters.userId) {
      collection = collection.filter(log => log.userId === filters.userId);
    }
    if (filters.action) {
      collection = collection.filter(log => log.action === filters.action);
    }
    
    const logs = await collection.limit(filters.limit || 100).toArray();
    return logs;
  } catch (error) {
    console.error('❌ Failed to get audit logs:', error);
    return [];
  }
}

async function clearAuditLogs() {
  try {
    await db.auditLogs.clear();
    await logAudit('system', 'AUDIT_CLEARED', 'system', 'All audit logs cleared');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to clear audit logs:', error);
    return { success: false, message: error.message };
  }
}

// ==================== MAIN DB OBJECT ====================

const DB = {
  // Initialize
  async init() {
    await initDatabase();
  },
  
  // ===== AUDIT LOG METHODS =====
  logAudit: logAudit,
  getAuditLogs: getAuditLogs,
  clearAuditLogs: clearAuditLogs,
  
  // ===== USER METHODS =====
  
  async getUsers() {
    return await db.users.toArray();
  },
  
  async getUserByEmail(email) {
    return await db.users.where('email').equalsIgnoreCase(email).first();
  },
  
  async getUserById(id) {
    return await db.users.get(id);
  },
  
  async addUser(user) {
    const existing = await this.getUserByEmail(user.email);
    if (existing) {
      return { success: false, message: 'Email already registered' };
    }
    
    const prefix = user.role === 'admin' ? 'ADM' : user.role === 'security' ? 'SEC' : 'STU';
    const userCount = await db.users.where('role').equals(user.role).count();
    const idNum = userCount + 1;
    
    const newUser = {
      ...user,
      id: user.id || `${prefix}${String(idNum).padStart(3, '0')}`,
      password: btoa(user.password),
      createdAt: new Date().toISOString(),
      active: user.role === 'admin',
      approved: user.role === 'admin',
      verified: user.role === 'admin'
    };
    
    await db.users.add(newUser);
    
    // ✅ AUDIT LOG: User created
    await logAudit('user', 'USER_CREATED', newUser.id, `User ${newUser.name} (${newUser.email}) created with role: ${newUser.role}`);
    
    return { success: true, user: newUser };
  },
  
  async approveUser(userId) {
    const user = await this.getUserById(userId);
    await db.users.update(userId, { approved: true, active: true });
    
    // ✅ AUDIT LOG: User approved
    if (user) {
      await logAudit('user', 'USER_APPROVED', userId, `User ${user.name} approved and activated`);
    }
    
    return { success: true };
  },
  
  async rejectUser(userId) {
    const user = await this.getUserById(userId);
    await db.users.delete(userId);
    
    // ✅ AUDIT LOG: User rejected/deleted
    if (user) {
      await logAudit('user', 'USER_REJECTED', userId, `User ${user.name} (${user.email}) rejected and deleted`);
    }
    
    return { success: true };
  },
  
  async updateUser(id, updates) {
    const user = await this.getUserById(id);
    await db.users.update(id, updates);
    
    // ✅ AUDIT LOG: User updated
    if (user) {
      const changes = Object.keys(updates).map(k => `${k}: ${user[k]} → ${updates[k]}`).join(', ');
      await logAudit('user', 'USER_UPDATED', id, `User ${user.name} updated: ${changes}`);
    }
    
    return { success: true };
  },
  
  async deleteUser(id) {
    const user = await this.getUserById(id);
    await db.users.delete(id);
    
    // ✅ AUDIT LOG: User deleted
    if (user) {
      await logAudit('user', 'USER_DELETED', id, `User ${user.name} (${user.email}) deleted`);
    }
    
    return { success: true };
  },
  
  // ===== INCIDENT METHODS =====
  
  async getIncidents() {
    return await db.incidents.reverse().sortBy('createdAt');
  },
  
  async getIncidentById(id) {
    return await db.incidents.get(id);
  },
  
  async getIncidentsByUserId(userId) {
    return await db.incidents.where('reportedBy').equals(userId).reverse().sortBy('createdAt');
  },
  
  async addIncident(incident) {
  console.log('📝 addIncident called');
  
  // Get ALL incidents to generate unique ID
  const allIncidents = await this.getIncidents();
  console.log('📊 Total existing incidents:', allIncidents.length);
  
  const year = new Date().getFullYear();
  
  // Generate unique ID based on anonymous or regular
  const prefix = incident.anonymous ? 'ANON' : 'INC';
  
  // Count ONLY incidents with same prefix for ID number
  const sameTypeCount = allIncidents.filter(i => 
    i.id?.startsWith(prefix) && i.id?.includes(year.toString())
  ).length;
  
 
const idNum = sameTypeCount + 1;

// ✅ Use LET (not const) so we can reassign if collision occurs
let newId = `${prefix}-${year}-${String(idNum).padStart(3, '0')}`;


const existingId = allIncidents.find(i => i.id === newId);
if (existingId) {
  console.warn('⚠️ ID collision detected, using timestamp instead');
  
  newId = `${prefix}-${year}-${Date.now()}`;
  console.log('🆔 New collision-free ID:', newId);
}
  
  // Process evidence
let evidenceData = null;
if (incident.evidence) {
  if (typeof incident.evidence === 'object' && incident.evidence.data) {
    // Evidence is an object with data property
    evidenceData = {
      data: incident.evidence.data,  
      name: incident.evidence.name,
      type: incident.evidence.type,
      size: incident.evidence.size
    };
  } else if (typeof incident.evidence === 'string') {
    // Evidence is a base64 string directly
    evidenceData = {
      data: incident.evidence, 
      name: incident.evidenceName || 'evidence',
      type: incident.evidenceType || 'image/png',
      size: incident.evidenceSize || 0
    };
  }
}
  
  // Create NEW incident with UNIQUE ID and its OWN timeline
  const newIncident = {
    ...incident,
    id: newId,  // ✅ UNIQUE ID
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'Pending',
    assignedTo: null,
    evidence: evidenceData,  // ✅ Save evidence properly
    timeline: [{  // ✅ NEW timeline for THIS incident only
      date: new Date().toISOString(),
      user: incident.anonymous ? 'Anonymous' : incident.reportedByName,
      action: 'Report submitted'
    }]
  };
  
  console.log('💾 Saving incident to database:', {
    id: newIncident.id,
    anonymous: newIncident.anonymous,
    hasEvidence: !!newIncident.evidence,
    timelineLength: newIncident.timeline.length
  });
  
  // Add to IndexedDB
  await db.incidents.add(newIncident);
  
  // AUDIT LOG
  const currentUser = await this.getCurrentUser();
  await logAudit(
    'incident',
    'INCIDENT_CREATED',
    currentUser?.id || 'anonymous',
    `Incident ${newIncident.id} created: ${incident.type} - ${incident.location}`,
    { 
      incidentId: newIncident.id, 
      type: incident.type, 
      priority: incident.priority,
      anonymous: incident.anonymous 
    }
  );
  
  console.log('✅ Incident saved successfully');
  
  return { success: true, incident: newIncident };
},
async updateIncident(id, updates) {
  console.log('🔧 updateIncident called:', { id, updates });
  
  const incident = await this.getIncidentById(id);
  if (!incident) {
    console.error('❌ Incident not found:', id);
    return { success: false, message: 'Incident not found' };
  }
  
  // Ensure timeline is handled correctly
  if (updates.timeline) {
    console.log('📋 Updating timeline:', {
      oldLength: incident.timeline?.length || 0,
      newLength: Array.isArray(updates.timeline) ? updates.timeline.length : 0
    });
    
    // Make sure timeline is an array
    updates.timeline = Array.isArray(updates.timeline) ? updates.timeline : [];
  }
  
  // Update the incident in IndexedDB
  await db.incidents.update(id, updates);
  
  // AUDIT LOG
  const currentUser = await this.getCurrentUser();
  if (updates.status && updates.status !== incident.status) {
    await logAudit(
      'incident',
      'INCIDENT_STATUS_CHANGED',
      currentUser?.id || 'system',
      `Incident ${id} status changed: ${incident.status} → ${updates.status}`,
      { incidentId: id, oldStatus: incident.status, newStatus: updates.status }
    );
  }
  
  console.log('✅ Incident updated successfully');
  return { success: true };
},

  async deleteIncident(id) {
    const incident = await this.getIncidentById(id);
    await db.incidents.delete(id);
    
    // ✅ AUDIT LOG: Incident deleted
    if (incident) {
      const currentUser = await this.getCurrentUser();
      await logAudit(
        'incident',
        'INCIDENT_DELETED',
        currentUser?.id || 'system',
        `Incident ${id} deleted: ${incident.type}`,
        { incidentId: id, type: incident.type }
      );
    }
    
    return { success: true };
  },
  
  // ===== AUTH METHODS =====
  
  async login(email, password, role) {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      await logAudit('login', 'LOGIN_FAILED', email, `Login failed: User not found (${email})`);
      return { success: false, message: 'User not found' };
    }
    if (user.role !== role) {
      await logAudit('login', 'LOGIN_FAILED', user.id, `Login failed: Wrong role (${role} vs ${user.role})`);
      return { success: false, message: `Account is ${user.role}, not ${role}` };
    }
    if (btoa(password) !== user.password) {
      await logAudit('login', 'LOGIN_FAILED', user.id, `Login failed: Invalid password for ${user.email}`);
      return { success: false, message: 'Invalid password' };
    }
    if (!user.active) {
      await logAudit('login', 'LOGIN_FAILED', user.id, `Login failed: Account deactivated (${user.email})`);
      return { success: false, message: 'Account is deactivated' };
    }
    if (!user.approved && user.role !== 'admin') {
      await logAudit('login', 'LOGIN_FAILED', user.id, `Login failed: Account pending approval (${user.email})`);
      return { success: false, message: 'Account pending approval' };
    }
    
    // Save current user
    await db.currentUser.put({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department
    });
    
    // ✅ AUDIT LOG: Successful login
    await logAudit('login', 'LOGIN_SUCCESS', user.id, `User ${user.name} logged in as ${user.role}`, {
      email: user.email,
      role: user.role,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, user };
  },
  
  async signup(userData) {
    const result = await this.addUser({ ...userData, role: 'student' });
    
    // ✅ AUDIT LOG: User signup
    if (result.success) {
      await logAudit('user', 'USER_SIGNUP', result.user.id, `New user signup: ${result.user.name} (${result.user.email})`);
    }
    
    return result;
  },
  
  async logout() {
  const user = await this.getCurrentUser();  // ✅ Now works correctly
  
  // ✅ AUDIT LOG: Logout
  if (user) {
    await logAudit('login', 'LOGOUT', user.id, `User ${user.name} logged out`);
  }
  
  await db.currentUser.clear();
},
  
  async getCurrentUser() {
  try {
    const users = await db.currentUser.toArray();
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('❌ getCurrentUser error:', error);
    return null;
  }
},
  
  // ===== SETTINGS =====
  
  async getSettings() {
    const settings = await db.settings.toArray();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, this.getDefaultSettings());
  },
  
  async saveSettings(settings) {
    const oldSettings = await this.getSettings();
    const entries = Object.entries(settings).map(([key, value]) => ({ key, value }));
    await db.settings.bulkPut(entries);
    
    // ✅ AUDIT LOG: Settings changed
    const currentUser = await this.getCurrentUser();
    const changes = Object.entries(settings)
      .filter(([k, v]) => oldSettings[k] !== v)
      .map(([k, v]) => `${k}: ${oldSettings[k]} → ${v}`)
      .join(', ');
    
    if (changes) {
      await logAudit('settings', 'SETTINGS_UPDATED', currentUser?.id || 'system', `Settings updated: ${changes}`);
    }
    
    return { success: true };
  },
  
  async resetSettings() {
    const defaults = this.getDefaultSettings();
    await this.saveSettings(defaults);
    
    // ✅ AUDIT LOG: Settings reset
    const currentUser = await this.getCurrentUser();
    await logAudit('settings', 'SETTINGS_RESET', currentUser?.id || 'system', 'Settings reset to defaults');
    
    return { success: true };
  },
  
  getDefaultSettings() {
    return {
      systemName: 'SecureReport',
      emailNotifications: 'all',
      anonymousReports: 'enabled',
      dataRetention: 365,
      mapsApiKey: '',
      maintenanceMode: false,
      supportEmail: 'admin@securereport.com'
    };
  },
  
  // ===== STATS =====
  
  async getStats() {
    const incidents = await this.getIncidents();
    const users = await this.getUsers();
    const auditLogs = await db.auditLogs.count();
    
    return {
      totalIncidents: incidents.length,
      pending: incidents.filter(i => i.status === 'Pending').length,
      inProgress: incidents.filter(i => i.status === 'In Progress').length,
      resolved: incidents.filter(i => i.status === 'Resolved').length,
      totalUsers: users.filter(u => u.active && u.approved).length,
      pendingApprovals: users.filter(u => !u.approved).length,
      activeOfficers: users.filter(u => u.role === 'security' && u.active).length,
      resolutionRate: incidents.length > 0
        ? Math.round((incidents.filter(i => i.status === 'Resolved').length / incidents.length) * 100)
        : 0,
      auditLogsCount: auditLogs
    };
  },
  
  // ===== DATABASE MANAGEMENT =====
  
  async getDatabaseStats() {
    const users = await db.users.count();
    const incidents = await db.incidents.count();
    const settings = await db.settings.count();
    const auditLogs = await db.auditLogs.count();
    
    // Estimate storage size
    const allData = {
      users: await db.users.toArray(),
      incidents: await db.incidents.toArray(),
      settings: await db.settings.toArray(),
      auditLogs: await db.auditLogs.toArray()
    };
    
    const sizeBytes = new Blob([JSON.stringify(allData)]).size;
    const sizeKB = (sizeBytes / 1024).toFixed(2);
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    
    return {
      users,
      incidents,
      settings,
      auditLogs,
      storageKB: sizeKB,
      storageMB: sizeMB
    };
  },
  
  async exportAllData() {
    const stats = await this.getDatabaseStats();
    const auditLogs = await this.getAuditLogs({ limit: 1000 });
    
    return {
      exportDate: new Date().toISOString(),
      stats,
      users: await db.users.toArray(),
      incidents: await db.incidents.toArray(),
      settings: await db.settings.toArray(),
      auditLogs
    };
  },
  
  async clearAllData() {
    await db.users.clear();
    await db.incidents.clear();
    await db.settings.clear();
    await db.currentUser.clear();
    // Keep audit logs of this action
    await logAudit('system', 'DATABASE_CLEARED', 'system', 'All database data cleared');
    return { success: true };
  }
};

// Initialize on load
DB.init();
console.log('✅ database.js loaded - Using IndexedDB (500MB+ storage) + Audit Logging');