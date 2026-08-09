const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    const result = await model.generateContent("hello");
    console.log("Success with gemini-3.5-flash-lite:", result.response.text());
  } catch(e) {
    console.error("Error with gemini-3.5-flash-lite:", e.message);
  }
}
run();
