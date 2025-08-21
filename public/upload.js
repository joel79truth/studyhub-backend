document.getElementById("uploadForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const program = document.getElementById("program").value.trim();
  const semester = document.getElementById("semester").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const file = document.getElementById("file").files[0];

  if (!program || !semester || !subject || !file) {
    alert("❌ Please fill in all fields and select a file.");
    return;
  }

  const formData = new FormData();
  formData.append("program", program);
  formData.append("semester", semester);
  formData.append("subject", subject);
  formData.append("file", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
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
