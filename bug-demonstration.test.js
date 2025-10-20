const { Token, Army } = require('../src/token');

describe('Bug Demonstration - Original WW3 Token Bug', () => {
  let armyA, armyB, armyC;

  beforeEach(() => {
    armyA = new Army('A', 'Player A');
    armyB = new Army('B', 'Player B');
    armyC = new Army('C', 'Player C');

    // A and B are allies
    armyA.allies = ['B'];
    armyB.allies = ['A'];
  });

  test('ORIGINAL BUG: Token visibility inconsistency after event consumption', () => {
    // This test demonstrates the exact bug that occurred in production
    // The bug: When a token with 'allies' visibility was consumed by an event,
    // different viewers would see inconsistent results
    
    const token = new Token('bug-token', 'attack', 15, 'allies', { type: 'event', value: 'battle' });
    armyA.addToken(token);

    // Step 1: Verify initial state - allies can see the token
    expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);
    expect(armyA.getVisibleTokens(armyB)).toHaveLength(1); // ally sees it
    expect(armyA.getVisibleTokens(armyC)).toHaveLength(0); // neutral doesn't

    // Step 2: Consume token via battle event
    armyA.processEvent('battle');

    // Step 3: THE BUG - After consumption, visibility became inconsistent
    // In the buggy version, some viewers would still see the consumed token
    // while others wouldn't, leading to desync issues
    
    const ownerView = armyA.getVisibleTokens(armyA).length;
    const allyView = armyA.getVisibleTokens(armyB).length;
    const neutralView = armyA.getVisibleTokens(armyC).length;

    // All viewers should see the same result (0 tokens)
    expect(ownerView).toBe(0);
    expect(allyView).toBe(0);
    expect(neutralView).toBe(0);

    // This assertion would have failed in the buggy version
    expect(new Set([ownerView, allyView, neutralView]).size).toBe(1);
  });

  test('EDGE CASE: Race condition in simultaneous consumption', () => {
    // Another variant of the bug that occurred with simultaneous events
    const timeToken = new Token('time-token', 'defense', 10, 'allies', { type: 'time', value: 50 });
    const eventToken = new Token('event-token', 'speed', 5, 'allies', { type: 'event', value: 'battle' });
    
    armyA.addToken(timeToken);
    armyA.addToken(eventToken);

    // Simulate race condition: time expiration and event happen simultaneously
    const futureTime = Date.now() + 100;
    
    // In the buggy version, the order of these operations mattered
    // and could lead to inconsistent state
    armyA.processTimeExpiration(futureTime);
    armyA.processEvent('battle');

    // Both tokens should be consumed, visible to no one
    expect(armyA.getVisibleTokens(armyA)).toHaveLength(0);
    expect(armyA.getVisibleTokens(armyB)).toHaveLength(0);
    expect(armyA.getVisibleTokens(armyC)).toHaveLength(0);
  });

  test('CRITICAL: State consistency across multiple operations', () => {
    // This test catches state corruption that could occur with complex scenarios
    const tokens = [
      new Token('t1', 'attack', 10, 'own', { type: 'time', value: 100 }),
      new Token('t2', 'defense', 5, 'allies', { type: 'event', value: 'battle' }),
      new Token('t3', 'speed', 3, 'enemies', { type: 'time', value: 200 }),
      new Token('t4', 'attack', 8, 'neutrals', { type: 'event', value: 'siege' })
    ];

    tokens.forEach(token => armyA.addToken(token));

    // Initial state verification
    expect(armyA.getVisibleTokens(armyA)).toHaveLength(4); // owner sees all
    expect(armyA.getVisibleTokens(armyB)).toHaveLength(3); // ally sees allies+neutrals+enemies
    expect(armyA.getVisibleTokens(armyC)).toHaveLength(2); // neutral sees neutrals+enemies

    // Trigger multiple consumption events
    armyA.processEvent('battle'); // consumes t2
    const futureTime = Date.now() + 150;
    armyA.processTimeExpiration(futureTime); // consumes t1

    // Verify consistent state after partial consumption
    const remainingTokens = armyA.tokens.filter(t => !t.consumed);
    expect(remainingTokens).toHaveLength(2); // t3 and t4 should remain

    // All viewers should see consistent results for remaining tokens
    const ownerVisible = armyA.getVisibleTokens(armyA);
    const allyVisible = armyA.getVisibleTokens(armyB);
    const neutralVisible = armyA.getVisibleTokens(armyC);

    expect(ownerVisible).toHaveLength(2);
    expect(allyVisible).toHaveLength(2);
    expect(neutralVisible).toHaveLength(2);

    // Verify the remaining tokens are the correct ones
    const remainingIds = ownerVisible.map(t => t.id).sort();
    expect(remainingIds).toEqual(['t3', 't4']);
  });
});