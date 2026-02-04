/**
 * Menu keyboard configurations
 * Defines all inline keyboard layouts for the bot
 */

export const MENUS = {
  // Main menu
  MAIN: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎮 Top Up Game", callback_data: "menu_topup" },
          { text: "📜 Riwayat", callback_data: "menu_history" }
        ],
        [
          { text: "❓ Cara Bayar", callback_data: "menu_info_payment" },
          { text: "📞 Hubungi Admin", callback_data: "menu_contact" }
        ]
      ]
    }
  },

  // Payment info menu
  PAYMENT: {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Kembali", callback_data: "menu_main" }]
      ]
    }
  },

  // Order confirmation (Initial - Select Payment)
  ORDER_CONFIRMATION: {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Pilih Pembayaran", callback_data: "menu_payment" }],
        [{ text: "❌ Batal", callback_data: "action_cancel" }]
      ]
    }
  },

  // Order process (Final - Execute Payment)
  ORDER_PROCESS: {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Lanjut Pembayaran", callback_data: "action_process_payment" }],
        [{ text: "❌ Batal", callback_data: "action_cancel" }]
      ]
    }
  },

  // Back to home button
  BACK_TO_HOME: {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Kembali", callback_data: "menu_main" }]
      ]
    }
  },
};

/**
 * Generate dynamic top-up menu from game list with pagination
 * @param {Array} games - List of game objects with name and code
 * @param {Number} page - Current page (1-indexed)
 * @param {Number} pageSize - Items per page
 * @returns {Object} Telegram inline keyboard markup
 */
export function generateTopUpMenu(games, page = 1, pageSize = 10) {
  const keyboard = [];

  // Pagination logic
  const totalPages = Math.ceil(games.length / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages));

  const startIndex = (safePage - 1) * pageSize;
  const paginatedGames = games.slice(startIndex, startIndex + pageSize);

  let row = [];
  paginatedGames.forEach((game) => {
    row.push({ text: game.name, callback_data: `game_${game.code}` });
    if (row.length === 2) {
      keyboard.push(row);
      row = [];
    }
  });

  if (row.length > 0) keyboard.push(row); // Add remaining odd game

  // Navigation Row
  const navRow = [];
  if (safePage > 1) {
    navRow.push({ text: "⬅️ Prev", callback_data: `menu_topup_page_${safePage - 1}` });
  }
  if (safePage < totalPages) {
    navRow.push({ text: "Next ➡️", callback_data: `menu_topup_page_${safePage + 1}` });
  }

  if (navRow.length > 0) keyboard.push(navRow);

  // Bottom Controls
  keyboard.push([{ text: "🔙 Kembali", callback_data: "menu_main" }]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    },
    pageInfo: {
      current: safePage,
      total: totalPages,
      count: games.length
    }
  };
}
