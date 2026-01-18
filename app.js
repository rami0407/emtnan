// --- Initialization ---
const STORAGE_KEY = 'gratitude_messages';
let notes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let currentUser = { name: 'Guest', role: 'student' }; // Mock user
let isAdmin = false;

// Recording State
let mediaRecorder;
let audioChunks = [];
let audioBlob = null;
let audioBase64 = null;

// --- DOM Elements ---
const chatArea = document.getElementById('chat-area');
const pinnedContainer = document.getElementById('pinned-container');
const messageCountSpan = document.getElementById('msg-count');
const modal = document.getElementById('compose-modal');
const form = document.getElementById('compose-form');
const adminToggle = document.getElementById('admin-toggle');

// Voice Elements
const recordBtn = document.getElementById('record-btn');
const recordStatus = document.getElementById('record-status');
const audioPreviewContainer = document.getElementById('audio-preview-container');
const audioPreview = document.getElementById('audio-preview');


// --- Core Functions ---

function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    renderMessages();
}

function renderMessages() {
    chatArea.innerHTML = '';
    pinnedContainer.innerHTML = '';

    // Sort logic
    const visibleNotes = isAdmin
        ? notes
        : notes.filter(n => n.status === 'approved');

    // 1. Render Pinned Messages (Only approved ones typically, or all for admin)
    const pinnedNotes = visibleNotes.filter(n => n.isPinned);
    if (pinnedNotes.length > 0) {
        pinnedContainer.style.display = 'flex';
        pinnedNotes.forEach(note => {
            const pinDiv = document.createElement('div');
            pinDiv.className = 'pinned-message';
            pinDiv.innerHTML = `<span>📌 <b>${note.sender}:</b> ${note.text ? note.text.substring(0, 30) + '...' : 'Voice Message'}</span> ${isAdmin ? `<span onclick="togglePin(${note.id})">❌</span>` : ''}`;
            pinDiv.onclick = (e) => {
                if (e.target.tagName !== 'SPAN') scrollToMessage(note.id);
            };
            pinnedContainer.appendChild(pinDiv);
        });
    } else {
        pinnedContainer.style.display = 'none';
    }

    // 2. Render Normal Messages
    visibleNotes.forEach(note => {
        const bubble = document.createElement('div');
        bubble.id = `msg-${note.id}`;
        bubble.className = `message-bubble ${note.status}`;
        if (note.status === 'pending') bubble.classList.add('pending');

        const tickColor = note.status === 'approved' ? '#53bdeb' : '#999';
        const ticks = `<svg viewBox="0 0 16 15" width="16" height="15" style="fill:${tickColor}"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.585l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>`;

        // Reactions
        let reactionsHtml = '';
        if (note.likes > 0 || (note.reactions && note.reactions.length > 0)) {
            reactionsHtml = `
            <div class="reactions-bar">
                <div class="reaction-count" onclick="likeMessage(${note.id})">
                    ${(note.reactions || []).join('')} ❤️ ${note.likes}
                </div>
            </div>`;
        } else {
            reactionsHtml = `
            <div class="reactions-bar" style="border:none; padding:0;">
                <button onclick="likeMessage(${note.id})" style="background:none; border:none; color:#ccc; font-size:12px; cursor:pointer;">❤️ Like</button>
            </div>`;
        }

        // Admin Controls
        let adminControls = '';
        if (isAdmin) {
            adminControls = `
            <div style="margin-top:10px; border-top:1px dashed #ccc; padding-top:5px; display:flex; gap:5px;">
                ${note.status === 'pending' ?
                    `<button onclick="approveMessage(${note.id})" style="background:#d9fdd3;border:1px solid green;">✅</button>
                     <button onclick="rejectMessage(${note.id})" style="background:#fdd3d3;border:1px solid red;">❌</button>`
                    : ''}
                <button onclick="togglePin(${note.id})" style="background:${note.isPinned ? '#ffd700' : '#eee'}; border:1px solid #ccc;">
                    ${note.isPinned ? 'Unpin' : '📌 Pin'}
                </button>
            </div>
            `;
        }

        // Content (Text + Audio)
        let contentHtml = '';
        if (note.heading) contentHtml += `<div style="font-weight:bold; color:var(--whatsapp-teal)">${note.heading}</div>`; // fallback
        if (note.audioData) {
            contentHtml += `<audio controls src="${note.audioData}" class="audio-player"></audio>`;
        }
        if (note.text) {
            contentHtml += `<div>${note.text}</div>`;
        }

        bubble.innerHTML = `
            <div class="message-sender">
                <span>${note.sender} ➝ ${note.receiver}</span>
            </div>
            <div class="message-text">
                ${contentHtml}
            </div>
            <div class="message-meta">
                <span class="timestamp">${note.timestamp}</span>
                ${ticks}
            </div>
            ${reactionsHtml}
            ${adminControls}
        `;

        chatArea.appendChild(bubble);
    });

    if (isAdmin) {
        messageCountSpan.innerText = `${notes.filter(n => n.status === 'pending').length} Pending`;
    } else {
        messageCountSpan.innerText = "Online";
    }
}

function scrollToMessage(id) {
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// --- Recording Logic ---

async function toggleRecording() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        // Start Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPreview.src = audioUrl;

                // Convert to Base64 for storage
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = function () {
                    audioBase64 = reader.result;
                }

                audioPreviewContainer.style.display = 'block';
                recordStatus.style.display = 'none';
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-microphone"></i> إعادة';
                audioChunks = [];
            };

            mediaRecorder.start();
            recordBtn.classList.add('recording');
            recordStatus.style.display = 'inline';
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> إيقاف';
            audioChunks = [];

        } catch (err) {
            console.error("Error accessing mic:", err);
            alert("لا يمكن الوصول للميكروفون. تأكد من السماح بالصلاحيات.");
        }
    } else {
        // Stop Recording
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Stop mic
    }
}

function clearAudio() {
    audioBlob = null;
    audioBase64 = null;
    audioPreview.src = '';
    audioPreviewContainer.style.display = 'none';
    recordBtn.innerHTML = '<i class="fas fa-microphone"></i> تسجيل';
}

// --- Actions ---

function openCompose() {
    modal.style.display = 'flex';
}

function closeCompose() {
    modal.style.display = 'none';
    form.reset();
    clearAudio();
}

function handleSubmit(e) {
    e.preventDefault();

    // Allow empty text if audio is present
    const textVal = document.getElementById('message-text').value;
    if (!textVal && !audioBase64) {
        alert("يرجى كتابة رسالة أو تسجيل صوت.");
        return;
    }

    const newNote = {
        id: Date.now(),
        sender: document.getElementById('sender').value || "Anonymous",
        receiver: document.getElementById('receiver').value,
        text: textVal,
        audioData: audioBase64,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        isPinned: false,
        likes: 0,
        reactions: []
    };

    notes.push(newNote);
    saveNotes();
    closeCompose();

    alert("تم الإرسال للمدير للمراجعة! 🚀");
}

function likeMessage(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.likes++;
        saveNotes();
    }
}

function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.isPinned = !note.isPinned;
        saveNotes();
    }
}

// --- Admin Actions ---

function toggleAdmin() {
    isAdmin = !isAdmin;
    document.body.classList.toggle('admin-mode');
    const headerTitle = document.querySelector('.header-title');
    headerTitle.innerText = isAdmin ? "لوحة المدير (Admin)" : "صفحة الامتنان";
    renderMessages();
}

function approveMessage(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.status = 'approved';
        saveNotes();
    }
}

function rejectMessage(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
}

// --- Events ---

form.addEventListener('submit', handleSubmit);
adminToggle.addEventListener('click', toggleAdmin);

window.likeMessage = likeMessage;
window.approveMessage = approveMessage;
window.rejectMessage = rejectMessage;
window.togglePin = togglePin;
window.openCompose = openCompose;
window.closeCompose = closeCompose; // Exposed for cancel btn
window.toggleRecording = toggleRecording;
window.clearAudio = clearAudio;

// Init
renderMessages();
