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

async function fetchGameServicesByBrand(brandName, status = 'available') {
    if (!API_KEY || !API_ID) {
        console.error('❌ Error: VIPRESELLER_API_KEY or VIPRESELLER_API_ID is missing in .env');
        process.exit(1);
    }

    console.log('🔍 Fetching VIPReseller Services by BRAND');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📦 Brand: ${brandName}`);
    console.log(`📊 Status: ${status}`);
    console.log(`🔑 API ID: ${API_ID}`);
    console.log('');

    try {
        const formData = new FormData();
        formData.append('key', API_KEY);
        formData.append('sign', generateSign());
        formData.append('type', 'services');
        formData.append('filter_game', brandName);
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

        if (data.result === true && Array.isArray(data.data)) {
            console.log(`✅ Success! Found ${data.data.length} services\n`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            // Group by category (game field)
            const groupedByCategory = {};
            data.data.forEach(service => {
                const category = service.game || 'Unknown';
                if (!groupedByCategory[category]) {
                    groupedByCategory[category] = [];
                }
                groupedByCategory[category].push(service);
            });

            // Display summary
            console.log('📊 SUMMARY BY CATEGORY:\n');
            Object.keys(groupedByCategory).sort().forEach(category => {
                console.log(`   ${category}: ${groupedByCategory[category].length} services`);
            });
            console.log('');

            // Save to file
            const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const filename = `vipreseller-brand-${brandName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`;
            const outputPath = path.join(process.cwd(), 'scripts', filename);

            const output = {
                fetchedAt: new Date().toISOString(),
                filterType: 'brand',
                filterValue: brandName,
                status: status,
                totalServices: data.data.length,
                categoriesFound: Object.keys(groupedByCategory).length,
                categories: groupedByCategory,
                rawData: data.data
            };

            fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
            console.log(`💾 Data saved to: ${filename}\n`);

            // Display first 3 services as sample
            console.log('📝 SAMPLE SERVICES (first 3):\n');
            data.data.slice(0, 3).forEach((service, idx) => {
                console.log(`${idx + 1}. ${service.name}`);
                console.log(`   Code: ${service.code}`);
                console.log(`   Category: ${service.game}`);
                console.log(`   Price Basic: Rp ${service.price?.basic?.toLocaleString('id-ID')}`);
                console.log(`   Status: ${service.status}`);
                console.log('');
            });

            return output;
        } else {
            console.error('❌ Failed to fetch services');
            console.error('Response:', data);
            return null;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Main execution
const BRAND_NAME = process.argv[2] || 'Mobile Legends';
const STATUS = process.argv[3] || 'available';

fetchGameServicesByBrand(BRAND_NAME, STATUS)
    .then(() => {
        console.log('✅ Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    });
