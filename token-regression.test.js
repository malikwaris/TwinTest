const { Token, Army } = require('../src/token');

describe('WW3 Token System - Regression Tests', () => {
  let armyA, armyB, armyC, armyD;

  beforeEach(() => {
    // Setup test armies with different relationships
    armyA = new Army('A', 'Player A');
    armyB = new Army('B', 'Player B'); 
    armyC = new Army('C', 'Player C');
    armyD = new Army('D', 'Player D');

    // A and B are allies
    armyA.allies = ['B'];
    armyB.allies = ['A'];

    // A and D are enemies
    armyA.enemies = ['D'];
    armyD.enemies = ['A'];

    // C is neutral to all
  });

  describe('Visibility Rules - All Permutations', () => {
    test('Own visibility - only owner can see', () => {
      const token = new Token('t1', 'attack', 10, 'own', { type: 'time', value: 1000 });
      armyA.addToken(token);

      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(0);
      expect(armyA.getVisibleTokens(armyC)).toHaveLength(0);
      expect(armyA.getVisibleTokens(armyD)).toHaveLength(0);
    });

    test('Allies visibility - owner and allies can see', () => {
      const token = new Token('t2', 'defense', 5, 'allies', { type: 'time', value: 1000 });
      armyA.addToken(token);

      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(1); // ally
      expect(armyA.getVisibleTokens(armyC)).toHaveLength(0); // neutral
      expect(armyA.getVisibleTokens(armyD)).toHaveLength(0); // enemy
    });

    test('Neutrals visibility - all except enemies can see', () => {
      const token = new Token('t3', 'speed', 3, 'neutrals', { type: 'time', value: 1000 });
      armyA.addToken(token);

      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1); // own
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(1); // ally
      expect(armyA.getVisibleTokens(armyC)).toHaveLength(1); // neutral
      expect(armyA.getVisibleTokens(armyD)).toHaveLength(0); // enemy
    });

    test('Enemies visibility - everyone can see', () => {
      const token = new Token('t4', 'attack', 8, 'enemies', { type: 'time', value: 1000 });
      armyA.addToken(token);

      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyC)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyD)).toHaveLength(1);
    });
  });

  describe('Consumption Strategies', () => {
    test('Time-based expiration', () => {
      const token = new Token('t5', 'attack', 10, 'own', { type: 'time', value: 100 });
      armyA.addToken(token);

      // Before expiration
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);

      // After expiration
      const futureTime = Date.now() + 200;
      armyA.processTimeExpiration(futureTime);
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(0);
    });

    test('Event-based consumption', () => {
      const token = new Token('t6', 'defense', 5, 'own', { type: 'event', value: 'battle' });
      armyA.addToken(token);

      // Before battle
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);

      // After battle event
      armyA.processEvent('battle');
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(0);
    });

    test('Event consumption only affects matching event types', () => {
      const battleToken = new Token('t7', 'attack', 10, 'own', { type: 'event', value: 'battle' });
      const siegeToken = new Token('t8', 'defense', 5, 'own', { type: 'event', value: 'siege' });
      
      armyA.addToken(battleToken);
      armyA.addToken(siegeToken);

      armyA.processEvent('battle');
      
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyA)[0].id).toBe('t8');
    });
  });

  describe('Bug Regression Tests', () => {
    test('REGRESSION: Visibility consistency after consumption', () => {
      // This test catches the original bug where token visibility 
      // became inconsistent after consumption events
      const token = new Token('t9', 'attack', 10, 'allies', { type: 'event', value: 'battle' });
      armyA.addToken(token);

      // Before consumption - allies can see
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(1);
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(1);

      // Consume token
      armyA.processEvent('battle');

      // After consumption - NO ONE should see consumed tokens
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(0);
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(0);
      expect(armyA.getVisibleTokens(armyC)).toHaveLength(0);
      expect(armyA.getVisibleTokens(armyD)).toHaveLength(0);
    });

    test('FAILING TEST: Simultaneous consumption bug', () => {
      // This test would have caught the original bug
      const token1 = new Token('t10', 'attack', 10, 'allies', { type: 'event', value: 'battle' });
      const token2 = new Token('t11', 'defense', 5, 'own', { type: 'time', value: 100 });
      
      armyA.addToken(token1);
      armyA.addToken(token2);

      // Simulate simultaneous consumption (battle + time expiration)
      const futureTime = Date.now() + 200;
      armyA.processEvent('battle');
      armyA.processTimeExpiration(futureTime);

      // Both tokens should be consumed
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(0);
      
      // Critical: Visibility should be consistent across all viewers
      const viewersResults = [
        armyA.getVisibleTokens(armyA).length,
        armyA.getVisibleTokens(armyB).length,
        armyA.getVisibleTokens(armyC).length,
        armyA.getVisibleTokens(armyD).length
      ];
      
      // All viewers should see the same count (0)
      expect(new Set(viewersResults).size).toBe(1);
    });

    test('EDGE CASE: Token visibility during relationship changes', () => {
      const token = new Token('t12', 'speed', 3, 'allies', { type: 'time', value: 1000 });
      armyA.addToken(token);

      // Initially B is ally and can see token
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(1);

      // Relationship changes - B becomes enemy
      armyA.allies = armyA.allies.filter(id => id !== 'B');
      armyA.enemies.push('B');
      armyB.allies = armyB.allies.filter(id => id !== 'A');
      armyB.enemies.push('A');

      // Now B should not see the token
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(0);
    });

    test('EDGE CASE: Multiple tokens with different visibility rules', () => {
      const ownToken = new Token('t13', 'attack', 10, 'own', { type: 'time', value: 1000 });
      const allyToken = new Token('t14', 'defense', 5, 'allies', { type: 'time', value: 1000 });
      const publicToken = new Token('t15', 'speed', 3, 'enemies', { type: 'time', value: 1000 });

      armyA.addToken(ownToken);
      armyA.addToken(allyToken);
      armyA.addToken(publicToken);

      // Owner sees all
      expect(armyA.getVisibleTokens(armyA)).toHaveLength(3);
      
      // Ally sees ally + public
      expect(armyA.getVisibleTokens(armyB)).toHaveLength(2);
      
      // Neutral sees only public
      expect(armyA.getVisibleTokens(armyC)).toHaveLength(1);
      
      // Enemy sees only public
      expect(armyA.getVisibleTokens(armyD)).toHaveLength(1);
    });
  });

  describe('Property-Based Tests', () => {
    test('Consumed tokens are never visible', () => {
      const visibilityTypes = ['own', 'allies', 'neutrals', 'enemies'];
      const viewers = [armyA, armyB, armyC, armyD];

      visibilityTypes.forEach(visibility => {
        const token = new Token(`t-${visibility}`, 'attack', 10, visibility, { type: 'event', value: 'battle' });
        armyA.addToken(token);
        
        // Consume the token
        armyA.processEvent('battle');
        
        // No viewer should see consumed tokens regardless of visibility rules
        viewers.forEach(viewer => {
          expect(armyA.getVisibleTokens(viewer)).not.toContain(token);
        });
      });
    });
  });
});