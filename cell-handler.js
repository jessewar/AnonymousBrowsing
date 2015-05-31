// Opened Cell
exports.handleOpenedCell = function(cell, routerSocket, connectedRouters, routerId, newCircuitId) {
  connectedRouters[routerId] = routerSocket;
  routerSocket.write('create ' + newCircuitId);
};

// Created Cell
exports.handleCreatedCell = function(cell, routerSocket, routerTable, nextRouterData, incomingRouterSocket, incomingCircuitId) {
  console.log('connection creation successful');
  var circuitId = cell.substring(cell.indexOf(' ') + 1);
  if (incomingRouterSocket === undefined && incomingCircuitId === undefined) {  // first connection in circuit, do not send 'extended' cell
    var routerInfo = [routerSocket, circuitId];
    routerTable.firstRouterInfo = routerInfo;
    routerTable[routerInfo] = undefined;
    // since this is the first connection in the circuit, initiate the chain of 'extend' cells
    var nextRouterAddress = nextRouterData[0];
    var nextRouterPort = nextRouterData[1];
    var nextRouterId = nextRouterData[2];
    var relayExtendCell = 'extend ' + circuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
    routerSocket.write(relayExtendCell);
  } else {  // not at start router, need to send 'extended' cell back toward start router
    var incomingRouterInfo = [incomingRouterSocket, incomingCircuitId];
    var outgoingRouterInfo = [routerSocket, circuitId];
    routerTable[incomingRouterInfo] = outgoingRouterInfo;
    routerTable[outgoingRouterInfo] = incomingRouterInfo;
    incomingRouterSocket.write('extended ' + incomingCircuitId) // TODO: making sure this is the right circuitId to use
  }
};

// Relay Extended Cell (at first router)
// exports.handleExtendedCell = function(cell, routerSocket, routerTable, circuitLength) {
//   var circuitId = cell.substring(cell.indexOf(' ') + 1);
//   var routerInfo = [routerSocket, circuitId];

//   if (circuitLength < 3) {  // circuit not yet complete

//   }
// };

// Pass cell along
exports.passCellAlong = function(cell, routerSocket, routerTable) {
  var circuitId = cell.substring(cell.indexOf(' ') + 1);
  var routerInfo = [routerSocket, circuitId];
  var nextHop = routerTable[routerInfo];
  var nextRouterSocket = nextHop[0];
  var nextCircuitId = nextHop[1];
//  cell = swapCircuitIdRelayCell(cell, nextCircuitId);
  nextRouterSocket.write(cell);
};

// Open Cell
exports.handleOpenCell = function(cell, routerSocket) {
  routerSocket.write('opened');
};

// Create cell
exports.handleCreateCell = function(cell, routerSocket, routerTable) {
  var circuitId = cell.substring(cell.indexOf(' ') + 1);
  var routerInfo = [routerSocket, circuitId];
  routerTable[routerInfo] = undefined;  // this router is now the end of this circuit
  routerSocket.write('created ' + circuitId);
};

// Relay Extend cell
// exports.handleExtendCell = function(cell, routerSocket, routerTable) {

// };
