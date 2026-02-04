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

async function fetchGameServicesByCategory(categoryName, status = 'available') {
    if (!API_KEY || !API_ID) {
        console.error('❌ Error: VIPRESELLER_API_KEY or VIPRESELLER_API_ID is missing in .env');
        process.exit(1);
    }

    console.log('🔍 Fetching VIPReseller Services by CATEGORY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📂 Category: ${categoryName}`);
    console.log(`📊 Status: ${status}`);
    console.log(`🔑 API ID: ${API_ID}`);
    console.log('');

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

        if (data.result === true && Array.isArray(data.data)) {
            console.log(`✅ Success! Found ${data.data.length} services\n`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            // Check if all services belong to the same category
            const categories = [...new Set(data.data.map(s => s.game))];
            console.log('📊 ANALYSIS:\n');
            console.log(`   Total Services: ${data.data.length}`);
            console.log(`   Categories Found: ${categories.join(', ')}`);
            console.log(`   Is Single Category: ${categories.length === 1 ? '✅ Yes' : '⚠️ No, multiple categories!'}`);
            console.log('');

            // Price range analysis
            const prices = data.data.map(s => s.price?.basic || 0).filter(p => p > 0);
            if (prices.length > 0) {
                console.log('💰 PRICE RANGE:\n');
                console.log(`   Min: Rp ${Math.min(...prices).toLocaleString('id-ID')}`);
                console.log(`   Max: Rp ${Math.max(...prices).toLocaleString('id-ID')}`);
                console.log(`   Avg: Rp ${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString('id-ID')}`);
                console.log('');
            }

            // Save to file
            const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const filename = `vipreseller-category-${categoryName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`;
            const outputPath = path.join(process.cwd(), 'scripts', filename);

            const output = {
                fetchedAt: new Date().toISOString(),
                filterType: 'category',
                filterValue: categoryName,
                status: status,
                totalServices: data.data.length,
                categoriesFound: categories,
                isSingleCategory: categories.length === 1,
                priceStats: prices.length > 0 ? {
                    min: Math.min(...prices),
                    max: Math.max(...prices),
                    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
                } : null,
                rawData: data.data
            };

            fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
            console.log(`💾 Data saved to: ${filename}\n`);

            // Display all services
            console.log(`📝 ALL SERVICES (${data.data.length} items):\n`);
            data.data.forEach((service, idx) => {
                console.log(`${idx + 1}. ${service.name}`);
                console.log(`   Code: ${service.code}`);
                console.log(`   Category: ${service.game}`);
                console.log(`   Price: Rp ${service.price?.basic?.toLocaleString('id-ID')} (Basic) | Rp ${service.price?.premium?.toLocaleString('id-ID')} (Premium)`);
                console.log(`   Status: ${service.status}`);
                if (idx < data.data.length - 1) console.log('');
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
const CATEGORY_NAME = process.argv[2] || 'Mobile Legends A';
const STATUS = process.argv[3] || 'available';

fetchGameServicesByCategory(CATEGORY_NAME, STATUS)
    .then(() => {
        console.log('\n✅ Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    });
