const fs = require('fs');
const path = require('path');

// Path to your program folder
const folderPath = path.join(__dirname, 'program');

// Read all files in the folder
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf') || f.endsWith('.pptx'));

// Create JSON structure
const data = {
  "1": {}, // Semester 1
  "2": {}  // Semester 2
};

// Example: Just put all files under "Semester 1 -> General"
data["1"]["General"] = {
  "All Topics": files.map(file => ({
    name: file,
    url: `program/${file}`
  }))
};

// Save to metadata.json
fs.writeFileSync('metadata.json', JSON.stringify(data, null, 2));

console.log('✅ metadata.json generated successfully!');
