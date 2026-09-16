-- CreateTable
CREATE TABLE "TaskViewer" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskViewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTeamViewer" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTeamViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskViewer_userId_idx" ON "TaskViewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskViewer_taskId_userId_key" ON "TaskViewer"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskTeamViewer_teamId_idx" ON "TaskTeamViewer"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTeamViewer_taskId_teamId_key" ON "TaskTeamViewer"("taskId", "teamId");

-- AddForeignKey
ALTER TABLE "TaskViewer" ADD CONSTRAINT "TaskViewer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskViewer" ADD CONSTRAINT "TaskViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTeamViewer" ADD CONSTRAINT "TaskTeamViewer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTeamViewer" ADD CONSTRAINT "TaskTeamViewer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
