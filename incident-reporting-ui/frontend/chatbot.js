// Make sure chatbot functions are globally accessible
window.toggleChatbot = function() {
    console.log('🔘 Chatbot toggle clicked');
    const chatbot = document.getElementById('ai-chatbot');
    if (chatbot) {
        const isHidden = chatbot.classList.contains('hidden');
        if (isHidden) {
            chatbot.classList.remove('hidden');
            console.log('✅ Chatbot opened');
            // Focus input after opening
            setTimeout(() => {
                const input = document.getElementById('chatbot-user-input');
                if (input) input.focus();
            }, 100);
        } else {
            chatbot.classList.add('hidden');
            console.log('❌ Chatbot closed');
        }
    } else {
        console.error('❌ Chatbot element not found!');
    }
};

window.sendChatMessage = function() {
    console.log('➤ Send message clicked');
    const input = document.getElementById('chatbot-user-input');
    const msg = input?.value.trim();
    if (!msg) return;

    // Add user message
    addMessage(msg, 'user');
    input.value = '';

    // Show typing indicator
    showTyping(true);

    // Simulate bot response
    setTimeout(() => {
        showTyping(false);
        const reply = getBotReply(msg);
        addMessage(reply, 'bot');
    }, 500);
};

window.handleChatInput = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        window.sendChatMessage();
    }
};

window.sendQuickReply = function(text) {
    console.log('Quick reply:', text);
    const input = document.getElementById('chatbot-user-input');
    if (input) {
        input.value = text;
        window.sendChatMessage();
    }
};

// Helper: Add message to chat
function addMessage(text, sender) {
    const container = document.getElementById('chatbot-messages');
    if (!container) {
        console.error('❌ Chat messages container not found');
        return;
    }

    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = `
        <div class="message-avatar">${sender === 'bot' ? '🤖' : '👤'}</div>
        <div class="message-content">
            <p>${text}</p>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    console.log('✅ Message added:', sender);
}

// Helper: Show/hide typing indicator
function showTyping(show) {
    const typing = document.getElementById('chatbot-typing');
    if (typing) {
        typing.style.display = show ? 'flex' : 'none';
    }
}

// Helper: Get bot reply
function getBotReply(input) {
    const txt = input.toLowerCase();
    if (txt.includes('report')) return '📝 To report an incident: Click "Report Incident" → Fill the form → Submit. Need help with a specific step?';
    if (txt.includes('track')) return '🔍 To track your report: Go to "Track Incident" → Select your incident → View status and updates.';
    if (txt.includes('anonymous')) return '🕵️ Anonymous reporting: No login required. You\'ll receive an Incident ID to track your report.';
    if (txt.includes('email') || txt.includes('admin') || txt.includes('contact')) return '📧 Contact admin: admin@securereport.com';
    if (txt.includes('emergency')) return '🚨 For emergencies, call 911 or campus security immediately. This system is for non-urgent reports.';
    if (txt.includes('password') || txt.includes('login')) return '🔐 Login issues: Use your registered email and password. Forgot password? Contact admin.';
    return '🤖 I can help with: Reporting incidents • Tracking reports • Anonymous reporting • Login help • Contact admin. What do you need?';
}

// Close chatbot when clicking outside
document.addEventListener('click', function(e) {
    const chatbot = document.getElementById('ai-chatbot');
    const toggle = document.querySelector('.chatbot-toggle');
    
    if (chatbot && !chatbot.classList.contains('hidden')) {
        if (!chatbot.contains(e.target) && toggle && !toggle.contains(e.target)) {
            chatbot.classList.add('hidden');
            console.log('❌ Chatbot closed by clicking outside');
        }
    }
});

console.log('✅ Chatbot.js loaded - Functions are global');