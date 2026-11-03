-- CreateTable
CREATE TABLE "races" (
    "id" UUID NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "raceId" UUID NOT NULL,
    "frameNumber" INTEGER NOT NULL,
    "horseNumber" INTEGER NOT NULL,
    "horseName" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "jockey" TEXT NOT NULL,
    "trainer" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "races_date_name_venue_key" ON "races"("date", "name", "venue");

-- CreateIndex
CREATE UNIQUE INDEX "entries_raceId_horseNumber_key" ON "entries"("raceId", "horseNumber");

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;
