import dotenv from 'dotenv';
import http from 'https';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your-gemini-api-key-here') {
  console.error('Error: GEMINI_API_KEY is not configured in .env file.');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Available models:');
      if (parsed.models) {
        parsed.models.forEach((m: any) => {
          console.log(`- Name: ${m.name}, DisplayName: ${m.displayName}`);
        });
      } else {
        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.error('Request failed:', err);
});
