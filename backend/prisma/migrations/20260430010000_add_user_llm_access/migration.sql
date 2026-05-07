CREATE TABLE "UserLLMAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "llmConfigId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLLMAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserLLMAccess_userId_llmConfigId_key" ON "UserLLMAccess"("userId", "llmConfigId");
ALTER TABLE "UserLLMAccess" ADD CONSTRAINT "UserLLMAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLLMAccess" ADD CONSTRAINT "UserLLMAccess_llmConfigId_fkey" FOREIGN KEY ("llmConfigId") REFERENCES "LLMConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserLLMConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserLLMConfig_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UserLLMConfig" ADD CONSTRAINT "UserLLMConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
