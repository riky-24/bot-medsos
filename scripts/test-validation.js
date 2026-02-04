import { InputValidationService } from '../core/shared/services/InputValidationService.js';
import { Sanitizer } from '../core/shared/utils/Sanitizer.js';

async function test() {
    const service = new InputValidationService(Sanitizer);

    const testCases = [
        { input: 'clear', expected: 'command' },
        { input: 'restart', expected: 'command' },
        { input: 'batal', expected: 'command' },
        { input: 'halo', expected: 'ignore' },
        { input: 'p', expected: 'ignore' },
        { input: 'oke min', expected: 'ignore' },
        { input: 'siap bang', expected: 'ignore' },
        { input: '12345678', expected: 'data' },
        { input: '12345678 (1234)', expected: 'data' },
        { input: 'akunggantengsekali', expected: 'ignore' }, // > 10 chars alpha only
        { input: 'apa kabar admin?', expected: 'ignore' },
        { input: '123', expected: 'data' },
        { input: 'ab', expected: 'data' }, // Zero-Tolerance: classifies as data to be caught by guard
        { input: '/start', expected: 'command' },
        { input: '/cancel', expected: 'command' },
    ];

    console.log('🧪 Testing InputValidationService (Zero-Tolerance)...\n');

    let passed = 0;
    for (const tc of testCases) {
        const result = await service.getResult(tc.input);
        const isPass = result.type === tc.expected;
        console.log(`${isPass ? '✅' : '❌'} Input: "${tc.input}" -> Result: ${result.type}${result.reason ? ` (${result.reason})` : ''}`);
        if (isPass) passed++;
    }

    console.log('\n🧪 Testing Schema Validation...');
    const schemaTests = [
        { input: '12345678(1234)', game: 'mobile-legends', valid: true },
        { input: '123(12)', game: 'mobile-legends', valid: false }, // Too short
        { input: '1234567890', game: 'free-fire', valid: true },
        { input: '123', game: 'free-fire', valid: false },
        { input: 'User#1234', game: 'valorant', valid: true },
    ];

    for (const st of schemaTests) {
        const result = await service.getResult(st.input, st.game);
        const isValid = result.validation?.isValid;
        const isPass = isValid === st.valid;
        console.log(`${isPass ? '✅' : '❌'} Input: "${st.input}" [${st.game}] -> Valid: ${isValid}`);
        if (isPass) passed++;
    }

    const total = testCases.length + schemaTests.length;
    console.log(`\n📊 Summary: ${passed}/${total} tests passed.`);
}

test().catch(console.error);
