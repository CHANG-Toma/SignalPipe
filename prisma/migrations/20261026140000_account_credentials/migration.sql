-- AlterTable
ALTER TABLE "BrokerAccount" ADD COLUMN "username" TEXT;
ALTER TABLE "BrokerAccount" ADD COLUMN "passwordEnc" TEXT;
ALTER TABLE "BrokerAccount" ADD COLUMN "cid" TEXT;
ALTER TABLE "BrokerAccount" ADD COLUMN "secEnc" TEXT;
ALTER TABLE "BrokerAccount" ADD COLUMN "appId" TEXT;
ALTER TABLE "BrokerAccount" ADD COLUMN "deviceId" TEXT;
