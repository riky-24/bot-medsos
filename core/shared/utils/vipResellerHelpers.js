/**
 * Helper Functions for VIPReseller Sync
 * - extractCategory: Extract category code from API game field
 * - convertHtmlToPlainText: Convert HTML description to plain text
 * - getDescription: Get description with fallback for Mobile Legends B
 */

/**
 * Extract category code dari nama kategori lengkap
 * @param {string} gameField - Field "game" dari API (e.g., "Mobile Legends A")
 * @returns {string} Category code (e.g., "A")
 */
export function extractCategory(gameField) {
    // "Mobile Legends A" -> "A"
    // "Mobile Legends B" -> "B"
    // "Mobile Legends Gift" -> "Gift"

    if (!gameField || typeof gameField !== 'string') {
        return '';
    }

    const parts = gameField.trim().split(' ');
    return parts[parts.length - 1]; // Ambil kata terakhir
}

/**
 * Convert HTML description to plain text
 * @param {string} htmlString - HTML description dari API
 * @returns {string} Plain text description
 */
export function convertHtmlToPlainText(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') {
        return '';
    }

    // Remove HTML tags and convert to plain text
    let text = htmlString
        .replace(/<\/li>/gi, '\n')     // Line break after each list item
        .replace(/<li>/gi, '• ')        // Bullet point for list items  
        .replace(/<\/ul>/gi, '\n')     // Line break after list
        .replace(/<ul[^>]*>/gi, '')    // Remove ul tags
        .replace(/<[^>]+>/g, '')       // Remove all other HTML tags
        .replace(/\r\n/g, '\n')        // Normalize line breaks
        .replace(/\n{2,}/g, '\n')      // Remove multiple line breaks
        .replace(/&nbsp;/g, ' ')       // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();

    return text;
}

/**
 * Description cache untuk fallback
 * Menyimpan deskripsi dari Mobile Legends A untuk dipakai oleh B
 */
const descriptionCache = new Map();

/**
 * Get description dengan fallback mechanism
 * Mobile Legends B tidak punya deskripsi, pakai dari A
 * @param {object} service - Service object dari API
 * @param {string} category - Extracted category ("A", "B", "Gift")
 * @param {string} brandCode - Brand code (e.g., "mobile-legends")
 * @returns {string} Processed description
 */
export function getDescription(service, category, brandCode = 'mobile-legends') {
    const rawDescription = service.description;

    // Jika ada deskripsi, convert dan cache (untuk category A)
    if (rawDescription && rawDescription.trim()) {
        const plainText = convertHtmlToPlainText(rawDescription);

        // Cache untuk fallback (simpan deskripsi dari category A)
        if (category === 'A') {
            const cacheKey = `${brandCode}-A`;
            if (!descriptionCache.has(cacheKey)) {
                descriptionCache.set(cacheKey, plainText);
            }
        }

        return plainText;
    }

    // Fallback: Mobile Legends B pakai deskripsi dari A
    if (category === 'B') {
        const cacheKey = `${brandCode}-A`;
        const cachedDescription = descriptionCache.get(cacheKey);

        if (cachedDescription) {
            return cachedDescription;
        }
    }

    // Default: empty string
    return '';
}

/**
 * Clear description cache
 * Useful untuk testing atau re-sync
 */
export function clearDescriptionCache() {
    descriptionCache.clear();
}
