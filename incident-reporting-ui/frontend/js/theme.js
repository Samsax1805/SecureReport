// ==================== THEME.JS ====================

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  document.querySelectorAll('#theme-icon, #theme-icon-sec, #theme-icon-admin').forEach(icon => {
    icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  });
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  document.querySelectorAll('#theme-icon, #theme-icon-sec, #theme-icon-admin').forEach(icon => {
    icon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}