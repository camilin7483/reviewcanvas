CREATE TABLE "MediaObject" (
    "ownerId" UUID NOT NULL,
    "digest" CHAR(64) NOT NULL,
    "mime" VARCHAR(32) NOT NULL,
    "bytes" INTEGER NOT NULL CHECK ("bytes" > 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("ownerId", "digest"),
    CONSTRAINT "MediaObject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
