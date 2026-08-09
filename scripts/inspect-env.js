const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });
console.log("Has SERVICE_ACCOUNT_KEY:", !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
console.log("Has PRIVATE_KEY:", !!process.env.FIREBASE_PRIVATE_KEY);
if (process.env.FIREBASE_PRIVATE_KEY) {
  console.log(JSON.stringify(process.env.FIREBASE_PRIVATE_KEY).slice(0, 50));
}
