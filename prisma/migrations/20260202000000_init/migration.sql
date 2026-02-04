-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT DEFAULT 'id',
    "role" TEXT NOT NULL DEFAULT 'user',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "game" TEXT,
    "item" TEXT,
    "serviceCode" TEXT,
    "zoneId" TEXT,
    "gamePlayerId" TEXT,
    "amount" BIGINT,
    "price" BIGINT,
    "channel" TEXT,
    "lastMsgId" INTEGER,
    "nickname" TEXT,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "payment_channels" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 0,
    "maxAmount" INTEGER NOT NULL DEFAULT 0,
    "fee" TEXT,
    "feeFlat" INTEGER,
    "feePercent" TEXT,
    "isPercent" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "method" TEXT,
    "logo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Aktif',
    "guideTitle" TEXT,
    "guideSteps" TEXT,
    "lastSynced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_channels_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "transactions" (
    "merchantRef" TEXT NOT NULL,
    "trxId" TEXT,
    "userId" TEXT NOT NULL,
    "customerName" TEXT,
    "game" TEXT,
    "item" TEXT,
    "nickname" TEXT,
    "playerId" TEXT,
    "zoneId" TEXT,
    "gameCode" TEXT,
    "serviceCode" TEXT,
    "amount" BIGINT NOT NULL,
    "channel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentUrl" TEXT,
    "paymentNo" TEXT,
    "qrString" TEXT,
    "messageId" INTEGER,
    "paidAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("merchantRef")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'vipreseller',
    "categories" TEXT[],
    "validationCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_services" (
    "code" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "category" TEXT,
    "priceBasic" BIGINT NOT NULL DEFAULT 0,
    "pricePremium" BIGINT NOT NULL DEFAULT 0,
    "priceSpecial" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "server" TEXT,
    "lastSynced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_services_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "game_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameCode" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "zoneId" TEXT,
    "nickname" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastValidated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "users_chatId_key" ON "users"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_chatId_key" ON "user_sessions"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_trxId_key" ON "transactions"("trxId");

-- CreateIndex
CREATE UNIQUE INDEX "games_code_key" ON "games"("code");

-- CreateIndex
CREATE UNIQUE INDEX "game_accounts_userId_gameCode_playerId_key" ON "game_accounts"("userId", "gameCode", "playerId");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_services" ADD CONSTRAINT "game_services_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_accounts" ADD CONSTRAINT "game_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
