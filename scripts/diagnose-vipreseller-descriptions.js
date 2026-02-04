import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';

dotenv.config();

const API_KEY = process.env.VIPRESELLER_API_KEY;
const API_ID = process.env.VIPRESELLER_API_ID;
const BASE_URL = 'https://vip-reseller.co.id/api/game-feature';

const generateSign = () => {
    return crypto.createHash('md5').update(String(API_ID).trim() + String(API_KEY).trim()).digest('hex');
};

const fetchAllServices = async () => {
    const formData = new FormData();
    formData.append('key', API_KEY);
    formData.append('sign', generateSign());
    formData.append('type', 'services');
    formData.append('api_id', API_ID);

    try {
        const response = await fetch(BASE_URL, { method: 'POST', body: formData });
        const data = await response.json();
        return data.result ? data.data : [];
    } catch (e) {
        console.error('Error fetching services:', e.message);
        return [];
    }
};

async function diagnose() {
    console.log('📡 Fetching raw data from VIPReseller...');
    const services = await fetchAllServices();

    if (services.length === 0) {
        console.log('❌ No services found.');
        return;
    }

    const total = services.length;
    let emptyCount = 0;
    let shortCount = 0; // < 10 chars
    let htmlCount = 0;
    let sampleEmpty = [];
    let sampleWithDesc = [];

    const gamesSummary = {};

    services.forEach(s => {
        const desc = s.description || '';
        const game = s.game || 'Unknown';

        if (!gamesSummary[game]) {
            gamesSummary[game] = { total: 0, hasDesc: 0 };
        }
        gamesSummary[game].total++;

        if (!desc.trim()) {
            emptyCount++;
            if (sampleEmpty.length < 5) sampleEmpty.push(game);
        } else {
            gamesSummary[game].hasDesc++;
            if (desc.length < 10) shortCount++;
            if (desc.includes('<')) htmlCount++;
            if (sampleWithDesc.length < 3) sampleWithDesc.push({ game, desc: desc.substring(0, 50) });
        }
    });

    console.log('\n--- STATISTICS ---');
    console.log(`Total Services: ${total}`);
    console.log(`Empty Descriptions: ${emptyCount} (${((emptyCount / total) * 100).toFixed(1)}%)`);
    console.log(`Descriptions < 10 chars: ${shortCount}`);
    console.log(`Containing HTML: ${htmlCount}`);

    console.log('\n--- SAMPLES ---');
    console.log('Games with EMPTY descriptions (sample):', [...new Set(sampleEmpty)].join(', '));
    console.log('Sample valid descriptions:');
    sampleWithDesc.forEach(s => console.log(` - [${s.game}]: ${s.desc}...`));

    console.log('\n--- TOP 20 GAMES ANALYSIS ---');
    const sortedGames = Object.entries(gamesSummary)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);

    console.log('Game | Total | Has Desc | %');
    sortedGames.forEach(([name, stat]) => {
        const pct = ((stat.hasDesc / stat.total) * 100).toFixed(0);
        console.log(`${name.padEnd(25)} | ${String(stat.total).padEnd(5)} | ${String(stat.hasDesc).padEnd(8)} | ${pct}%`);
    });
}

diagnose();
