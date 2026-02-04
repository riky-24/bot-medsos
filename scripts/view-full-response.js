import fetch from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const API_KEY = process.env.VIPRESELLER_API_KEY;
const API_ID = process.env.VIPRESELLER_API_ID;
const BASE_URL = 'https://vip-reseller.co.id/api/game-feature';

function generateSign() {
    const id = String(API_ID || '').trim();
    const key = String(API_KEY || '').trim();
    return crypto
        .createHash('md5')
        .update(id + key)
        .digest('hex');
}

async function viewFullResponse(categoryName, status = 'available') {
    if (!API_KEY || !API_ID) {
        console.error('❌ Error: VIPRESELLER_API_KEY or VIPRESELLER_API_ID is missing in .env');
        process.exit(1);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📂 KATEGORI: ${categoryName}`);
    console.log(`📊 STATUS: ${status}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
        const formData = new FormData();
        formData.append('key', API_KEY);
        formData.append('sign', generateSign());
        formData.append('type', 'services');
        formData.append('filter_game', categoryName);
        formData.append('filter_status', status);

        console.log('⏳ Sending request to VIPReseller API...\n');

        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        const data = await response.json();

        // Display full response
        console.log('📋 FULL API RESPONSE:\n');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n');

        if (data.result === true && Array.isArray(data.data)) {
            console.log(`✅ Total Services: ${data.data.length}\n`);

            // Save to file
            const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const filename = `full-response-${categoryName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`;
            const outputPath = path.join(process.cwd(), 'scripts', filename);

            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
            console.log(`💾 Full response saved to: ${filename}`);

            // Display sample with details
            console.log('\n📝 SAMPLE SERVICE (first item with full details):\n');
            if (data.data[0]) {
                console.log(JSON.stringify(data.data[0], null, 2));
            }
        } else {
            console.error('❌ Failed or no data returned');
        }

        return data;
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

async function main() {
    console.log('\n🔍 VIEWING FULL API RESPONSES FOR MOBILE LEGENDS CATEGORIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const categories = ['Mobile Legends Gift'];

    for (const category of categories) {
        await viewFullResponse(category, 'available');

        // Delay to avoid rate limit
        if (category !== categories[categories.length - 1]) {
            console.log('\n⏸️  Waiting 2 seconds before next request...\n');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All responses retrieved and saved!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    });
