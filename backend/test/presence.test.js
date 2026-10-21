const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const { isTabSwitchDuplicate } = require("../utils/presence");
const { closeRedisConnections } = require("../config/redis");

describe("Distributed Presence & Anti-Cheat Deduplication", () => {
  after(async () => {
    await closeRedisConnections();
  });
  it("should deduplicate rapid consecutive tab-switch triggers", async () => {
    const sessionId = `test-sess-${Date.now()}`;

    // First event: Should NOT be a duplicate
    const isDup1 = await isTabSwitchDuplicate(sessionId, 2);
    assert.strictEqual(isDup1, false, "First event should be fresh");

    // Immediate second event within window: Should BE a duplicate
    const isDup2 = await isTabSwitchDuplicate(sessionId, 2);
    assert.strictEqual(isDup2, true, "Immediate second event should be detected as duplicate");

    // Immediate third event within window: Should BE a duplicate
    const isDup3 = await isTabSwitchDuplicate(sessionId, 2);
    assert.strictEqual(isDup3, true, "Immediate third event should be detected as duplicate");
  });
});
