import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
    console.log('🔍 Verifying Synced Data\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Check Brand
        const brands = await prisma.brand.findMany({
            include: {
                _count: {
                    select: { services: true }
                }
            }
        });

        console.log(`📊 Total Brands: ${brands.length}\n`);

        for (const brand of brands) {
            console.log(`🎮 Brand: ${brand.name}`);
            console.log(`   Code: ${brand.code}`);
            console.log(`   Provider: ${brand.provider}`);
            console.log(`   Categories: ${brand.categories.join(', ')}`);
            console.log(`   Total Services: ${brand._count.services}\n`);
        }

        // Check Services by Category
        if (brands.length > 0) {
            const mobileLegends = brands[0];

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('📂 Services by Category:\n');

            for (const category of ['A', 'B', 'Gift']) {
                const count = await prisma.gameService.count({
                    where: {
                        brandId: mobileLegends.id,
                        category: category
                    }
                });

                console.log(`   Category ${category}: ${count} services`);
            }

            // Sample services from each category
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('📝 Sample Services (3 dari setiap kategori):\n');

            for (const category of ['A', 'B', 'Gift']) {
                const samples = await prisma.gameService.findMany({
                    where: {
                        brandId: mobileLegends.id,
                        category: category
                    },
                    take: 3,
                    orderBy: { priceBasic: 'asc' }
                });

                console.log(`Category ${category}:`);
                samples.forEach((service, idx) => {
                    const price = Number(service.priceBasic);
                    console.log(`   ${idx + 1}. ${service.serviceName}`);
                    console.log(`      Code: ${service.code}`);
                    console.log(`      Price: Rp ${price.toLocaleString('id-ID')}`);
                    console.log(`      Description: ${service.description ? service.description.substring(0, 50) + '...' : 'N/A'}`);
                });
                console.log('');
            }

            // Check description fallback (Mobile Legends B)
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('🔍 Testing Description Fallback:\n');

            const serviceA = await prisma.gameService.findFirst({
                where: {
                    brandId: mobileLegends.id,
                    category: 'A'
                }
            });

            const serviceB = await prisma.gameService.findFirst({
                where: {
                    brandId: mobileLegends.id,
                    category: 'B'
                }
            });

            console.log('Category A (has description):');
            console.log(`   ${serviceA.serviceName}`);
            console.log(`   Description: ${serviceA.description}\n`);

            console.log('Category B (fallback from A):');
            console.log(`   ${serviceB.serviceName}`);
            console.log(`   Description: ${serviceB.description}\n`);

            if (serviceA.description === serviceB.description) {
                console.log('✅ Fallback working! Category B uses description from A\n');
            } else {
                console.log('⚠️  Descriptions are different (may be OK if B has its own)\n');
            }
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ Verification completed!\n');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

verifyData()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
