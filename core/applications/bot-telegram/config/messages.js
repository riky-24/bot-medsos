import { Sanitizer } from '../../../shared/utils/Sanitizer.js';

/**
 * User-facing message templates
 * Centralizes all bot responses for easy i18n in the future
 */

export const MESSAGES = {
  // Greetings & Help
  WELCOME: (name = 'Kak') =>
    `Halo *${name}*, mitra terpercaya untuk top-up game favorit Anda. Kami hadir dengan sistem otomatis 24 jam dan jaminan harga terbaik.\n\n` +
    `• Proses Cepat & Otomatis\n` +
    `• Berbagai Pilihan Pembayaran\n` +
    `• CS Support Siaga 24/7\n\n` +
    `Silakan tentukan pilihan Anda di bawah ini:`,

  HELP:
    ` PUSAT BANTUAN\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Halo Bosque, siap membantu kebutuhan top-up Bosque hari ini.\n\n` +
    `*Panduan Singkat:*\n` +
    `1. Pilih Game di menu Top Up\n` +
    `2. Masukkan ID Akun dengan benar\n` +
    `3. Selesaikan pembayaran otomatis\n` +
    `4. Produk masuk dalam hitungan detik!\n\n` +
    `Ada kendala? Klik tombol Admin di bawah ya Bosque.`,

  // Error Generic
  ERROR: (msg) =>
    `⚠️ PEMBERITAHUAN SISTEM\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${msg}\n\n` +
    `Silakan coba beberapa saat lagi atau hubungi Layanan Pelanggan jika kendala berlanjut.`,

  // Rate Limiting
  RATE_LIMIT:
    `☕ Santai Sejenak, Bosque...\n` +
    `Permintaan Bosque terlalu cepat. Tunggu beberapa detik ya agar sistem tetap stabil. ⏳`,

  RATE_LIMIT_TOAST: "Sabar ya Bosque, tunggu sebentar... ⏳",

  // Payment Flow
  PAYMENT_PROCESSING:
    `⏳ MENGHUBUNGI GATEWAY...\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Mohon tunggu sebentar, sedang menyiapkan detail pembayaran Bosque.`,

  PAYMENT_ERROR:
    `❌ METODE TIDAK TERSEDIA\n` +
    `Maaf Bosque, metode pembayaran ini sedang dalam pemeliharaan. Silakan gunakan metode lain ya. 🙏`,

  ORDER_CANCELLED:
    `✅ PESANAN DIBATALKAN\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Sesi pemesanan telah ditutup dengan aman. Terima kasih sudah mencoba layanan kami.\n\n` +
    `Jangan ragu untuk memesan kembali kapan saja Bosque! Kami siap melayani 24/7. 😊`,

  // Bot Profile (BotFather Style)
  BOT_DESCRIPTION:
    `B7Store adalah asisten virtual terbaik untuk kebutuhan top-up game Anda. Cepat, aman, dan otomatis 24 jam.\n\n` +
    `CARA MEMBELI:\n` +
    `Klik /start untuk membuka Menu Utama dan pilih game favorit Anda.\n\n` +
    `Gunakan bot ini untuk memesan Diamond, Skin, dan berbagai kebutuhan game lainnya dengan harga termurah di pasaran.\n\n` +
    `Tentang b7Store:\n` +
    `https://b7store.id\n` +
    `Info Channel:\n` +
    `https://t.me/b7store_info\n\n` +
    `Hubungi @Admin jika Anda memiliki pertanyaan atau kendala transaksi.`,

  BOT_ABOUT:
    `🚀 Solusi Top-Up Game Tercepat & Terpercaya.\n` +
    `💎 Harga Termurah & Layanan Otomatis 24 Jam.\n` +
    `👩‍💼 Admin Support: @Admin`,

  // Game Selection
  GAME_NOT_FOUND:
    `🔍 GAME TIDAK DITEMUKAN\n` +
    `Maaf Bosque, game yang Bosque cari belum tersedia di daftar kami saat ini. 😢`,

  GAME_INSTRUCTIONS: (gameName) =>
    `🎮 TOP UP ${gameName.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Silakan masukkan data akun Anda dengan format:\n\n` +
    `*User ID (Server ID)*\n` +
    `Contoh: \`12345678 (1234)\`\n\n` +
    `Anggun akan memandu Kakak sampai proses selesai! 😊`,

  // Menu Navigation
  TOPUP_MENU_TITLE: `🎮 *PILIH KATEGORI LAYANAN*\n━━━━━━━━━━━━━━━━━━━━\nSilakan pilih kategori produk yang ingin Kakak cari:`,

  TOPUP_VERIFIED_TITLE: ` GAME TERVERIFIKASI\n_(Mendukung Cek Nickname)_`,
  TOPUP_REGULAR_TITLE: ` DAFTAR GAME LAINNYA`,
  TOPUP_VOUCHER_TITLE: ` VOUCHER & DIGITAL WALLET`,

  VERIFIED_BADGE: `✅ Terverifikasi`,
  UNVERIFIED_WARNING: `⚠️ Penting: Game ini tidak mendukung cek nickname otomatis. Mohon teliti saat memasukkan ID ya Kak!`,

  PAYMENT_CHANNELS_LOADING:
    `Pembayaran di b7Store tersedia lewat:\n\n` +
    `• QRIS\n• E-Wallet\n• Virtual Account\n(List channel sedang loading...)`,

  PAYMENT_CHANNELS_ERROR:
    `Pembayaran di b7Store tersedia lewat:\n\n` +
    `• QRIS (Dana/OVO/GoPay)\n• Transfer Bank`,

  ADMIN_CONTACT:
    `Bosque bisa hubungi admin kami di: @admin_b7store (Jam kerja 09.00 - 21.00 WIB) 👨‍💻`,

  // Invoice Templates (Premium Style)
  ORDER_INVOICE: (game, userId, zoneId, item, price, nickname, isVerified = false) =>
    `🎮 DETAIL PESANAN ${isVerified ? '✅' : ''}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 Game: ${game}\n` +
    `💎 Produk: ${item}\n` +
    `🆔 User ID: \`${Sanitizer.escapeMarkdown(userId)}\`\n` +
    `${zoneId ? `🌐 Server: \`${Sanitizer.escapeMarkdown(zoneId)}\`\n` : ''}` +
    `${nickname ? `👤 Nickname: ${Sanitizer.escapeMarkdown(nickname)}\n` : ''}` +
    `💰 Harga: Rp ${price.toLocaleString('id-ID')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${!isVerified && !nickname ? MESSAGES.UNVERIFIED_WARNING + '\n\n' : ''}` +
    `Mohon pastikan Data Player sudah benar. Kesalahan input bukan tanggung jawab kami. Lanjut ke pembayaran? 👇`,

  PAYMENT_INVOICE: (item, amount, expiryDate, paymentUrl) =>
    `💸 TAGIHAN PEMBAYARAN\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 Item: ${item}\n` +
    `💵 Total: Rp ${amount.toLocaleString('id-ID')}\n` +
    `⏰ Berlaku s/d: ${new Date(expiryDate).toLocaleString('id-ID')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Silakan Scan QRIS di atas atau bayar via link berikut:\n` +
    `🔗 [Klik Disini Untuk Bayar](${paymentUrl})\n\n` +
    `_Konfirmasi otomatis setelah dana kami terima._`,

  PAYMENT_INVOICE_FALLBACK: (paymentUrl, qrString) =>
    `💳 METODE PEMBAYARAN\n\n` +
    `🔗 Link Bayar: [Buka Link](${paymentUrl})\n` +
    `📖 Raw Data: \`${qrString.substring(0, 20)}...\``,

  // Payment Channel Info
  PAYMENT_CHANNELS_HEADER:
    `Pembayaran di b7Store tersedia lewat:\n\n`,

  PAYMENT_CHANNELS_FOOTER:
    `\n\nSilakan pilih saat checkout ya Kak! 😊`,

  PAYMENT_CHANNEL_ITEM: (index, name, status, minimal) =>
    `${index}. *${name}* (${status})\n   Minimal: Rp ${parseInt(minimal).toLocaleString('id-ID')}\n`,

  // Payment Fee Breakdown
  PAYMENT_FEE_BREAKDOWN: (item, basePrice, channelName, feeType, feeAmount, totalAmount, nickname, isVerified = false) =>
    `📊 RINCIAN PEMBAYARAN ${isVerified ? '✅' : ''}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 Produk: ${item}\n` +
    `${nickname ? `👤 Nickname: ${Sanitizer.escapeMarkdown(nickname)}\n` : ''}` +
    `💵 Harga: Rp ${basePrice.toLocaleString('id-ID')}\n` +
    `🏦 Metode: ${channelName}\n` +
    `➕ Biaya Admin: Rp ${feeAmount.toLocaleString('id-ID')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ TOTAL BAYAR: Rp ${totalAmount.toLocaleString('id-ID')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${!isVerified && !nickname ? MESSAGES.UNVERIFIED_WARNING + '\n\n' : ''}` +
    `_Klik tombol di bawah untuk membuat invoice resmi._`,

  // Payment Selection
  PAYMENT_METHOD_SELECTION:
    `💳 PILIH METODE BAYAR\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Tersedia berbagai pilihan metode pembayaran otomatis untuk kenyamanan Kakak:`,

  // Error Actions
  ERR_TRX_NOT_FOUND:
    `❌ DATA TIDAK DITEMUKAN\n` +
    `Maaf Kak, transaksi tersebut tidak ada dalam sistem kami.`,

  ERR_HISTORY_NOT_FOUND: "📭 BELUM ADA TRANSAKSI\n\nWah, sepertinya Kakak belum pernah belanja di sini. Yuk, mulai top-up game favoritmu sekarang! 😊",
  ERR_HISTORY_UNAVAILABLE: "⚠️ Layanan riwayat transaksi sedang dalam perbaikan. Silakan hubungi Admin jika mendesak.",

  ERR_ACTION_UNKNOWN:
    `⚠️ AKSI TIDAK VALID`,

  ERR_REPRINT_FAILED:
    `❌ GAGAL CETAK ULANG`,

  ERR_CHECK_FAILED:
    `❌ GAGAL CEK STATUS`,

  ERR_PAYMENT_FAILED:
    `❌ GAGAL PROSES BAYAR`,
  ERR_OUT_OF_STOCK: "⚠️ Maaf Kak, stok produk ini sedang kosong. Pilih produk lain ya! 🙏",

  ERR_CHANNEL_LOAD_FAILED:
    `⚠️ GANGGUAN KONEKSI\n` +
    `Gagal memuat daftar pembayaran.`,

  ERR_SESSION_EXPIRED:
    `⏰ SESI BERAKHIR\n` +
    `Sesi Kakak sudah kadaluarsa untuk alasan keamanan. Silakan order ulang ya.`,

  ERR_NO_ACTIVE_ORDER: "⚠️ Tidak ada pesanan aktif. Silakan pilih game terlebih dahulu.",

  // Status mapping
  STATUS_WAITING: `⏳ Menunggu Pembayaran`,
  STATUS_SUCCESS: `✅ Berhasil / Lunas`,
  STATUS_FAILED: `❌ Gagal / Dibatalkan`,
  STATUS_EXPIRED: `⏰ Kadaluarsa`,

  // Unified Contact Info
  CONTACT_INFO:
    `📞 PUSAT BANTUAN\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Ada kendala atau ingin kerja sama? Hubungi kami di:\n\n` +
    `👤 WhatsApp: [081234567890](https://wa.me/6281234567890)\n` +
    `📧 Telegram: @Ricky\n\n` +
    `Jam Kerja: 09:00 - 21:00 WIB`,

  // Miscellaneous
  LOADING_STATUS: `🔄 Mengecek status transaksi...`,
  ADMIN_PANEL: `🔐 ADMIN PANEL\n\nSilakan pilih fitur admin di bawah:`,
  GREETINGS_LIST: ['halo', 'hai', 'hi', 'hello', 'hey', 'pagi', 'siang', 'malam', 'sore'],

  // Game Selection Flow
  GAME_TOPUP_TITLE: (gameName) => `🎮 *TOP UP ${gameName.toUpperCase()}*`,
  GAME_CATEGORY: (category) => `📂 Kategori: ${category}`,
  GAME_TOTAL_ITEMS: (count) => `📦 Total Produk: ${count} Item`,
  GAME_PAGE_INFO: (page, total) => `📄 Halaman: ${page} / ${total}`,
  GAME_SELECT_NOMINAL: `👇 *Pilih Nominal Top Up:*`,

  GAME_SELECTED: (gameName, serviceName, price, description = null, isVerified = false, category = 'Game') =>
    `✨ PRODUK DIPILIH ✨\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 ${category}: ${gameName} ${isVerified ? '✅' : ''}\n` +
    `📦 Produk: ${serviceName}\n` +
    `💰 Harga: Rp ${price.toLocaleString('id-ID')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${isVerified ? MESSAGES.VERIFIED_BADGE + '\n' : ''}` +
    `${!isVerified && category === 'Game' ? MESSAGES.UNVERIFIED_WARNING + '\n' : ''}` +
    `${description ? `📋 PETUNJUK:\n_${description}_\n\n` : ''}` +
    `📝 LANGKAH TERAKHIR:\n` +
    `Silakan ketik User ID (dan Zone ID jika ada) Anda sekarang.\n\n` +
    `💡 Contoh: ${isVerified ? '812345678 (1234)' : '12345678'}`,

  CONFIRM_PLAYER_ID: (userId, zoneId, nickname) =>
    `👤 KONFIRMASI ID PLAYER\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `ID Player: ${Sanitizer.escapeMarkdown(userId)}\n` +
    `${zoneId ? `Server ID: ${Sanitizer.escapeMarkdown(zoneId)}\n` : ''}` +
    `${nickname ? `Nama Akun: ${Sanitizer.escapeMarkdown(nickname)}\n` : ''}` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Apakah data di atas sudah benar?`,

  GAME_SELECTED_SHORT: (serviceName) => `✅ Memilih: ${serviceName}`,

  // Dynamic Errors
  ERR_PRODUCT_NOT_FOUND: (code) => `❌ Terjadi kesalahan: Produk tidak ditemukan (${code})`,
  ERR_ID_NOT_FOUND: (userId, zoneId) =>
    `🔍 ID TIDAK DITEMUKAN\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Maaf Kak, ID ${Sanitizer.escapeMarkdown(userId)} ${zoneId ? `(${Sanitizer.escapeMarkdown(zoneId)})` : ''} tidak terdeteksi di sistem game.\n\n` +
    `📌 Saran Anggun:\n` +
    `• Cek kembali apakah ID & Server sudah benar.\n` +
    `• Pastikan tidak ada spasi tambahan.\n\n` +
    `Silakan ketik ulang ID yang benar ya Kak! 😊`,
  ERR_GAME_LIST_FAILED: (err) => `❌ Gagal memuat daftar produk: ${err}`,
  ERR_CHANNEL_NOT_FOUND: `⚠️ Channel tidak ditemukan`,
  ERR_GUIDE_FAILED: `❌ Gagal menampilkan panduan`,
  ERR_NO_SESSION_REDIRECT: `⚠️ PILIH GAME DULU YA KAK\n\nWah, sepertinya Kakak langsung memasukkan ID tanpa memilih game. Silakan tentukan game yang ingin di-topup dulu ya! 😊`,
  ERR_NICKNAME_LIMIT: `⌛ SABAR YA KAK...\n\nKakak terlalu cepat mencoba cek ID. Tunggu sekitar 1 menit lagi ya agar sistem tetap lancar. 🙏`,
  ERR_SYSTEM_MAINTENANCE: `⚠️ **GANGGUAN SYSTEM**\n\nMaaf Kak, fitur cek ID sedang gangguan di sistem provider. Silakan coba lagi nanti atau pastikan ID sudah benar.`,

  // Unrecognized Input Fallback
  UNKNOWN_INPUT: `Maaf Kak, Anggun tidak mengerti pesan tersebut. Silakan pilih menu di bawah ya: 😊`,

  // Channel Handling
  CHANNEL_EMPTY: `⚠️ Belum ada metode tersedia`,
  CHANNEL_LOAD_ERROR_BUTTON: `❌ Gagal memuat metode`,
  CHANNEL_METHOD_LABEL: (fee) => `(${fee})`,
  METHOD_OTHER: "Lainnya",

  // Guide UI
  GUIDE_TITLE: (name) => `💳 ${name}\n\n`,
  GUIDE_FEE_LABEL: (fee) => `💰 Biaya Admin: ${fee}\n`,
  GUIDE_MIN_LABEL: (min) => `📉 Minimal: Rp ${min.toLocaleString('id-ID')}\n`,
  GUIDE_TOTAL_LABEL: (amount) => `\n🛒 Total Tagihan Anda: Rp ${amount.toLocaleString('id-ID')}\n`,
  GUIDE_DIVIDER: `\n━━━━━━━━━━━━━━━━━━━━\n`,
  GUIDE_STEPS_LABEL: `📝 Cara Pembayaran:\n`,
  GUIDE_DEFAULT_STEP: "Ikuti petunjuk di layar pembayaran setelah checkout.",

  // History UI
  HISTORY_TITLE: `📜 RIWAYAT TRANSAKSI\n━━━━━━━━━━━━━━━━━━━━\n\n`,
  HISTORY_FOOTER: `━━━━━━━━━━━━━━━━━━━━\n_Klik 'Refresh' untuk status terbaru atau 'Bayar' untuk melanjutkan order._`,
  HISTORY_REFRESH_SUCCESS: `✅ Berhasil diperbarui! Data terbaru sudah muncul. 📜✨`,
  HISTORY_SAME_CONTENT: `✨ Data transaksi Kakak sudah paling update kok! 👌`,
  HISTORY_EMPTY_TOAST: `📭 Belum ada data transaksi untuk saat ini.`,

  // Payment UI (Non-QR)
  PAYMENT_DETAILS_HEADER: `💸 DETAIL PEMBAYARAN\n━━━━━━━━━━━━━━━━━━━━\n`,
  PAYMENT_DETAILS_GAME: (game) => `🎮 Game: ${game}\n`,
  PAYMENT_DETAILS_ITEM: (item) => `📦 Produk: ${item}\n`,
  PAYMENT_DETAILS_PLAYER: (userId, zoneId, nickname) =>
    `🆔 User ID: \`${userId}\` ${zoneId ? `(${zoneId})` : ''}\n` +
    `${nickname ? `👤 Nickname: ${nickname}\n` : ''}`,
  PAYMENT_DETAILS_METHOD: (name) => `🏦 Metode: ${name}\n`,
  PAYMENT_DETAILS_AMOUNT: (amount) => `💰 Total: Rp ${parseInt(amount).toLocaleString('id-ID')}\n`,
  PAYMENT_DETAILS_FOOTER: (status, created, expiry, ref) =>
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⏳ Status: ${status}\n` +
    `🗓️ Dibuat: ${created}\n` +
    `⏰ Limit: ${expiry}\n` +
    `🆔 Ref: \`${ref}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`,

  PAYMENT_CODE_LABEL: `🔢 NOMOR BAYAR / VA:\n`,
  PAYMENT_LINK_LABEL: `🔗 LINK PEMBAYARAN:\n`,
  PAYMENT_CODE_HINT: (code) => `\`${code}\` (Tap untuk salin)\n\n`,
  PAYMENT_LINK_HINT: (url) => `[Klik di sini untuk Bayar](${url})\n\n`,

  // Transaction Status
  STATUS_TITLE: `🧾 STATUS TRANSAKSI\n━━━━━━━━━━━━━━━━━━━━\n`,
  STATUS_UPDATE_TIME: (time) => `🕒 _Update: ${time}_\n\n`,
  STATUS_REF_LABEL: (ref) => `🆔 Ref: \`${ref}\`\n`,
  STATUS_LABEL: (status) => `📢 Status: ${status}\n\n`,
  STATUS_PAID_DESC: `✅ Pembayaran telah diterima. Order akan segera diproses sistem b7Store.`,
  STATUS_UNPAID_DESC: `⏳ Silakan segera selesaikan pembayaran Kakak sebelum masa berlaku habis.`,

  // Buttons
  BUTTON_BACK_TO_MENU: '🔙 Kembali ke Menu',
  BUTTON_PREV: '⬅️ Prev',
  BUTTON_NEXT: 'Next ➡️',
  BUTTON_REFRESH: '🔄 Refresh',
  BUTTON_CLOSE: '🗑️ Tutup',
  BUTTON_PAY_NOW: (id) => `💸 Bayar No. ${id}`,
  BUTTON_CONFIRM_YES: '✅ Benar, Lanjut',
  BUTTON_CONFIRM_NO: '❌ Batal',
  BUTTON_CHECK_STATUS: '🔄 Cek Status Transaksi',
  BUTTON_HOW_TO_PAY: '❓ Cara Bayar',
  BUTTON_BACK_HISTORY: '🔙 Kembali ke Riwayat',
  BUTTON_BACK_LIST: '🔙 Kembali ke Daftar',
  BUTTON_BACK_MAIN: '🔙 Kembali ke Menu Utama',
  BUTTON_PAY_WITH: (name) => `💳 Bayar dengan ${name}`,
  BUTTON_ADMIN_STATS: '📊 Statistik',
  BUTTON_ADMIN_USERS: '👥 User List',
  BUTTON_BACK: '⬅️ Kembali',
};
