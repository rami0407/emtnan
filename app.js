import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- State ---
let notes = [];
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

// --- Firebase Listeners ---

// Listen to 'messages' collection ordered by timestamp
const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
    notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    renderMessages();
}, (error) => {
    console.error("Error getting documents: ", error);
});

// --- Core Functions ---

// --- Core Functions ---

function renderMessages() {
    chatArea.innerHTML = '';
    pinnedContainer.innerHTML = '';

    const visibleNotes = isAdmin
        ? notes
        : notes.filter(n => n.status === 'approved');

    if (isAdmin) {
        messageCountSpan.innerText = `${notes.filter(n => n.status === 'pending').length} Pending`;
    } else {
        messageCountSpan.innerText = "Online";
    }

    // Update Global Counter
    const totalApproved = notes.filter(n => n.status === 'approved').length;
    const counterEl = document.getElementById('global-counter');
    if (counterEl) {
        counterEl.innerHTML = `${totalApproved} 💌 رسالة امتنان`;
        // Simple animation trigger
        counterEl.classList.remove('pop');
        void counterEl.offsetWidth; // trigger reflow
        counterEl.classList.add('pop');
    }

    // 1. Render Pinned Messages
    const pinnedNotes = visibleNotes.filter(n => n.isPinned);
    if (pinnedNotes.length > 0) {
        pinnedContainer.style.display = 'flex';
        pinnedNotes.forEach(note => {
            const pinDiv = document.createElement('div');
            pinDiv.className = 'pinned-message';
            pinDiv.innerHTML = `<span>📌 <b>${note.sender}:</b> ${note.text ? note.text.substring(0, 30) + '...' : 'Voice Message'}</span> ${isAdmin ? `<span class="unpin-btn" data-id="${note.id}">❌</span>` : ''}`;

            pinDiv.querySelector('span:first-child').onclick = () => scrollToMessage(note.id);
            if (isAdmin) {
                pinDiv.querySelector('.unpin-btn').onclick = (e) => {
                    e.stopPropagation();
                    togglePin(note.id, note.isPinned);
                };
            }
            pinnedContainer.appendChild(pinDiv);
        });
    } else {
        pinnedContainer.style.display = 'none';
    }

    // 2. Render Normal Messages (Grouped by Week)

    // Helper to get Sunday of the week (Normalized to midnight)
    const getWeekStart = (d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0); // Normalize time
        const day = date.getDay(); // 0 (Sun) to 6 (Sat)
        const diff = date.getDate() - day; // subtract day to get Sunday
        return new Date(date.setDate(diff));
    };

    const formatDate = (d) => {
        return `${d.getDate()}/${d.getMonth() + 1}`;
    };

    const formatWeekRange = (sundayDate) => {
        const nextSat = new Date(sundayDate);
        nextSat.setDate(sundayDate.getDate() + 6);
        return `الأسبوع: ${formatDate(sundayDate)} - ${formatDate(nextSat)}`;
    };

    // Calculate Current Week Start (for comparison)
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    const currentWeekKey = currentWeekStart.getTime(); // Use timestamp for easier comparison

    // Group Messages
    const grouped = {};

    visibleNotes.forEach(note => {
        // Timestamp handling: simplified for Firestore TS
        const ts = note.timestamp ? note.timestamp.toDate() : new Date();
        const weekStart = getWeekStart(ts);
        const weekKey = weekStart.getTime();

        if (!grouped[weekKey]) {
            grouped[weekKey] = {
                date: weekStart,
                notes: []
            };
        }
        grouped[weekKey].notes.push(note);
    });

    // Sort Weeks (Newest First)
    const sortedWeekKeys = Object.keys(grouped).sort((a, b) => b - a);

    sortedWeekKeys.forEach(key => {
        const weekData = grouped[key];
        const isCurrentWeek = (parseInt(key) === currentWeekKey);
        const label = formatWeekRange(weekData.date);

        // Container (Direct chatArea for current week, Details for past)
        let listContainer;

        if (isCurrentWeek) {
            // Restoration: Render directly to chatArea, just like before.
            // No wrapper, no header.
            listContainer = chatArea;
        } else {
            // Past weeks -> Collapsible
            const details = document.createElement('details');
            details.className = 'week-group archived-week';

            const summary = document.createElement('summary');
            summary.className = 'week-header';
            summary.innerText = `📂 أرشيف ${label}`;
            details.appendChild(summary);

            const internalList = document.createElement('div');
            internalList.className = 'week-messages';
            details.appendChild(internalList);

            listContainer = internalList;
            chatArea.appendChild(details);
        }

        // Render Messages in this Group
        weekData.notes.forEach(note => {
            const bubble = document.createElement('div');
            bubble.id = `msg-${note.id}`;
            bubble.className = `message-bubble ${note.status}`;
            if (note.status === 'pending') bubble.classList.add('pending');

            const tickColor = note.status === 'approved' ? '#53bdeb' : '#999';
            const ticks = `<svg viewBox="0 0 16 15" width="16" height="15" style="fill:${tickColor}"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.585l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>`;

            // Content
            let contentHtml = '';
            if (note.audioData) {
                contentHtml += `<audio controls src="${note.audioData}" class="audio-player"></audio>`;
            }
            if (note.text) {
                contentHtml += `<div>${note.text}</div>`;
            }

            // Reactions Logic
            let reactionChips = '';
            const counts = note.reactionCounts || {};

            // Migration
            if ((note.likes > 0) && (!counts['❤️'])) {
                counts['❤️'] = note.likes;
            }

            Object.keys(counts).forEach(emoji => {
                if (counts[emoji] > 0) {
                    reactionChips += `<span class="reaction-pill">${emoji} ${counts[emoji]}</span>`;
                }
            });

            bubble.innerHTML = `
                <div class="message-sender">
                    <span>${note.sender} ➝ ${note.receiver}</span>
                </div>
                <div class="message-text">${contentHtml}</div>
                <div class="message-meta">
                    <span class="timestamp">${note.formattedTime || 'Now'}</span>
                    ${ticks}
                </div>
                
                <!-- Reactions UI -->
                <div class="reactions-bar">
                    <div class="reaction-tally">
                        ${reactionChips}
                    </div>
                    
                    <div class="reaction-wrapper">
                        <button class="reaction-trigger" id="react-trigger-${note.id}">
                            <i class="far fa-smile"></i>
                        </button>
                        <!-- Picker -->
                        <div id="picker-${note.id}" class="reaction-picker hidden">
                            <div class="reaction-emojis">
                                <button class="emoji-btn" data-id="${note.id}" data-emoji="❤️">❤️</button>
                                <button class="emoji-btn" data-id="${note.id}" data-emoji="👍">👍</button>
                                <button class="emoji-btn" data-id="${note.id}" data-emoji="🤩">🤩</button>
                                <button class="emoji-btn" data-id="${note.id}" data-emoji="😂">😂</button>
                                <button class="emoji-btn" data-id="${note.id}" data-emoji="🙏">🙏</button>
                            </div>
                        </div>
                    </div>
                </div>
    
                <!-- Admin Controls -->
                ${isAdmin ? `
                <div class="admin-controls" style="margin-top:10px; border-top:1px dashed #ccc; padding-top:5px; display:flex; gap:5px;">
                    ${note.status === 'pending' ?
                        `<button class="approve-btn" style="background:#d9fdd3;border:1px solid green;">✅</button>`
                        : ''}
                    <button class="reject-btn" style="background:#fdd3d3;border:1px solid red;">❌ حذف</button>
                    <button class="pin-btn" style="background:${note.isPinned ? '#ffd700' : '#eee'}; border:1px solid #ccc;">
                        ${note.isPinned ? 'Unpin' : '📌 Pin'}
                    </button>
                </div>` : ''}
            `;

            // Bind Events (Module safety)
            const trigger = bubble.querySelector(`#react-trigger-${note.id}`);
            if (trigger) trigger.onclick = () => togglePicker(note.id);

            // Picker buttons
            const emojiBtns = bubble.querySelectorAll('.emoji-btn');
            emojiBtns.forEach(btn => {
                btn.onclick = () => addReaction(btn.dataset.id, btn.dataset.emoji);
            });

            if (isAdmin) {
                const approveBtn = bubble.querySelector('.approve-btn');
                if (approveBtn) approveBtn.onclick = () => approveMessage(note.id);

                const rejectBtn = bubble.querySelector('.reject-btn');
                if (rejectBtn) rejectBtn.onclick = () => rejectMessage(note.id);

                const pinBtn = bubble.querySelector('.pin-btn');
                if (pinBtn) pinBtn.onclick = () => togglePin(note.id, note.isPinned);
            }

            listContainer.appendChild(bubble);
        });
    });

    // End Grouped Rendering
}

function scrollToMessage(id) {
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// --- Reaction Functions ---

window.togglePicker = function (id) {
    const picker = document.getElementById(`picker-${id}`);
    const allPickers = document.querySelectorAll('.reaction-picker');
    allPickers.forEach(p => {
        if (p !== picker) p.classList.add('hidden');
    });

    // Toggle logic simple
    if (picker.classList.contains('hidden')) {
        picker.classList.remove('hidden');
    } else {
        picker.classList.add('hidden');
    }
}

window.addReaction = async function (id, emoji) {
    // Hide picker immediately
    const picker = document.getElementById(`picker-${id}`);
    if (picker) picker.classList.add('hidden');

    // Check LocalStorage
    const reacted = JSON.parse(localStorage.getItem('reacted_messages') || '{}');
    if (reacted[id]) {
        alert("لقد قمت بالتفاعل مع هذه الرسالة مسبقاً! ❤️");
        return;
    }

    const msgRef = doc(db, "messages", id);
    const note = notes.find(n => n.id === id);
    if (!note) return;

    // Safety check for undefined legacy fields
    const currentCounts = note.reactionCounts || {};

    // Migration fallback (only once per load really, but safe here)
    if (emoji === '❤️' && !currentCounts['❤️'] && note.likes > 0) {
        currentCounts['❤️'] = note.likes;
    }

    currentCounts[emoji] = (currentCounts[emoji] || 0) + 1;

    // Save to LocalStorage
    reacted[id] = emoji;
    localStorage.setItem('reacted_messages', JSON.stringify(reacted));

    await updateDoc(msgRef, {
        reactionCounts: currentCounts
    });
}

async function handleSubmit(e) {
    e.preventDefault();
    const textVal = document.getElementById('message-text').value;
    if (!textVal && !audioBase64) return alert("يرجى كتابة رسالة أو تسجيل صوت.");

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
        await addDoc(collection(db, "messages"), {
            sender: document.getElementById('sender').value || "Anonymous",
            receiver: document.getElementById('receiver').value,
            text: textVal,
            audioData: audioBase64,
            timestamp: serverTimestamp(),
            formattedTime: formattedTime,
            status: 'pending',
            isPinned: false,
            likes: 0,
            reactionCounts: {}
        });
        window.closeCompose();
        alert("تم الإرسال للمدير للمراجعة! 🚀");
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("حدث خطأ أثناء الإرسال");
    }
}

async function togglePin(id, currentStatus) {
    const msgRef = doc(db, "messages", id);
    await updateDoc(msgRef, {
        isPinned: !currentStatus
    });
}

// --- Admin Actions ---

async function approveMessage(id) {
    const msgRef = doc(db, "messages", id);
    await updateDoc(msgRef, {
        status: 'approved'
    });
}

async function rejectMessage(id) {
    const msgRef = doc(db, "messages", id);
    await deleteDoc(msgRef);
}

function toggleAdmin() {
    console.log("Admin toggle clicked");
    if (!isAdmin) {
        // Entering Admin Mode
        const password = prompt("الرجاء إدخال كلمة المرور للمدير:");
        if (password && password.trim() === "rami2244") {
            isAdmin = true;
            document.body.classList.add('admin-mode');
            const headerTitle = document.querySelector('.header-title');
            headerTitle.innerText = "لوحة المدير (Admin)";
            renderMessages();
        } else if (password !== null) { // Don't alert if user cancelled
            alert("كلمة المرور خاطئة!");
        }
    } else {
        // Exiting Admin Mode
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        const headerTitle = document.querySelector('.header-title');
        headerTitle.innerText = "صفحة الامتنان";
        renderMessages();
    }
}

// --- Events ---
form.addEventListener('submit', handleSubmit);
adminToggle.addEventListener('click', toggleAdmin);

// Global Exposure for HTML onclicks
// Note: With Modules, functions aren't global by default.
// We effectively bound them above or attached to window where necessary.
// --- Unified School Student Session Handler ---
const urlParams = new URLSearchParams(window.location.search);
const uName = urlParams.get('student_name');
const uClass = urlParams.get('student_class');

if (uName) {
    const fullProfile = uClass ? `${uName} (${uClass})` : uName;
    localStorage.setItem('school_unified_student_name', uName);
    if (uClass) localStorage.setItem('school_unified_student_class', uClass);
    localStorage.setItem('emtnan_unified_sender', fullProfile);
}

window.openCompose = function () {
    document.getElementById('compose-modal').style.display = 'flex';
    const senderInput = document.getElementById('sender');
    if (senderInput && !senderInput.value) {
        const savedSender = localStorage.getItem('emtnan_unified_sender') || localStorage.getItem('school_unified_student_name');
        const savedClass = localStorage.getItem('school_unified_student_class');
        if (savedSender) {
            senderInput.value = savedClass ? `${savedSender} (${savedClass})` : savedSender;
        }
    }
}

window.closeCompose = function () {
    const modal = document.getElementById('compose-modal');
    const form = document.getElementById('compose-form');
    modal.style.display = 'none';
    form.reset();
    clearAudio(); // Reset audio state
}

// Voice Recording Logic
window.toggleRecording = async function () {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        // Start Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                document.getElementById('audio-preview').src = audioUrl;
                document.getElementById('audio-preview-container').style.display = 'flex';

                // Convert to Base64
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    audioBase64 = reader.result;
                }
            };

            mediaRecorder.start();
            document.getElementById('record-btn').innerHTML = '<i class="fas fa-stop"></i> إيقاف';
            document.getElementById('record-btn').classList.add('recording');
            document.getElementById('record-status').style.display = 'inline';

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("لا يمكن الوصول للميكروفون");
        }
    } else {
        // Stop Recording
        mediaRecorder.stop();
        document.getElementById('record-btn').innerHTML = '<i class="fas fa-microphone"></i> تسجيل';
        document.getElementById('record-btn').classList.remove('recording');
        document.getElementById('record-status').style.display = 'none';
    }
}

window.clearAudio = function () {
    audioBlob = null;
    audioBase64 = null;
    audioChunks = [];
    document.getElementById('audio-preview').src = '';
    document.getElementById('audio-preview-container').style.display = 'none';
}
