import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Migration Script: Game → Brand
 * 
 * Langkah:
 * 1. Baca semua data dari tabel Game
 * 2. Insert ke tabel Brand (rename model)
 * 3. Update semua GameService.gameId → brandId
 * 
 * PENTING: Run ini setelah prisma migrate dev!
 */

async function migrateGameToBrand() {
    console.log('🔄 Starting migration: Game → Brand\n');

    try {
        // Step 1: Baca data Game yang existing (jika ada)
        console.log('📖 Reading existing Game data...');

        // Cek apakah tabel Game masih ada
        let games = [];
        try {
            games = await prisma.$queryRaw`SELECT * FROM "Game"`;
            console.log(`   Found ${games.length} games in old table\n`);
        } catch (error) {
            console.log('   ℹ️  Old Game table not found (this is OK if fresh install)\n');
        }

        // Step 2: Migrate data ke Brand (jika ada data lama)
        if (games.length > 0) {
            console.log('📝 Migrating Game data to Brand...');

            for (const game of games) {
                // Map old Game ke new Brand
                const brandData = {
                    id: game.id,
                    code: game.code,
                    name: game.name,
                    provider: game.provider || 'vipreseller',
                    categories: [], // Will be populated during sync
                    createdAt: game.createdAt,
                    updatedAt: game.updatedAt
                };

                // Insert ke Brand (skip jika sudah ada)
                try {
                    await prisma.brand.create({ data: brandData });
                    console.log(`   ✅ Migrated: ${game.name} (${game.code})`);
                } catch (err) {
                    if (err.code === 'P2002') {
                        console.log(`   ⚠️  Skipped: ${game.name} (already exists)`);
                    } else {
                        throw err;
                    }
                }
            }

            console.log('\n✅ Migration completed successfully!');
        } else {
            console.log('ℹ️  No old data to migrate (fresh install)');
        }

        // Step 3: Verify Brand data
        const brands = await prisma.brand.findMany();
        console.log(`\n📊 Total Brands in database: ${brands.length}`);

        if (brands.length > 0) {
            console.log('\nBrands:');
            brands.forEach(brand => {
                console.log(`   - ${brand.name} (${brand.code})`);
            });
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
migrateGameToBrand()
    .then(() => {
        console.log('\n✅ Migration script completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration script failed:', error);
        process.exit(1);
    });
