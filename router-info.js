var RouterInfo = function(routerSocket, circuitId) {
  this.routerSocket = routerSocket;
  this.circuitId = circuitId;
};

RouterInfo.prototype.equals = function(other) {
  var equalSockets = this.routerSocket === other.routerSocket;
  var equalCircuitIds = this.circuitId === other.circuitId;
  // console.log('equal sockets: ' + equalSockets);
  // console.log('equal circuit Ids: ' + equalCircuitIds);
  return equalSockets && equalCircuitIds;
//  return this.routerSocket === other.routerSocket && this.circuitId === other.circuitId;
};

RouterInfo.prototype.toString = function() {
  return '(' + this.routerSocket.id + ', ' + this.circuitId + ')';
};

module.exports = RouterInfo;
