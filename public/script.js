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

  async function loadAllFiles() {
    try {
      const res = await fetch('metadata.json'); // local JSON
      if (!res.ok) throw new Error('HTTP error ' + res.status);
      const data = await res.json();
      allFiles = data.files || [];
      console.log('Files loaded:', allFiles);
    } catch (err) {
      console.error('Error loading files:', err);
      subjectsContainer.innerHTML = '<p>Failed to load subjects.</p>';
    }
  }

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

  loadAllFiles();
});
