
// Import Firebase (make sure version matches your Firebase SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js";

// 1️⃣ Initialize Firebase
const firebaseConfig = {
 apiKey: "AIzaSyAtK_FW9fIOihmnECEngkElA2QCsoRYUA0",
  authDomain: "studyhub-backend.firebaseapp.com",
   projectId: "studyhub-backend",
  storageBucket: "studyhub-backend.firebasestorage.app",
  messagingSenderId: "985257842533",
  appId: "1:985257842533:web:cdba8c4138b3f7a3ad338c",
};
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 2️⃣ Request notification permission
Notification.requestPermission().then((permission) => {
  if (permission === "granted") {
    console.log("Notification permission granted.");

    // 3️⃣ Get FCM token for this user
    getToken(messaging, { vapidKey: "YOUR_PUBLIC_VAPID_KEY" }).then((currentToken) => {
      if (currentToken) {
        console.log("FCM Token:", currentToken);
        // TODO: save this token in Firebase Firestore to send notifications later
      } else {
        console.log("No registration token available. Request permission to generate one.");
      }
    }).catch((err) => {
      console.error("An error occurred while retrieving token. ", err);
    });
  } else {
    console.log("Notification permission denied.");
  }
});

// 4️⃣ Handle foreground messages
onMessage(messaging, (payload) => {
  console.log("Message received. ", payload);
  alert(payload.notification.title + "\n" + payload.notification.body); // simple demo
});







document.addEventListener('DOMContentLoaded', () => {
  let allFiles = [];
  let selectedSemester = '';

  const subjectsContainer = document.getElementById('subjectsContainer');
  const fileList = document.getElementById('fileList');
  const closeSubjectBtn = document.getElementById('closeSubjectBtn');

  // ----------------------
  // Close subject view
  // ----------------------
  closeSubjectBtn?.addEventListener('click', () => {
    subjectsContainer.innerHTML = '';
    fileList.innerHTML = '';
    closeSubjectBtn.style.display = 'none';
  });

  // ----------------------
  // Load metadata.json and flatten all files
  // ----------------------
  async function loadAllFiles() {
    try {
      const res = await fetch('/api/metadata'); // Fetch from server
      if (!res.ok) throw new Error('HTTP error ' + res.status);
      const data = await res.json();

      allFiles = [];

      // Flatten basics: semester -> subject -> files[]
      if (data.basics) {
        Object.entries(data.basics).forEach(([semester, subjectsObj]) => {
          Object.entries(subjectsObj).forEach(([subject, filesArr]) => {
            filesArr.forEach(f => allFiles.push(f));
          });
        });
      }

      // Flatten programs: programName -> files[]
      if (data.programs) {
        Object.values(data.programs).forEach(filesArr => {
          filesArr.forEach(f => allFiles.push(f));
        });
      }

      console.log('All files loaded:', allFiles);
    } catch (err) {
      console.error('Failed to load files:', err);
      subjectsContainer.innerHTML = '<p>Failed to load subjects.</p>';
    }
  }

  // ----------------------
  // Filter subjects by semester
  // ----------------------
  window.filterSemester = function(semester) {
    selectedSemester = semester.toString();
    const subjects = [...new Set(
      allFiles
        .filter(f => f.semester === selectedSemester)
        .map(f => f.subject)
    )];
    renderSubjects(subjects);
  };

  function renderSubjects(subjects) {
    subjectsContainer.innerHTML = '';
    if (!subjects.length) {
      subjectsContainer.innerHTML = '<p>No subjects found for this semester.</p>';
      return;
    }
    subjects.forEach(subject => {
      const btn = document.createElement('button');
      btn.textContent = subject;
      btn.className = 'subject-btn';
      btn.addEventListener('click', () => renderFiles(subject));
      subjectsContainer.appendChild(btn);
    });
    closeSubjectBtn.style.display = 'inline-block';
    fileList.innerHTML = '';
  }

  // ----------------------
  // Show files for a subject
  // ----------------------
  function renderFiles(subject) {
    fileList.innerHTML = '';
    const files = allFiles.filter(f => f.subject === subject && f.semester === selectedSemester);
    if (!files.length) {
      fileList.innerHTML = '<p>No files found for this subject.</p>';
      return;
    }

    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';

      // Clean path
      let fileQueryPath = file.url;
      if (fileQueryPath.startsWith('/')) fileQueryPath = fileQueryPath.slice(1);

      card.innerHTML = `
        <h3>${file.name}</h3>
        <p><strong>Program:</strong> ${file.program}</p>
        <p><strong>Semester:</strong> ${file.semester}</p>
        <p><strong>Subject:</strong> ${file.subject}</p>
        <div class="button-group">
          <button onclick="window.open('view.html?file=' + encodeURIComponent('${fileQueryPath}'), '_blank')">👁 View</button>
          <a href="${file.url}" download class="btn download-btn">⬇️ Download</a>
        </div>
      `;
      fileList.appendChild(card);
    });
  }

  // ----------------------
  // Search across all files
  // ----------------------
  window.handleSearch = function() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!query) {
      fileList.innerHTML = '<p>Please enter a search keyword.</p>';
      return;
    }
    const results = allFiles.filter(f =>
      (f.name || '').toLowerCase().includes(query) ||
      (f.subject || '').toLowerCase().includes(query) ||
      (f.program || '').toLowerCase().includes(query)
    );

    fileList.innerHTML = results.length === 0
      ? '<p>No matching notes found.</p>'
      : results.map(f => {
          let fileQueryPath = f.url.startsWith('/') ? f.url.slice(1) : f.url;
          return `
            <div class="file-card">
              <h3>${f.name}</h3>
              <p><strong>Program:</strong> ${f.program}</p>
              <p><strong>Semester:</strong> ${f.semester}</p>
              <p><strong>Subject:</strong> ${f.subject}</p>
              <div class="button-group">
                <button onclick="window.open('view.html?file=' + encodeURIComponent('${fileQueryPath}'), '_blank')">👁 View</button>
                <a href="${f.url}" download class="btn download-btn">⬇️ Download</a>
              </div>
            </div>
          `;
        }).join('');
  };

  // ----------------------
  // Initial load
  // ----------------------
  loadAllFiles();
});
