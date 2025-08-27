const fs = require('fs');
const path = require('path');

const requestsPath = path.join(__dirname, 'data/requests.json');

let requests = [];
try {
  requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
} catch (err) {
  console.error("Failed to read requests.json:", err);
  process.exit(1);
}

requests = requests.map(req => ({
  ...req,
  notes: req.notes || "",
  email: req.email || ""
}));

fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
console.log("✅ All existing requests updated with email and notes fields!");
