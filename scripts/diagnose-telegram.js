import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';

// 1. Load .env exactly like the app does
const envConfig = dotenv.config();

if (envConfig.error) {
    console.error("❌ Error loading .env file:", envConfig.error);
    process.exit(1);
}

const token = process.env.TELEGRAM_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL || process.env.APP_BASE_URL;

console.log("\n🔍 --- Telegram Diagnostic --- 🔍\n");

// 2. Check Token Format
if (!token) {
    console.error("❌ TELEGRAM_TOKEN IS MISSING in .env");
    process.exit(1);
}

console.log(`Token Length: ${token.length}`);
console.log(`Token Raw (First 10 chars): '${token.substring(0, 10)}...'`);

// Check for hidden characters
const hasNewline = token.includes('\n') || token.includes('\r');
const hasSpace = token.includes(' ');

if (hasNewline) console.error("❌ WARNING: Token contains NEWLINE characters!");
if (hasSpace) console.error("❌ WARNING: Token contains SPACE characters!");

if (!hasNewline && !hasSpace) {
    console.log("✅ Token format looks clean (no spaces or newlines).");
}

// 3. Test API Connectivity (getMe)
console.log("\nTesting Telegram API (getMe)...");

const req = https.request(`https://api.telegram.org/bot${token}/getMe`, { method: 'GET' }, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
        try {
            const response = JSON.parse(body);
            if (response.ok) {
                console.log("✅ API Success! Bot authorized.");
                console.log(`   Bot Name: ${response.result.first_name}`);
                console.log(`   Username: @${response.result.username}`);
            } else {
                console.error("❌ API Error:");
                console.error(`   Code: ${response.error_code}`);
                console.error(`   Description: ${response.description}`);

                if (response.error_code === 404) {
                    console.error("\n👉 DIAGNOSIS: 404 means the TOKEN IS INVALID. Double check it with BotFather.");
                }
            }
        } catch (err) {
            console.error("❌ Failed to parse response:", err);
            console.log("Raw Body:", body);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Network Error: ${e.message}`);
});

req.end();

// 4. Check Webhook URL logic
if (webhookUrl) {
    console.log(`\nChecking Webhook URL in config: ${webhookUrl}`);
    if (!webhookUrl.startsWith('https://')) {
        console.error("❌ Webhook URL must start with https://");
    } else {
        console.log("✅ Webhook URL format is valid.");
    }
} else {
    console.log("\n⚠️ WEBHOOK_URL / APP_BASE_URL not set in .env");
}
