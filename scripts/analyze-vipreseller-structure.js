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

async function fetchAllCategories() {
    if (!API_KEY || !API_ID) {
        console.error('❌ Error: VIPRESELLER_API_KEY or VIPRESELLER_API_ID is missing in .env');
        process.exit(1);
    }

    const categories = [
        'Mobile Legends A',
        'Mobile Legends B',
        'Mobile Legends C',
        'Mobile Legends D',
        'Mobile Legends E'
    ];

    console.log('🔍 ANALISIS STRUKTUR VIPRESELLER API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Mencoba fetch semua kategori Mobile Legends...\n');

    const results = {};
    for (const category of categories) {
        console.log(`⏳ Fetching: ${category}...`);

        try {
            const formData = new FormData();
            formData.append('key', API_KEY);
            formData.append('sign', generateSign());
            formData.append('type', 'services');
            formData.append('filter_game', category);
            formData.append('filter_status', 'available');

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
                results[category] = {
                    found: true,
                    count: data.data.length,
                    sample: data.data.slice(0, 3).map(s => ({
                        code: s.code,
                        name: s.name,
                        category: s.game,
                        price: s.price?.basic
                    }))
                };
                console.log(`   ✅ Found ${data.data.length} services\n`);
            } else {
                results[category] = { found: false, message: data.message };
                console.log(`   ❌ Not found: ${data.message}\n`);
            }

            // Delay to avoid rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            results[category] = { found: false, error: error.message };
            console.log(`   ❌ Error: ${error.message}\n`);
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RINGKASAN HASIL\n');

    const foundCategories = Object.keys(results).filter(k => results[k].found);
    const notFoundCategories = Object.keys(results).filter(k => !results[k].found);

    console.log(`✅ Kategori Ditemukan: ${foundCategories.length}`);
    foundCategories.forEach(cat => {
        console.log(`   - ${cat}: ${results[cat].count} services`);
    });

    console.log(`\n❌ Kategori Tidak Ditemukan: ${notFoundCategories.length}`);
    notFoundCategories.forEach(cat => {
        console.log(`   - ${cat}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 KESIMPULAN STRUKTUR API:\n');

    if (foundCategories.length > 0) {
        console.log('✅ VIPReseller menggunakan KATEGORI, bukan BRAND');
        console.log('✅ Filter menggunakan nama kategori: "Mobile Legends A", "Mobile Legends B", dst.');
        console.log('✅ Field "game" di response = nama kategori');
        console.log('\n📋 Struktur yang benar:');
        console.log('   Brand: Mobile Legends');
        console.log('   └── Category: Mobile Legends A, B, C, D, E');
        console.log('       └── Services: Individual products');
    }

    // Save comprehensive analysis
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `vipreseller-analysis-all-categories-${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'scripts', filename);

    const output = {
        fetchedAt: new Date().toISOString(),
        analysis: 'VIPReseller API Structure Analysis',
        totalCategoriesTested: categories.length,
        categoriesFound: foundCategories.length,
        categoriesNotFound: notFoundCategories.length,
        conclusion: {
            usesCategories: foundCategories.length > 0,
            usesBrand: false,
            structure: 'Brand > Category > Service (3-layer)'
        },
        results: results
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Analisis lengkap disimpan ke: ${filename}`);

    return output;
}

fetchAllCategories()
    .then(() => {
        console.log('\n✅ Analisis selesai!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
