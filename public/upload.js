const form = document.getElementById("uploadForm");
const messageEl = document.getElementById("uploadMessage");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");

form.addEventListener("submit", async function(e) {
  e.preventDefault();

  const program = document.getElementById("program").value.trim();
  const semester = document.getElementById("semester").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const fileInput = document.getElementById("file");

  messageEl.textContent = "";
  messageEl.className = "message";

  if (!fileInput.files.length || !program || !semester || !subject) {
    messageEl.textContent = "⚠️ Please fill in all fields and select a file.";
    messageEl.classList.add("error");
    return;
  }

  const formData = new FormData();
  formData.append("program", program);
  formData.append("semester", semester);
  formData.append("subject", subject);
  formData.append("file", fileInput.files[0]);

  progressContainer.style.display = "block";
  progressBar.style.width = "0%";

  try {
    // Use XMLHttpRequest to track upload progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        progressBar.style.width = percent + "%";
      }
    });

    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 200) {
        messageEl.textContent = "✅ Upload successful!";
        messageEl.classList.add("success");
        form.reset();
        progressBar.style.width = "100%";
        setTimeout(() => { progressContainer.style.display = "none"; progressBar.style.width = "0%"; }, 1000);
      } else {
        messageEl.textContent = "❌ Upload failed: " + (result.message || "Server error");
        messageEl.classList.add("error");
        progressContainer.style.display = "none";
        progressBar.style.width = "0%";
      }
    };

    xhr.onerror = () => {
      messageEl.textContent = "❌ An error occurred during upload.";
      messageEl.classList.add("error");
      progressContainer.style.display = "none";
      progressBar.style.width = "0%";
    };

    xhr.send(formData);
  } catch (err) {
    console.error(err);
    messageEl.textContent = "❌ An error occurred during upload.";
    messageEl.classList.add("error");
    progressContainer.style.display = "none";
    progressBar.style.width = "0%";
  }
});
