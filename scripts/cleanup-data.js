import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function cleanup() {
    console.log('🗑️  Cleaning up old data...\n');

    try {
        // Step 1: Delete all GameServices
        const deletedServices = await prisma.gameService.deleteMany();
        console.log(`✅ Deleted ${deletedServices.count} GameService records`);

        // Step 2: Delete all Brands
        const deletedBrands = await prisma.brand.deleteMany();
        console.log(`✅ Deleted ${deletedBrands.count} Brand records`);

        console.log('\n✅ Cleanup completed! Database is clean.');

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

cleanup()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
