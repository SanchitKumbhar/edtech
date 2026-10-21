const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const cache = require("../utils/cache");
const { closeRedisConnections } = require("../config/redis");

describe("Cache Layer & Stampede Protection", () => {
  after(async () => {
    await closeRedisConnections();
  });
  it("formatKey should add standard namespace prefix", () => {
    const formatted = cache.formatKey("test:item");
    assert.strictEqual(formatted, "focusflair:cache:test:item");

    const alreadyPrefixed = cache.formatKey("focusflair:cache:test:item");
    assert.strictEqual(alreadyPrefixed, "focusflair:cache:test:item");
  });

  it("wrap should prevent cache stampede with concurrent requests", async () => {
    let producerCallCount = 0;
    const testKey = `stampede:test:${Date.now()}`;

    const expensiveOperation = async () => {
      producerCallCount += 1;
      await new Promise((r) => setTimeout(r, 50));
      return { data: "success", count: producerCallCount };
    };

    // Fire 5 concurrent requests simultaneously for the same key
    const results = await Promise.all([
      cache.wrap(testKey, 10, expensiveOperation),
      cache.wrap(testKey, 10, expensiveOperation),
      cache.wrap(testKey, 10, expensiveOperation),
      cache.wrap(testKey, 10, expensiveOperation),
      cache.wrap(testKey, 10, expensiveOperation),
    ]);

    // All 5 callers receive the identical result
    assert.strictEqual(results.length, 5);
    results.forEach((r) => {
      assert.strictEqual(r.data, "success");
      assert.strictEqual(r.count, 1);
    });

    // Producer was only invoked ONCE despite 5 concurrent callers!
    assert.strictEqual(producerCallCount, 1);

    // Clean up
    await cache.del(testKey);
  });
});
