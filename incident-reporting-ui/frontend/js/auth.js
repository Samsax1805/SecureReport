// ==================== AUTH.JS ====================

let selectedRole = 'student';

function selectRole(card, role) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  selectedRole = role;
}

async function handleLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const errorDiv = document.getElementById('login-error');

  if (!email || !password) {
    showError(errorDiv, 'Please enter email and password');
    return;
  }

  const result = await DB.login(email, password, selectedRole);

  if (result.success) {
    errorDiv?.classList.add('hidden');
    await redirectToDashboard(result.user.role);
  } else {
    showError(errorDiv, result.message);
  }
}
// ==================== LOGOUT - BULLETPROOF VERSION ====================

async function handleLogout() {
  console.log('🚪 Logout clicked!');
  
  try {
    // Log audit event before logout
    const currentUser = await DB.getCurrentUser();
    if (currentUser) {
      console.log('📝 Logging audit: User', currentUser.name, 'logging out');
      if (typeof DB.logAudit === 'function') {
        await DB.logAudit('login', 'LOGOUT', currentUser.id, `User ${currentUser.name} logged out`);
      }
    }
    
    // Clear the database session
    await DB.logout();
    console.log('✅ DB.logout() completed');
    
    // Clear localStorage as backup
    localStorage.removeItem('secureReport_token');
    localStorage.removeItem('secureReport_currentUser');
    console.log('✅ LocalStorage cleared');
    
    // Clear form fields
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    console.log('✅ Form fields cleared');
    
    // Force redirect to login page
    navigateTo('login-page');
    console.log('✅ Navigated to login-page');
    
    // Force reload to clear any cached state
    setTimeout(() => {
      console.log('🔄 Force reload to clear state');
      window.location.href = window.location.pathname;
    }, 100);
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Fallback: clear everything and redirect
    localStorage.removeItem('secureReport_token');
    localStorage.removeItem('secureReport_currentUser');
    navigateTo('login-page');
    window.location.href = window.location.pathname;
  }
}

// ✅ CRITICAL: Make sure it's globally accessible
window.handleLogout = handleLogout;
console.log('✅ handleLogout attached to window:', typeof window.handleLogout);

async function handleSignup() {
  const name = document.getElementById('signup-name')?.value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const id = document.getElementById('signup-id')?.value.trim();
  const department = document.getElementById('signup-department')?.value;
  const password = document.getElementById('signup-password')?.value;
  const confirmPassword = document.getElementById('signup-confirm-password')?.value;
  const terms = document.getElementById('signup-terms')?.checked;
  const errorDiv = document.getElementById('signup-error');
  const successDiv = document.getElementById('signup-success');

  if (!name || !email || !password || !confirmPassword) {
    showError(errorDiv, 'Please fill in all required fields');
    return;
  }

  if (!terms) {
    showError(errorDiv, 'You must agree to the Terms of Service');
    return;
  }

  if (password !== confirmPassword) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  if (password.length < 8) {
    showError(errorDiv, 'Password must be at least 8 characters');
    return;
  }

  const result = await DB.addUser({
    name, email, role: 'student', id, department, password
  });

  if (result.success) {
    hideError(errorDiv);
    showSuccess(successDiv, `Account created! Your ID: ${result.user.id}. Waiting for admin approval.`);
    setTimeout(() => navigateTo('login-page'), 3000);
  } else {
    hideSuccess(successDiv);
    showError(errorDiv, result.message);
  }
}

async function handleLogout() {
  console.log('🚪 Logging out...');
  await DB.logout();
  navigateTo('login-page');
  
  // Clear form fields
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  
  console.log('✅ Logged out successfully');
}

async function redirectToDashboard(role) {
  console.log('🔄 Redirecting to', role, 'dashboard');
  
  // Navigate to the right page
  if (role === 'student') {
    navigateTo('student-dashboard');
    await loadStudentDashboard();
  } else if (role === 'security') {
    navigateTo('security-dashboard');
    await loadSecurityDashboard();
  } else if (role === 'admin') {
    navigateTo('admin-dashboard');
    await loadAdminDashboard();
  }
  
  // Small delay to ensure DOM is ready
  setTimeout(async () => {
    if (role === 'student') await loadStudentDashboard();
    else if (role === 'security') await loadSecurityDashboard();
    else if (role === 'admin') await loadAdminDashboard();
  }, 100);
}

async function checkAuth() {
  const user = await DB.getCurrentUser();
  if (user) {
    const freshUser = await DB.getUserById(user.id);
    if (!freshUser || !freshUser.active) {
      await DB.logout();
      navigateTo('login-page');
      return;
    }
    if (!freshUser.approved && freshUser.role !== 'admin') {
      await DB.logout();
      navigateTo('login-page');
      alert('Your account is pending approval');
      return;
    }
    await redirectToDashboard(freshUser.role);
  }
}

function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.classList.remove('hidden');
  }
}

function hideError(element) {
  if (element) element.classList.add('hidden');
}

function showSuccess(element, message) {
  if (element) {
    element.textContent = message;
    element.classList.remove('hidden');
  }
}

function hideSuccess(element) {
  if (element) element.classList.add('hidden');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', checkAuth);

// Backup: Also listen for clicks on any logout link
document.addEventListener('click', async (e) => {
  if (e.target.closest('a[onclick*="handleLogout"]')) {
    e.preventDefault();
    e.stopPropagation();
    await handleLogout();
  }
});