var RouterTable = function() {
  this.keyList = [];  // incoming router info
  this.valueList = [];  // outgoing router info
  this.firstRouterInfo = [undefined, undefined];
};

RouterTable.prototype.set = function(key, value) {
  var keyIndex = getIndexOf(this.keyList, key);
  if (keyIndex < 0) {
    this.keyList.push(key);
    this.valueList.push(value);
  } else {
    this.valueList[keyIndex] = value;
  }
};

RouterTable.prototype.get = function(key) {
  var keyIndex = getIndexOf(this.keyList, key);
  if (keyIndex >= 0) {
    return this.valueList[keyIndex];
  } else {
    return undefined;
  }
};

RouterTable.prototype.getIncomingRouterInfoFromCircuitId = function(circuitId) {
  for (var i = 0; i < this.keyList.length; i++) {
    var routerInfo = this.keyList[i];
    if (routerInfo.circuitId === circuitId) {
      return routerInfo;
    }
  }
  return undefined;
};

RouterTable.prototype.toString = function() {
  var result = '';
  result += 'keyList: [';
  for (var i = 0; i < this.keyList.length; i++) {
    var key = this.keyList[i];
    result += key.toString();
    result += ', ';
  }
  result += ']\n';

  result += 'valueList: [';
  for (var i = 0; i < this.valueList.length; i++) {
    var value = this.valueList[i];
    result += value.toString();
    result += ', ';
  }
  result += ']\n';

  result += 'firstRouterInfo: ' + this.firstRouterInfo.toString();
  
  return result;
};

function getIndexOf(list, item) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].equals(item)) {
      return i;
    }
  }
  return -1;
}

module.exports = RouterTable;
