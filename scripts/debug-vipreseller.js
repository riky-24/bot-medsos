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

    console.log(`\n--- [DEBUG] Request: ${type} ---`);
    console.log(`URL: ${BASE_URL}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        const text = await response.text();
        console.log(`Response Status: ${response.status}`);

        try {
            const data = JSON.parse(text);
            console.log(`Response Data:`, JSON.stringify(data, null, 2));
            return data;
        } catch (e) {
            console.log(`Response (Non-JSON):`, text.substring(0, 500));
            return null;
        }
    } catch (error) {
        console.error(`❌ Request Failed:`, error.message);
        return null;
    }
};

const runDebug = async () => {
    console.log('🚀 Starting VIPReseller Debugger...');
    console.log(`API ID: ${API_ID}`);
    console.log(`API KEY: ${API_KEY.substring(0, 5)}...`);

    // 1. Test Get Services (Get a few to see raw structure)
    const servicesResp = await makeRequest('services', { filter_game: '', filter_status: 'available' });
    if (servicesResp && servicesResp.data && servicesResp.data.length > 0) {
        console.log('\n--- [SAMPEL RAW DATA SERVICE (ITEM 0)] ---');
        console.log('RAW KEYS:', Object.keys(servicesResp.data[0]));
        console.log(JSON.stringify(servicesResp.data[0], null, 2));

        if (servicesResp.data.length > 100) {
            console.log('\n--- [SAMPEL RAW DATA SERVICE (ITEM 100)] ---');
            console.log(JSON.stringify(servicesResp.data[100], null, 2));
        }
    }

    // 2. Test Get Nickname
    // Trying 'nickname' instead of 'get_nickname' because server seems to prepend 'get_'
    await makeRequest('nickname', {
        code: 'mobile-legends',
        target: '136216325',
        additional_target: '2685'
    });

    console.log('\n✅ Debug check complete.');
};

runDebug();
