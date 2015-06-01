var RouterInfo = function(socket, circuitId) {
  this.socket = socket;
  this.circuitId = circuitId;
};

RouterInfo.prototype.equals = function(other) {
  return this.socket === other.socket && this.circuitId === other.circuitId;
};

module.exports = RouterInfo;
