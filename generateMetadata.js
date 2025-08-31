






const fs = require('fs');
const path = require('path');

// Path to your program folder
const folderPath = path.join(__dirname, 'program');

// Initialize metadata object
const data = {};

// Read all program folders inside 'program'
const programs = fs.readdirSync(folderPath).filter(f => 
  fs.statSync(path.join(folderPath, f)).isDirectory()
);

programs.forEach(program => {
  const programPath = path.join(folderPath, program);

  // Get all pdf and pptx files in the program folder
  const files = fs.readdirSync(programPath).filter(f => 
    f.endsWith('.pdf') || f.endsWith('.pptx')
  );

  // Add files under the program
  data[program] = {
    "All Topics": files.map(file => ({
      name: file,
      url: `program/${program}/${file}`
    }))
  };
});

// Save to metadata.json
fs.writeFileSync('metadata.json', JSON.stringify(data, null, 2));

console.log('✅ metadata.json generated successfully!');




