const pdf = require("pdf-parse");
const natural = require("natural");
const { GPT4All } = require("gpt4all-node");

// Load GPT4All model (small local GPT-style model)
const model = new GPT4All({ model: "gpt4all-lora-quantized.bin" });

let aiIndex = []; // { id, text, vector }

// ------------------ EMBEDDING ------------------
function embedText(text) {
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const vector = {};
  tokens.forEach(t => vector[t] = (vector[t] || 0) + 1);
  return vector;
}

function cosineSim(vecA, vecB) {
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0, magA = 0, magB = 0;
  allKeys.forEach(k => {
    const a = vecA[k] || 0;
    const b = vecB[k] || 0;
    dot += a * b;
    magA += a*a;
    magB += b*b;
  });
  if(magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ------------------ LOAD PDFs ------------------
async function loadPDFs(supabase, bucket) {
  const { data: files } = await supabase.from("files").select("*");
  for (const file of files) {
    try {
      const { data: pdfData } = await supabase.storage.from(bucket).download(file.path);
      const buffer = Buffer.from(await pdfData.arrayBuffer());
      const pdfText = (await pdf(buffer)).text;
      aiIndex.push({ id: file.id, text: pdfText, vector: embedText(pdfText) });
    } catch (err) {
      console.error("Failed to load PDF:", file.filename, err.message);
    }
  }
  console.log(`✅ Loaded ${aiIndex.length} PDFs into AI index`);
}

// ------------------ RETRIEVE RELEVANT TEXT ------------------
function retrieveRelevant(query, top=3) {
  const qVec = embedText(query);
  const scored = aiIndex.map(doc => ({
    ...doc,
    score: cosineSim(qVec, doc.vector)
  }));
  scored.sort((a,b)=>b.score - a.score);
  return scored.slice(0, top).map(d => d.text).join("\n\n");
}

// ------------------ ASK LLM ------------------
async function askAI(question) {
  const context = retrieveRelevant(question, 3);
  const prompt = `
You are an AI tutor. Use the following knowledge base to answer the question.
Knowledge Base:
${context}

Question: ${question}
Answer conversationally and explain logic clearly.
  `;
  const response = await model.generate(prompt, { max_tokens: 300 });
  return response.text;
}

module.exports = { loadPDFs, askAI };
