document.getElementById("uploadForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const program = document.getElementById("program").value.trim();
  const semester = document.getElementById("semester").value;
  const file = document.getElementById("fileInput").files[0];

  if (!name || !subject || !program || !semester || !file) {
    alert("⚠️ Please fill in all fields.");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("subject", subject);
  formData.append("program", program);
  formData.append("semester", semester);
  formData.append("file", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (res.ok) {
      alert("✅ Upload successful!");
      document.getElementById("uploadForm").reset();
    } else {
      alert("❌ Upload failed: " + result.message);
    }
  } catch (err) {
    console.error(err);
    alert("❌ An error occurred during upload.");
  }
});
