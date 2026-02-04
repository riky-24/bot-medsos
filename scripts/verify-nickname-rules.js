import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';

dotenv.config();

const API_KEY = process.env.VIPRESELLER_API_KEY;
const API_ID = process.env.VIPRESELLER_API_ID;
const BASE_URL = 'https://vip-reseller.co.id/api/game-feature';

if (!API_KEY || !API_ID) {
    console.error('❌ Error: VIPRESELLER_API_KEY or VIPRESELLER_API_ID is missing in .env');
    process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateSign = () => {
    return crypto.createHash('md5').update(String(API_ID).trim() + String(API_KEY).trim()).digest('hex');
};

const makeRequest = async (type, extraParams = {}) => {
    const sign = generateSign();
    const formData = new FormData();

    const payload = {
        key: API_KEY,
        sign,
        type,
        ...extraParams
    };

    Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, String(value));
    });

    if (API_ID) {
        formData.append('api_id', String(API_ID).trim());
    }

    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            body: formData
        });
        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch (e) {
            return { result: false, message: `Non-JSON: ${text.substring(0, 500)}` };
        }
    } catch (error) {
        return { result: false, message: `Fetch Error: ${error.message}` };
    }
};

const TEST_CASES = [
    { name: 'Mobile Legends', code: 'mobile-legends', id: '136216325', zone: '2685' },
    { name: 'Free Fire', code: 'free-fire', id: '1234567890' },
    { name: 'Free Fire (Alt)', code: 'freefire', id: '1234567890' },
    { name: 'Valorant', code: 'valorant', id: 'SampleUser', zone: 'ID1' },
    { name: 'Genshin Impact', code: 'genshin-impact', id: '812345678', zone: 'os_asia' },
    { name: 'Hago', code: 'hago', id: '1234567' }
];

async function runVerification() {
    console.log('🔍 VERIFIKASI ATURAN NICKNAME VIPRESELLER\n');

    // 1. Discovery Mode sampling
    console.log('--- [DISCOVERY: Categories from API] ---');
    const services = await makeRequest('services', { filter_status: 'available' });
    if (services.result && Array.isArray(services.data)) {
        const categories = [...new Set(services.data.map(s => s.game))].sort();
        console.log(`Ditemukan ${categories.length} Kategori Game di API.`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 2. Nickname Check
    console.log('--- [NICKNAME VALIDATION TEST] ---');
    for (const test of TEST_CASES) {
        process.stdout.write(`Testing ${test.name} (Code:${test.code}) [ID:${test.id}, Zone:${test.zone || '-'}]... `);

        await sleep(1500);

        const result = await makeRequest('nickname', {
            code: test.code,
            target: String(test.id),
            additional_target: test.zone || ''
        });

        if (result && result.result) {
            console.log(`✅ SUCCESS [Nickname: ${result.data}]`);
        } else {
            console.log(`❌ FAIL [Message: ${result.message || 'null'}]`);
            // Show snippet of data if it's there
            if (result.data && typeof result.data === 'object') {
                console.log(`   Internal Detail:`, JSON.stringify(result.data));
            }
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 TIPS: Jika Nickname bernilai null dan FAIL, kemungkinan ID salah atau format parameter kurang pas.');
}

runVerification();
