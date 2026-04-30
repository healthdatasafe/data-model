const assert = require('node:assert/strict');

const items = require('../src/items');
const streams = require('../src/streams');

describe('[CTXR] Context-via-substream resolution (Plan 46 §2.1)', () => {
  describe('isDescendantOf', () => {
    it('[CTXR-A] returns true when candidate equals ancestor', () => {
      assert.equal(streams.isDescendantOf('treatment', 'treatment'), true);
    });
    it('[CTXR-B] returns true for direct child', () => {
      assert.equal(streams.isDescendantOf('treatment-fertility', 'treatment'), true);
    });
    it('[CTXR-C] returns false for unrelated stream', () => {
      assert.equal(streams.isDescendantOf('procedure-fertility', 'treatment'), false);
    });
    it('[CTXR-D] returns false for ancestor of', () => {
      assert.equal(streams.isDescendantOf('treatment', 'treatment-fertility'), false);
    });
    it('[CTXR-E] returns false when candidate stream unknown', () => {
      assert.equal(streams.isDescendantOf('does-not-exist', 'treatment'), false);
    });
  });

  describe('findItemForEvent', () => {
    it('[CTXR-F] resolves direct (streamId, eventType) match', () => {
      const item = items.findItemForEvent('treatment/basic', 'treatment');
      assert.ok(item);
      assert.equal(item.streamId, 'treatment');
      assert.equal(item.eventType, 'treatment/basic');
    });
    it('[CTXR-G] resolves via parent walk-up from descendant context', () => {
      const item = items.findItemForEvent('treatment/basic', 'treatment-fertility');
      assert.ok(item);
      assert.equal(item.streamId, 'treatment');
      assert.equal(item.eventType, 'treatment/basic');
    });
    it('[CTXR-H] resolves coded variant via walk-up', () => {
      const item = items.findItemForEvent('procedure/coded-v1', 'procedure-fertility');
      assert.ok(item);
      assert.equal(item.streamId, 'procedure');
      assert.equal(item.eventType, 'procedure/coded-v1');
    });
    it('[CTXR-I] returns null on type+stream mismatch', () => {
      // procedure/coded-v1 cannot resolve from a treatment-* stream
      const item = items.findItemForEvent('procedure/coded-v1', 'treatment-fertility');
      assert.equal(item, null);
    });
    it('[CTXR-J] returns null when stream unknown', () => {
      const item = items.findItemForEvent('treatment/basic', 'no-such-stream');
      assert.equal(item, null);
    });
    it('[CTXR-K] returns null when eventType unknown', () => {
      const item = items.findItemForEvent('no-such/type', 'treatment');
      assert.equal(item, null);
    });
  });

  describe('getAncestorsById', () => {
    it('[CTXR-L] returns chain inclusive of self', () => {
      assert.deepEqual(streams.getAncestorsById('treatment-fertility'), ['treatment-fertility', 'treatment']);
    });
    it('[CTXR-M] returns single-element chain for root', () => {
      assert.deepEqual(streams.getAncestorsById('treatment'), ['treatment']);
    });
  });
});
