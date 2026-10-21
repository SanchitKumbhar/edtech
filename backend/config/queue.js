const { Queue } = require("bullmq");
const { getBullMQConnection, isRedisConnected } = require("./redis");

let examProcessingQueue = null;

const getExamProcessingQueue = () => {
  if (examProcessingQueue) return examProcessingQueue;

  try {
    const connection = getBullMQConnection();
    examProcessingQueue = new Queue("exam-processing", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          count: 500,
        },
        removeOnFail: {
          count: 1000,
        },
      },
    });

    examProcessingQueue.on("error", (err) => {
      console.warn("[Queue:exam-processing] Error:", err.message);
    });

    console.log("📦 BullMQ 'exam-processing' queue initialized");
    return examProcessingQueue;
  } catch (err) {
    console.warn("BullMQ queue initialization failed (Redis may be offline):", err.message);
    return null;
  }
};

/**
 * Dispatch exam result post-processing job
 */
const enqueueExamResultProcessing = async (sessionId, examId, studentId) => {
  try {
    const queue = getExamProcessingQueue();
    if (!queue) {
      console.warn(`[Queue] Queue not available. Skipping async processing for session ${sessionId}`);
      return null;
    }

    const job = await queue.add(
      "process-exam-result",
      { sessionId, examId, studentId },
      {
        jobId: `exam-result-${sessionId}`,
      }
    );

    console.log(`[Queue] Enqueued process-exam-result for session ${sessionId} (job: ${job.id})`);
    return job;
  } catch (err) {
    console.warn(`[Queue] Failed to enqueue job for session ${sessionId}:`, err.message);
    return null;
  }
};

/**
 * Dispatch leaderboard snapshot generation job
 */
const enqueueLeaderboardSnapshot = async (boardType = "weekly", snapshotDate = new Date()) => {
  try {
    const queue = getExamProcessingQueue();
    if (!queue) return null;

    const job = await queue.add(
      "leaderboard-snapshot",
      { boardType, snapshotDate: new Date(snapshotDate).toISOString() },
      {
        jobId: `leaderboard-${boardType}-${Date.now()}`,
      }
    );

    return job;
  } catch (err) {
    console.warn("[Queue] Failed to enqueue leaderboard snapshot job:", err.message);
    return null;
  }
};

const closeQueues = async () => {
  if (examProcessingQueue) {
    console.log("Closing BullMQ queues...");
    await examProcessingQueue.close();
    examProcessingQueue = null;
  }
};

module.exports = {
  getExamProcessingQueue,
  enqueueExamResultProcessing,
  enqueueLeaderboardSnapshot,
  closeQueues,
};
