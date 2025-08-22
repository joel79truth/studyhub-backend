document.addEventListener('DOMContentLoaded', () => {
  let allFiles = [];
  let selectedSemester = '';

  const subjectsContainer = document.getElementById('subjectsContainer');
  const fileList = document.getElementById('fileList');
  const closeSubjectBtn = document.getElementById('closeSubjectBtn');

  closeSubjectBtn?.addEventListener('click', () => {
    subjectsContainer.innerHTML = '';
    fileList.innerHTML = '';
    closeSubjectBtn.style.display = 'none';
  });

  // ----------------------
  // Load and flatten metadata.json
  // ----------------------
  async function loadAllFiles() {
    try {
      const res = await fetch('metadata.json');
      if (!res.ok) throw new Error('HTTP error ' + res.status);
      const data = await res.json();

      allFiles = [];

      // Basics → semester → subject → files[]
      if (data.basics) {
        Object.values(data.basics).forEach(semesterObj => {
          Object.values(semesterObj).forEach(subjectFiles => {
            allFiles.push(...subjectFiles);
          });
        });
      }

      // Programs → programName → files[]
      if (data.programs) {
        Object.values(data.programs).forEach(filesArr => {
          allFiles.push(...filesArr);
        });
      }

      console.log('Files loaded:', allFiles);
    } catch (err) {
      console.error('Error loading files:', err);
      subjectsContainer.innerHTML = '<p>Failed to load subjects.</p>';
    }
  }

  // ----------------------
  // Semester filter
  // ----------------------
  window.filterSemester = function(semester) {
    selectedSemester = semester.toString();
    const subjects = [...new Set(
      allFiles.filter(f => f.semester === selectedSemester)
              .map(f => f.subject)
    )];
    showSubjects(subjects);
  };

  function showSubjects(subjects) {
    subjectsContainer.innerHTML = '';
    if (!subjects.length) {
      subjectsContainer.innerHTML = '<p>No subjects found for this semester.</p>';
      return;
    }
    subjects.forEach(subject => {
      const btn = document.createElement('button');
      btn.textContent = subject;
      btn.className = 'subject-btn';
      btn.onclick = () => showFilesForSubject(subject);
      subjectsContainer.appendChild(btn);
    });
    closeSubjectBtn.style.display = 'inline-block';
  }

  // ----------------------
  // Show files by subject
  // ----------------------
  window.showFilesForSubject = function(subject) {
    fileList.innerHTML = '';
    const files = allFiles.filter(f => f.subject === subject && f.semester === selectedSemester);
    if (!files.length) {
      fileList.innerHTML = '<p>No files found for this subject.</p>';
      return;
    }
    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';
      card.innerHTML = `
        <h3>${file.name}</h3>
        <p><strong>Program:</strong> ${file.program}</p>
        <p><strong>Semester:</strong> ${file.semester}</p>
        <p><strong>Subject:</strong> ${file.subject}</p>
        <div class="button-group">
          <button onclick="window.open('${file.url}', '_blank')">👁 View</button>
          <a href="${file.url}" download class="btn download-btn">⬇️ Download</a>
        </div>
      `;
      fileList.appendChild(card);
    });
  };

  // ----------------------
  // Search
  // ----------------------
  window.handleSearch = async function() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!query) {
      fileList.innerHTML = '<p>Please enter a search keyword.</p>';
      return;
    }
    const filtered = allFiles.filter(f =>
      (f.name || '').toLowerCase().includes(query) ||
      (f.subject || '').toLowerCase().includes(query) ||
      (f.program || '').toLowerCase().includes(query)
    );
    fileList.innerHTML = filtered.length === 0
      ? '<p>No matching notes found.</p>'
      : filtered.map(f => `
        <div class="file-card">
          <h3>${f.name}</h3>
          <p><strong>Program:</strong> ${f.program}</p>
          <p><strong>Semester:</strong> ${f.semester}</p>
          <p><strong>Subject:</strong> ${f.subject}</p>
          <div class="button-group">
            <button onclick="window.open('${f.url}', '_blank')">👁 View</button>
            <a href="${f.url}" download class="btn download-btn">⬇️ Download</a>
          </div>
        </div>
      `).join('');
  };

  // Load files on page start
  loadAllFiles();
});
