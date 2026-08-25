-- Brand family (apex domain) the user signed up under; null = primary brand.
ALTER TABLE "User" ADD COLUMN "brandDomain" TEXT;
