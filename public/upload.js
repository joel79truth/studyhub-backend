const form = document.getElementById("uploadForm");
const messageEl = document.getElementById("uploadMessage");

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
