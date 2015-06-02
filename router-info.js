var RouterInfo = function(routerSocket, circuitId) {
  this.routerSocket = routerSocket;
  this.circuitId = circuitId;
};

RouterInfo.prototype.equals = function(other) {
  return this.routerSocket === other.routerSocket && this.circuitId === other.circuitId;
};

module.exports = RouterInfo;
