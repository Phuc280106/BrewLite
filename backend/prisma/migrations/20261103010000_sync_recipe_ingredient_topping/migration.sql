-- AlterTable
ALTER TABLE "Product" DROP COLUMN IF EXISTS "stock",
DROP COLUMN IF EXISTS "version";

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Topping" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Topping_pkey" PRIMARY KEY ("id")
);
