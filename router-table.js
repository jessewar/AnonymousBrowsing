var RouterTable = function() {
  this.keyList = [];
  this.valueList = [];
  this.firstRouterInfo = [undefined, undefined];
};

RouterTable.prototype.set = function(key, value) {
  if (this.keyList.indexOf(key) < 0) {
    this.keyList.push(key);
    this.valueList.push(value);
  } else {
    for (var i = 0; i < this.keyList.length; i++) {
      if (this.keyList[i] === key) {
	this.valueList[i] = value;
	break;
      }
    }
  }
};

module.exports = RouterTable;
