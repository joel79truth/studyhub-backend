document.addEventListener('DOMContentLoaded', () => {
  let allFiles = [];
  let selectedSemester = '';

  const menuIcon = document.getElementById("menuIcon");
  const sidebar = document.getElementById("sidebar");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const toggleDarkModeBtn = document.getElementById("toggleDarkMode");
  const closeSubjectBtn = document.getElementById("closeSubjectBtn");
  const subjectsContainer = document.getElementById("subjectsContainer");
  const fileList = document.getElementById("fileList");
  const viewerContainer = document.getElementById("viewerContainer");
  const pdfViewer = document.getElementById("pdfViewer");
  const youtubeTutorials = document.getElementById("youtubeTutorials");

  // Sidebar toggle
  menuIcon?.addEventListener('click', () => sidebar.style.display = "block");
  closeSidebarBtn?.addEventListener('click', () => sidebar.style.display = "none");

  // Dark mode toggle
  toggleDarkModeBtn?.addEventListener('click', () => document.body.classList.toggle("dark-mode"));

  // Close subject view
  closeSubjectBtn?.addEventListener('click', () => {
    subjectsContainer.innerHTML = '';
    fileList.innerHTML = '';
    viewerContainer.style.display = "none";
    closeSubjectBtn.style.display = "none";
  });

  // Fetch metadata and flatten both "programs" and "basics"
  function loadAllFiles() {
    fetch('metadata.json')
      .then(res => res.json())
      .then(data => {
        allFiles = [];

        // Add program files
        if (data.programs) {
          Object.keys(data.programs).forEach(programName => {
            data.programs[programName].forEach(file => allFiles.push(file));
          });
        }

        // Add basics files
        if (data.basics) {
          Object.keys(data.basics).forEach(semester => {
            Object.keys(data.basics[semester]).forEach(subject => {
              data.basics[semester][subject].forEach(file => allFiles.push(file));
            });
          });
        }

        // If a semester is already selected, refresh the subjects view
        if (selectedSemester) {
          filterSemester(selectedSemester);
        }
      })
      .catch(err => {
        console.error('Error loading metadata.json:', err);
        subjectsContainer.innerHTML = '<p>Failed to load subjects.</p>';
      });
  }

  // Filter files by semester
  window.filterSemester = function(semester) {
    selectedSemester = semester;
    const subjects = [...new Set(allFiles
      .filter(file => file.semester === semester)
      .map(file => file.subject))];
    showSubjects(subjects);
  };

  // Show subject buttons
  function showSubjects(subjects) {
    subjectsContainer.innerHTML = '';
    subjects.forEach(subject => {
      const btn = document.createElement("button");
      btn.textContent = subject;
      btn.onclick = () => showFilesForSubject(subject);
      subjectsContainer.appendChild(btn);
    });
    if (closeSubjectBtn) closeSubjectBtn.style.display = "inline-block";
  }

  // Show files for selected subject
  window.showFilesForSubject = function(subject) {
    fileList.innerHTML = '';
    const files = allFiles.filter(f => f.subject === subject && f.semester === selectedSemester);
    if (files.length === 0) {
      fileList.innerHTML = '<p>No files found for this subject.</p>';
      return;
    }
    files.forEach(file => {
      const card = document.createElement("div");
      card.className = "file-card";
      card.innerHTML = `
        <h3>${file.name}</h3>
        <p><strong>Program:</strong> ${file.program || 'N/A'}</p>
        <p><strong>Semester:</strong> ${file.semester || 'N/A'}</p>
        <p><strong>Subject:</strong> ${file.subject || 'N/A'}</p>
        <div class="button-group">
          <button onclick="window.open('${file.url}', '_blank')">👁 View</button>
          <a href="${file.url}" download class="btn download-btn">⬇️ Download</a>
        </div>
        ${file.youtubeLinks?.length
          ? `<p><strong>YouTube Tutorials:</strong> ${file.youtubeLinks.map(link => `<a href="${link}" target="_blank">${link}</a>`).join(', ')}</p>`
          : ''
        }
      `;
      fileList.appendChild(card);
    });
  };

  // View PDF with optional YouTube links
  window.viewFile = function(url, youtubeLinks = []) {
    if (!viewerContainer || !pdfViewer || !youtubeTutorials) return;
    pdfViewer.src = url;
    youtubeTutorials.innerHTML = '';
    youtubeLinks.forEach(link => {
      const videoId = extractYouTubeID(link);
      if (videoId) {
        youtubeTutorials.innerHTML += `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      }
    });
    viewerContainer.style.display = "block";
  };

  // Extract YouTube video ID
  function extractYouTubeID(url) {
    const match = url.match(/(?:youtu\.be\/|v=)([^&]+)/);
    return match ? match[1] : null;
  }

  // Initial load
  loadAllFiles();

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('Service Worker registered:', reg))
        .catch(err => console.error('SW registration failed:', err));
    });
  }
});
