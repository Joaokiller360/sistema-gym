-- Wallet pass (WalletWallet) per member
ALTER TABLE "members" ADD COLUMN "walletToken" TEXT;
ALTER TABLE "members" ADD COLUMN "walletSerial" TEXT;
ALTER TABLE "members" ADD COLUMN "walletShareUrl" TEXT;
ALTER TABLE "members" ADD COLUMN "walletGoogleUrl" TEXT;
ALTER TABLE "members" ADD COLUMN "walletIssuedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "members_walletToken_key" ON "members"("walletToken");

-- Store sales can be attributed to a member (QR scan at reception)
ALTER TABLE "product_sales" ADD COLUMN "memberId" TEXT;
CREATE INDEX "product_sales_memberId_idx" ON "product_sales"("memberId");
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
