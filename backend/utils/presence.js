const { getRedisClient, isRedisConnected } = require("../config/redis");

const PRESENCE_TTL_SECONDS = 45; // 45 seconds lease for active exam presence
const TAB_SWITCH_DEDUP_WINDOW_SECONDS = 2; // Deduplicate rapid tab switch triggers within 2s

// Fallback in-memory presence if Redis is offline
const memoryPresence = new Map();
const memoryDedup = new Map();

/**
 * Key formatters
 */
const presenceKey = (examId, studentId) => `focusflair:presence:${examId}:${studentId}`;
const examRosterKey = (examId) => `focusflair:presence:roster:${examId}`;
const dedupKey = (sessionId) => `focusflair:dedup:tabswitch:${sessionId}`;

/**
 * Register student presence when connecting to an exam
 */
const registerPresence = async (examId, studentId, socketId, metadata = {}) => {
  const pKey = presenceKey(examId, studentId);
  const rKey = examRosterKey(examId);

  if (!isRedisConnected()) {
    if (!memoryPresence.has(examId)) memoryPresence.set(examId, new Map());
    const examMap = memoryPresence.get(examId);
    const existing = examMap.get(studentId) || { socketIds: new Set(), metadata, lastSeen: Date.now() };
    existing.socketIds.add(socketId);
    existing.lastSeen = Date.now();
    examMap.set(studentId, existing);
    return true;
  }

  const client = getRedisClient();
  try {
    const existingRaw = await client.get(pKey);
    let socketIds = [socketId];

    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw);
        const set = new Set(parsed.socketIds || []);
        set.add(socketId);
        socketIds = Array.from(set);
      } catch {
        socketIds = [socketId];
      }
    }

    const payload = JSON.stringify({
      studentId,
      examId,
      socketIds,
      metadata,
      lastSeen: Date.now(),
    });

    await client.multi()
      .set(pKey, payload, "EX", PRESENCE_TTL_SECONDS)
      .sadd(rKey, studentId)
      .expire(rKey, PRESENCE_TTL_SECONDS * 2)
      .exec();

    return true;
  } catch (err) {
    console.warn("[Presence] Register error:", err.message);
    return false;
  }
};

/**
 * Heartbeat refresher
 */
const refreshPresence = async (examId, studentId) => {
  const pKey = presenceKey(examId, studentId);
  const rKey = examRosterKey(examId);

  if (!isRedisConnected()) {
    const examMap = memoryPresence.get(examId);
    if (examMap && examMap.has(studentId)) {
      examMap.get(studentId).lastSeen = Date.now();
    }
    return true;
  }

  const client = getRedisClient();
  try {
    await client.multi()
      .expire(pKey, PRESENCE_TTL_SECONDS)
      .expire(rKey, PRESENCE_TTL_SECONDS * 2)
      .exec();
    return true;
  } catch (err) {
    console.warn("[Presence] Refresh error:", err.message);
    return false;
  }
};

/**
 * Remove socket from presence. If no sockets left for this student, removes presence.
 */
const removePresence = async (examId, studentId, socketId) => {
  const pKey = presenceKey(examId, studentId);
  const rKey = examRosterKey(examId);

  if (!isRedisConnected()) {
    const examMap = memoryPresence.get(examId);
    if (examMap && examMap.has(studentId)) {
      const entry = examMap.get(studentId);
      entry.socketIds.delete(socketId);
      if (entry.socketIds.size === 0) {
        examMap.delete(studentId);
      }
    }
    return true;
  }

  const client = getRedisClient();
  try {
    const existingRaw = await client.get(pKey);
    if (!existingRaw) return true;

    const parsed = JSON.parse(existingRaw);
    const updatedSockets = (parsed.socketIds || []).filter((id) => id !== socketId);

    if (updatedSockets.length === 0) {
      await client.multi()
        .del(pKey)
        .srem(rKey, studentId)
        .exec();
    } else {
      parsed.socketIds = updatedSockets;
      await client.set(pKey, JSON.stringify(parsed), "EX", PRESENCE_TTL_SECONDS);
    }

    return true;
  } catch (err) {
    console.warn("[Presence] Remove error:", err.message);
    return false;
  }
};

/**
 * Get all online examinees for a given exam
 */
const getExamPresence = async (examId) => {
  if (!isRedisConnected()) {
    const examMap = memoryPresence.get(examId);
    if (!examMap) return [];
    return Array.from(examMap.entries()).map(([studentId, data]) => ({
      studentId,
      online: true,
      socketCount: data.socketIds.size,
      lastSeen: data.lastSeen,
      metadata: data.metadata,
    }));
  }

  const client = getRedisClient();
  try {
    const rKey = examRosterKey(examId);
    const studentIds = await client.smembers(rKey);
    if (!studentIds || studentIds.length === 0) return [];

    const keys = studentIds.map((sId) => presenceKey(examId, sId));
    const records = await client.mget(keys);

    const activeList = [];
    const staleIds = [];

    studentIds.forEach((sId, index) => {
      const record = records[index];
      if (record) {
        try {
          const parsed = JSON.parse(record);
          activeList.push({
            studentId: sId,
            online: true,
            socketCount: (parsed.socketIds || []).length,
            lastSeen: parsed.lastSeen,
            metadata: parsed.metadata,
          });
        } catch {
          staleIds.push(sId);
        }
      } else {
        staleIds.push(sId);
      }
    });

    // Cleanup stale IDs from set in background
    if (staleIds.length > 0) {
      client.srem(rKey, ...staleIds).catch(() => {});
    }

    return activeList;
  } catch (err) {
    console.warn("[Presence] GetExamPresence error:", err.message);
    return [];
  }
};

/**
 * Check if a tab-switch event is a duplicate within a sliding window.
 * Returns true if duplicate (should be ignored), false if fresh (should be recorded).
 */
const isTabSwitchDuplicate = async (sessionId, windowSeconds = TAB_SWITCH_DEDUP_WINDOW_SECONDS) => {
  const key = dedupKey(sessionId);

  if (!isRedisConnected()) {
    const now = Date.now();
    const last = memoryDedup.get(sessionId) || 0;
    if (now - last < windowSeconds * 1000) {
      return true;
    }
    memoryDedup.set(sessionId, now);
    return false;
  }

  const client = getRedisClient();
  try {
    // SET NX returns "OK" if key was set (fresh event), null if already existed (duplicate)
    const result = await client.set(key, "1", "EX", windowSeconds, "NX");
    return result === null; // If null, key already existed -> duplicate!
  } catch (err) {
    console.warn("[Presence] Dedup check error:", err.message);
    return false;
  }
};

module.exports = {
  registerPresence,
  refreshPresence,
  removePresence,
  getExamPresence,
  isTabSwitchDuplicate,
};
