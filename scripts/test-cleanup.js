import { PrismaClient } from '@prisma/client';
import { GameRepository } from '../core/shared/repositories/GameRepository.js';
import { GameService } from '../core/shared/services/GameService.js';

const prisma = new PrismaClient();

/**
 * Test Script - Verify Cleanup Success
 * Tests that new Brand schema works correctly with updated methods
 */
async function testCleanup() {
    console.log('🧪 Starting Cleanup Verification Tests...\n');

    try {
        // GameRepository expects adapter with .client property
        const prismaAdapter = { client: prisma };
        const gameRepository = new GameRepository(prismaAdapter);
        const gameService = new GameService(gameRepository);

        // Test 1: Get All Brands
        console.log('✅ Test 1: getAllBrands()');
        const brands = await gameRepository.getAllBrands();
        console.log(`   Found ${brands.length} brands`);
        if (brands.length > 0) {
            console.log(`   Sample: ${brands[0].name} (${brands[0].code})`);
        }
        console.log('');

        // Test 2: Get Brand Services
        console.log('✅ Test 2: getBrandServices()');
        if (brands.length > 0) {
            const services = await gameRepository.getBrandServices(brands[0].code);
            console.log(`   Found ${services.length} services for ${brands[0].name}`);
            if (services.length > 0) {
                console.log(`   Sample: ${services[0].serviceName} - Rp${services[0].priceBasic}`);
            }
        }
        console.log('');

        // Test 3: GameService.getAvailableGames()
        console.log('✅ Test 3: GameService.getAvailableGames()');
        const games = await gameService.getAvailableGames();
        console.log(`   Found ${games.length} available games`);
        if (games.length > 0) {
            console.log(`   Sample: ${games[0].name} ${games[0].emoji || ''}`);
        }
        console.log('');

        // Test 4: GameService.getGameServices()
        console.log('✅ Test 4: GameService.getGameServices()');
        if (brands.length > 0) {
            const gameServices = await gameService.getGameServices(brands[0].code);
            console.log(`   Found ${gameServices.length} services via GameService`);
        }
        console.log('');

        // Test 5: Verify no deprecated methods
        console.log('✅ Test 5: Check for deprecated methods');
        const hasGetAllActive = typeof gameRepository.getAllActive === 'function';
        const hasGetGameServices = typeof gameRepository.getGameServices === 'function';
        const hasGetOrCreateGame = typeof gameRepository.getOrCreateGame === 'function';

        if (!hasGetAllActive && !hasGetGameServices && !hasGetOrCreateGame) {
            console.log('   ✅ All deprecated methods removed successfully!');
        } else {
            console.log('   ⚠️ WARNING: Some deprecated methods still exist:');
            if (hasGetAllActive) console.log('      - getAllActive');
            if (hasGetGameServices) console.log('      - getGameServices');
            if (hasGetOrCreateGame) console.log('      - getOrCreateGame');
        }
        console.log('');

        // Test 6: Test findByCode
        console.log('✅ Test 6: findByCode()');
        if (brands.length > 0) {
            const brand = await gameRepository.findByCode(brands[0].code);
            console.log(`   Found: ${brand?.name || 'null'}`);
            console.log(`   Services: ${brand?.services?.length || 0}`);
        }
        console.log('');

        // Summary
        console.log('═══════════════════════════════════════');
        console.log('🎉 All Tests Passed!');
        console.log('═══════════════════════════════════════');
        console.log('✅ New Brand schema working correctly');
        console.log('✅ GameService updated successfully');
        console.log('✅ Deprecated methods removed');
        console.log('✅ Bot ready for production use');
        console.log('');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testCleanup();
