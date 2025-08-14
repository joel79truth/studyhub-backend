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

  // Check elements exist before adding events
  if (menuIcon && sidebar) {
    menuIcon.onclick = () => {
      sidebar.style.display = "block";
    };
  }

  if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.onclick = () => {
      sidebar.style.display = "none";
    };
  }

  if (toggleDarkModeBtn) {
    toggleDarkModeBtn.onclick = () => {
      document.body.classList.toggle("dark-mode");
    };
  }

  if (closeSubjectBtn && subjectsContainer && fileList && viewerContainer) {
    closeSubjectBtn.onclick = () => {
      subjectsContainer.innerHTML = '';
      fileList.innerHTML = '';
      viewerContainer.style.display = "none";
      closeSubjectBtn.style.display = "none";
    };
  }

  window.filterSemester = function(semester) {
    selectedSemester = semester;
    fetch('metadata.json')
      .then(res => res.json())
      .then(data => {
        allFiles = data.files || [];
        const subjects = [...new Set(allFiles
          .filter(file => file.semester === semester)
          .map(file => file.subject))];
        showSubjects(subjects);
      })
      .catch(err => {
        console.error('Error loading metadata.json:', err);
        subjectsContainer.innerHTML = '<p>Failed to load subjects.</p>';
      });
  };

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
        <div class="button-group">
          <button onclick="window.location.href='view.html?file=${encodeURIComponent(file.url)}'">👁 View</button>
          <a href="${file.url}" download class="btn download-btn">⬇️ Download</a>
        </div>
      `;
      fileList.appendChild(card);
    });
  };

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

  function extractYouTubeID(url) {
    const match = url.match(/(?:youtu\.be\/|v=)([^&]+)/);
    return match ? match[1] : null;
  }

  window.goToViewer = function(url, youtubeLinks = []) {
    const params = new URLSearchParams();
    params.set('file', url);
    params.set('videos', JSON.stringify(youtubeLinks));
    window.location.href = "view.html?" + params.toString();
  };

  window.createFileCard = function(file) {
    return `
      <div class="file-card">
        <h3>${file.name}</h3>
        <p><strong>Program:</strong> ${file.program || 'N/A'}</p>
        <p><strong>Semester:</strong> ${file.semester || 'N/A'}</p>
        <p><strong>Subject:</strong> ${file.subject || 'N/A'}</p>
        <div class="button-group">
          <button onclick="window.open('${file.url}', '_blank')">👁 View</button>
          <a href="${file.url}" download class="btn download-btn">⬇️ Download</a>
        </div>
        ${file.youtubeLinks?.length
          ? `<p><strong>YouTube Tutorials:</strong> ${file.youtubeLinks.map(link => `<a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>`).join(', ')}</p>`
          : ''
        }
      </div>
    `;
  };

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered successfully:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
});
