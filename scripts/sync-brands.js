import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { extractCategory, convertHtmlToPlainText, getDescription } from '../core/shared/utils/vipResellerHelpers.js';

dotenv.config();

const prisma = new PrismaClient();

const API_KEY = process.env.VIPRESELLER_API_KEY;
const API_ID = process.env.VIPRESELLER_API_ID;
const BASE_URL = 'https://vip-reseller.co.id/api/game-feature';

function generateSign() {
    const id = String(API_ID || '').trim();
    const key = String(API_KEY || '').trim();
    return crypto.createHash('md5').update(id + key).digest('hex');
}

async function fetchServices(categoryName, status = 'available') {
    const formData = new FormData();
    formData.append('key', API_KEY);
    formData.append('sign', generateSign());
    formData.append('type', 'services');
    formData.append('filter_game', categoryName);
    formData.append('filter_status', status);

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
        return data.data;
    }

    return [];
}

async function syncBrand(brandCode, brandName, categories) {
    console.log(`\n🎮 Syncing Brand: ${brandName}`);
    console.log(`   Categories: ${categories.join(', ')}\n`);

    // Step 1: Ensure Brand exists
    let brand = await prisma.brand.findUnique({
        where: { code: brandCode }
    });

    if (!brand) {
        brand = await prisma.brand.create({
            data: {
                code: brandCode,
                name: brandName,
                provider: 'vipreseller',
                categories: categories
            }
        });
        console.log(`   ✅ Brand created: ${brandName} (${brandCode})\n`);
    } else {
        // Update categories
        await prisma.brand.update({
            where: { id: brand.id },
            data: { categories: categories }
        });
        console.log(`   ℹ️  Brand exists, updated categories\n`);
    }

    // Step 2: Sync all categories
    let totalSynced = 0;

    for (const categoryName of categories) {
        console.log(`   📂 Syncing category: ${categoryName}...`);

        try {
            const services = await fetchServices(categoryName, 'available');

            if (services.length === 0) {
                console.log(`      ⚠️  No available services found`);
                continue;
            }

            console.log(`      Found ${services.length} services`);

            // Sync each service
            for (const service of services) {
                const category = extractCategory(service.game);
                const description = getDescription(service, category, brandCode);

                await prisma.gameService.upsert({
                    where: { code: service.code },
                    create: {
                        brandId: brand.id,
                        code: service.code,
                        serviceName: service.name,
                        category: category,
                        priceBasic: BigInt(service.price?.basic || 0),
                        pricePremium: BigInt(service.price?.premium || 0),
                        priceSpecial: BigInt(service.price?.special || 0),
                        description: description,
                        server: service.server || null,
                        lastSynced: new Date()
                    },
                    update: {
                        serviceName: service.name,
                        priceBasic: BigInt(service.price?.basic || 0),
                        pricePremium: BigInt(service.price?.premium || 0),
                        priceSpecial: BigInt(service.price?.special || 0),
                        description: description,
                        server: service.server || null,
                        lastSynced: new Date()
                    }
                });
            }

            totalSynced += services.length;
            console.log(`      ✅ Synced ${services.length} services`);

            // Delay to avoid rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`      ❌ Error syncing ${categoryName}:`, error.message);
        }
    }

    console.log(`\n   ✅ Total services synced for ${brandName}: ${totalSynced}\n`);

    return totalSynced;
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 VIPReseller Brand Sync Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!API_KEY || !API_ID) {
        console.error('❌ Error: VIPRESELLER_API_KEY or VIPRESELLER_API_ID is missing in .env');
        process.exit(1);
    }

    try {
        // Define brands to sync
        const brands = [
            {
                code: 'mobile-legends',
                name: 'Mobile Legends',
                categories: ['Mobile Legends A', 'Mobile Legends B', 'Mobile Legends Gift']
            }
            // Add more brands here as needed
        ];

        let grandTotal = 0;

        for (const brandConfig of brands) {
            const synced = await syncBrand(
                brandConfig.code,
                brandConfig.name,
                brandConfig.categories
            );
            grandTotal += synced;
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Sync completed!`);
        console.log(`   Total services synced: ${grandTotal}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('\n❌ Sync failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
