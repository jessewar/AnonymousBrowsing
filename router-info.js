var RouterInfo = function(routerSocket, circuitId) {
  this.routerSocket = routerSocket;
  this.circuitId = circuitId;
};

RouterInfo.prototype.equals = function(other) {
  var equalSockets = this.routerSocket === other.routerSocket;
  var equalCircuitIds = this.circuitId === other.circuitId;
  return equalSockets && equalCircuitIds;
};

RouterInfo.prototype.toString = function() {
  return '(' + this.routerSocket.id + ', ' + this.circuitId + ')';
};

module.exports = RouterInfo;
