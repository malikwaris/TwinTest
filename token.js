// WW3 Army Token System
class Token {
  constructor(id, type, value, visibility, consumption) {
    this.id = id;
    this.type = type; // 'attack', 'defense', 'speed'
    this.value = value; // buff amount
    this.visibility = visibility; // 'own', 'allies', 'neutrals', 'enemies'
    this.consumption = consumption; // { type: 'time'|'event', value: ttl|eventType }
    this.createdAt = Date.now();
    this.consumed = false;
  }

  isVisibleTo(viewerArmy, targetArmy) {
    if (this.consumed) return false;
    
    const relationship = this.getRelationship(viewerArmy, targetArmy);
    
    switch (this.visibility) {
      case 'own':
        return viewerArmy.id === targetArmy.id;
      case 'allies':
        return relationship === 'own' || relationship === 'ally';
      case 'neutrals':
        return relationship !== 'enemy';
      case 'enemies':
        return true; // visible to all
      default:
        return false;
    }
  }

  getRelationship(viewerArmy, targetArmy) {
    if (viewerArmy.id === targetArmy.id) return 'own';
    if (viewerArmy.allies.includes(targetArmy.id)) return 'ally';
    if (viewerArmy.enemies.includes(targetArmy.id)) return 'enemy';
    return 'neutral';
  }

  shouldExpire(currentTime) {
    if (this.consumed) return false;
    
    if (this.consumption.type === 'time') {
      return (currentTime - this.createdAt) >= this.consumption.value;
    }
    return false;
  }

  consumeByEvent(eventType) {
    if (this.consumed) return false;
    
    if (this.consumption.type === 'event' && this.consumption.value === eventType) {
      this.consumed = true;
      return true;
    }
    return false;
  }

  expire() {
    this.consumed = true;
  }
}

class Army {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.allies = [];
    this.enemies = [];
    this.tokens = [];
  }

  addToken(token) {
    this.tokens.push(token);
  }

  getVisibleTokens(viewerArmy) {
    return this.tokens.filter(token => token.isVisibleTo(viewerArmy, this));
  }

  processTimeExpiration(currentTime) {
    this.tokens.forEach(token => {
      if (token.shouldExpire(currentTime)) {
        token.expire();
      }
    });
  }

  processEvent(eventType) {
    this.tokens.forEach(token => {
      token.consumeByEvent(eventType);
    });
  }
}

module.exports = { Token, Army };