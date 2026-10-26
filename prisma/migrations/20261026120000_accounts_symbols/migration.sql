-- CreateTable
CREATE TABLE "BrokerAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountSpec" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'demo',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "quantityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymbolMapping" (
    "id" TEXT NOT NULL,
    "tradingViewSymbol" TEXT NOT NULL,
    "tradovateSymbol" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL DEFAULT 'MARKET',
    "defaultQty" INTEGER,
    "minTick" DOUBLE PRECISION,
    "lotSize" DOUBLE PRECISION,
    "overrideMapping" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymbolMapping_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderAttempt" ADD COLUMN "brokerAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BrokerAccount_accountId_key" ON "BrokerAccount"("accountId");

-- CreateIndex
CREATE INDEX "BrokerAccount_enabled_isPrimary_idx" ON "BrokerAccount"("enabled", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "SymbolMapping_tradingViewSymbol_key" ON "SymbolMapping"("tradingViewSymbol");
