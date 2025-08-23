// upload.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadForm");
  const messageEl = document.getElementById("uploadMessage");
  const fileInput = document.getElementById("file");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageEl.textContent = "";
    messageEl.className = "message";

    const program = document.getElementById("program").value.trim();
    const semester = document.getElementById("semester").value.trim();
    const subject = document.getElementById("subject").value.trim();

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

    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const result = await res.json();

      if (res.ok) {
        messageEl.textContent = "✅ Upload successful!";
        messageEl.classList.add("success");
        form.reset();
      } else {
        messageEl.textContent = "❌ Upload failed: " + result.message;
        messageEl.classList.add("error");
      }
    } catch (err) {
      console.error(err);
      messageEl.textContent = "❌ An error occurred during upload.";
      messageEl.classList.add("error");
    }
  });

  // Optional: show selected file name
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      messageEl.textContent = `Selected file: ${fileInput.files[0].name}`;
      messageEl.className = "message";
    }
  });
});
