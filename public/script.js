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
