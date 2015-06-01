var RouterTable = function() {
  this.keyList = [];
  this.valueList = [];
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

function getIndexOf(list, item) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].equals(item)) {
      return i;
    }
  }
  return -1;
}

module.exports = RouterTable;
