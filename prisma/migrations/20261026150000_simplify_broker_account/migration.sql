-- Drop unused partner/API credential columns (Lucid login is username+password only)
ALTER TABLE "BrokerAccount" DROP COLUMN IF EXISTS "cid";
ALTER TABLE "BrokerAccount" DROP COLUMN IF EXISTS "secEnc";
ALTER TABLE "BrokerAccount" DROP COLUMN IF EXISTS "appId";
ALTER TABLE "BrokerAccount" DROP COLUMN IF EXISTS "deviceId";
ALTER TABLE "BrokerAccount" DROP COLUMN IF EXISTS "notes";
