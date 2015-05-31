var net = require('net');
//var cellHandler = require('./cell-handler.js');

// Tor61 router -----------------------------------------------------

// Establish socket listening for Tor61 connections
var torServerSocket = net.createServer();
torServerSocket.listen(1234, function() {
  var address = torServerSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

torServerSocket.on('connection', function(routerSocket) {
      routerSocket.on('data', function(cell) {
	cell = cell.toString();
	console.log(cell);
	if (cell == 'open') {  // open
	  routerSocket.write('opened');
	} else if (cell == 'opened') {  // opened
	  // var newCircuitId = getNewCircuitId(true);
	  // connectedRouters[routerId] = routerSocket;
	  // routerSocket.write('create ' + newCircuitId);
	} else if (cell.substring(0, cell.indexOf(' ')) == 'create') {  // create
	  var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  var routerInfo = [routerSocket, circuitId];
	  routerTable[routerInfo] = undefined;  // this router is now the end of this circuit
	  routerSocket.write('created ' + circuitId);
	} else if (cell.substring(0, cell.indexOf(' ')) == 'created') {  // created
	  // var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  // if (incomingRouterSocket === undefined && incomingCircuitId === undefined) {  // first connection in circuit, do not send 'extended' cell
          //   circuitLength++;
          //   var routerInfo = [routerSocket, circuitId];
          //   routerTable.firstRouterInfo = routerInfo;
          //   routerTable[routerInfo] = undefined;
          //   // since this is the first connection in the circuit, initiate the chain of 'extend' cells
          //   var nextRouterData = getAvailableRouters()[0].split(' ');
          //   var nextRouterAddress = nextRouterData[0];
          //   var nextRouterPort = nextRouterData[1];
          //   var nextRouterId = nextRouterData[2];
          //   var relayExtendCell = 'extend ' + circuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
          //   routerSocket.write(relayExtendCell);
	  // } else {  // not at start router, need to send 'extended' cell back toward start router
          //   var incomingRouterInfo = [incomingRouterSocket, incomingCircuitId];
          //   var outgoingRouterInfo = [routerSocket, circuitId];
          //   routerTable[incomingRouterInfo] = outgoingRouterInfo;
          //   routerTable[outgoingRouterInfo] = incomingRouterInfo;
          //   incomingRouterSocket.write('extended ' + incomingCircuitId) // TODO: making sure this is the right circuitId to use
	  // }
	} else if (cell.substring(0, cell.indexOf(' ')) == 'extend') {  // extend
	  var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  var routerInfo = [routerSocket, circuitId];
	  if (routerTable[routerInfo] === undefined) {  // we are at the last router in the circuit, call circuitConnect()
            var tokens = cell.split(' ');  // 'extend', circuitId, address:port, routerId
            var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
            var routerAddress = addressAndPort[0];
            var routerPort = parseInt(addressAndPort[1]);
            var routerId = parseInt(tokens[3]);
            circuitConnect(routerId, routerAddress, routerPort, routerSocket, circuitId);
	  } else {
            var circuitId = cell.substring(cell.indexOf(' ') + 1);
            var routerInfo = [routerSocket, circuitId];
            var nextHop = routerTable[routerInfo];
            var nextRouterSocket = nextHop[0];
            var nextCircuitId = nextHop[1];
            //  cell = swapCircuitIdRelayCell(cell, nextCircuitId);
            nextRouterSocket.write(cell);
	  }
	} else if (cell.substring(0, cell.indexOf(' ')) == 'extended') {  // extended
	  // var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  // var routerInfo = [routerSocket, circuitId];
	  // if (routerTable[routerInfo] === undefined) {  // we are at the first router in the circuit, process the 'extended' cell
          //   circuitLength++;
          //   if (circuitLength < 1) {
          //     var nextRouterData = getAvailableRouters()[0].split(' ');
          //     var nextRouterAddress = nextRouterData[0];
          //     var nextRouterPort = nextRouterData[1];
          //     var nextRouterId = nextRouterData[2];
          //     var relayExtendCell = 'extend ' + circuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
          //     routerSocket.write(relayExtendCell);
          //   }
	  // } else {
          //   var circuitId = cell.substring(cell.indexOf(' ') + 1);
          //   var routerInfo = [routerSocket, circuitId];
          //   var nextHop = routerTable[routerInfo];
          //   var nextRouterSocket = nextHop[0];
          //   var nextCircuitId = nextHop[1];
          //   //  cell = swapCircuitIdRelayCell(cell, nextCircuitId);
          //   nextRouterSocket.write(cell);
	  // }
	}
      });

});

// HTTP socket ------------------------------------------------------

// Establish socket listening for HTTP connections
var serverSocket = net.createServer();
serverSocket.listen(5555, function() {
  var address = serverSocket.address();
  console.log('HTTP server socket listening on ' + address.address + ":" + address.port);
});

// TODO: Contact registration service to get actual list of available routers
// Returns a list of other routers available within the network
function getAvailableRouters() {
  return ['127.0.0.1 1234 1'];
}

// TODO: Randomly generate a new number that is not in use
// Returns a circuit number that is not currently in use. The odd parameter specifies whether it should be an odd or even number.
function getNewCircuitId(odd) {
  if (odd) {
    return 1;
  } else {
    return 2;
  }
}

function getRelayExtendCell() {
  var firstRouterSocket = firstRouterInfo[0];
  var firstRouterCircuitId = firstRouterInfo[1];
  var nextRouter = getAvailableRouters()[0];  // e.x. '127.0.0.1 1234 1'
  var nextRouterData = nextRouter.split(' ');
  var nextRouterAddress = nextRouterData[0];
  var nextRouterPort = nextRouterData[1];
  var nextRouterId = nextRouterData[2];
  var relayExtendCell = 'extend ' + firstRouterCircuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
  return relayExtendCell;
}

// Establishes a full circuit. Only to be called once upon startup.
function initiateCircuitCreation() {
  var routerData = getAvailableRouters()[0].split(' ');  // e.x. '127.0.0.1 1234 1'
  var routerAddress = routerData[0];
  var routerPort = routerData[1];
  var routerId = routerData[2];
  circuitConnect(routerId, routerAddress, routerPort, undefined, undefined);
}

// Extend the circuit by a single node, from the current router
function circuitConnect(routerId, routerAddress, routerPort, incomingRouterSocket, incomingCircuitId) {
  if (routerId in connectedRouters) {
    var routerSocket = connectedRouters[routerId];
    var newCircuitId = getNewCircuitId(false);
    routerSocket.write('create ' + newCircuitId);
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      // Send an Open Cell
      routerSocket.write('open');

      routerSocket.on('data', function(cell) {
	cell = cell.toString();
	console.log(cell);
	if (cell == 'open') {  // open
	  // routerSocket.write('opened');
	} else if (cell == 'opened') {  // opened
	  var newCircuitId = getNewCircuitId(true);
	  connectedRouters[routerId] = routerSocket;
	  routerSocket.write('create ' + newCircuitId);
//	} else if (cell.substring(0, cell.indexOf(' ')) == 'create') {  // create
	  // var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  // var routerInfo = [routerSocket, circuitId];
	  // routerTable[routerInfo] = '';  // this router is now the end of this circuit
	  // routerSocket.write('created ' + circuitId);
	} else if (cell.substring(0, cell.indexOf(' ')) == 'created') {  // created
	  var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  if (incomingRouterSocket === undefined && incomingCircuitId === undefined) {  // first connection in circuit, do not send 'extended' cell
            circuitLength++;
            var routerInfo = [routerSocket, circuitId];
            routerTable.firstRouterInfo = routerInfo;
            routerTable[routerInfo] = '';
            // since this is the first connection in the circuit, initiate the chain of 'extend' cells
            var nextRouterData = getAvailableRouters()[0].split(' ');
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
	//} else if (cell.substring(0, cell.indexOf(' ')) == 'extend') {  // extend
	  // var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  // var routerInfo = [routerSocket, circuitId];
	  // if (routerTable[routerInfo] === '') {  // we are at the last router in the circuit, call circuitConnect()
          //   var tokens = cell.split(' ');  // 'extend', circuitId, address:port, routerId
          //   var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
          //   var routerAddress = addressAndPort[0];
          //   var routerPort = parseInt(addressAndPort[1]);
          //   var routerId = parseInt(tokens[3]);
          //   circuitConnect(routerId, routerAddress, routerPort, routerSocket, circuitId);
	  // } else {
          //   var circuitId = cell.substring(cell.indexOf(' ') + 1);
          //   var routerInfo = [routerSocket, circuitId];
          //   var nextHop = routerTable[routerInfo];
          //   var nextRouterSocket = nextHop[0];
          //   var nextCircuitId = nextHop[1];
          //   //  cell = swapCircuitIdRelayCell(cell, nextCircuitId);
          //   nextRouterSocket.write(cell);
	  //}
	} else if (cell.substring(0, cell.indexOf(' ')) == 'extended') {  // extended
	  var circuitId = cell.substring(cell.indexOf(' ') + 1);
	  var routerInfo = [routerSocket, circuitId];
	  if (routerTable[routerInfo] === undefined) {  // we are at the first router in the circuit, process the 'extended' cell
            circuitLength++;
            if (circuitLength < 1) {
              var nextRouterData = getAvailableRouters()[0].split(' ');
              var nextRouterAddress = nextRouterData[0];
              var nextRouterPort = nextRouterData[1];
              var nextRouterId = nextRouterData[2];
              var relayExtendCell = 'extend ' + circuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
              routerSocket.write(relayExtendCell);
            }
	  } else {
            var circuitId = cell.substring(cell.indexOf(' ') + 1);
            var routerInfo = [routerSocket, circuitId];
            var nextHop = routerTable[routerInfo];
            var nextRouterSocket = nextHop[0];
            var nextCircuitId = nextHop[1];
            //  cell = swapCircuitIdRelayCell(cell, nextCircuitId);
            nextRouterSocket.write(cell);
	  }
	}
      });
      
    });
  }
}

// Global variables
var connectedRouters = {};  // routerId -> socket to router
var circuitLength = 0;
var routerTable = {};  // incoming (socket, circuitId) -> outgoing (socket, circuitId)

// ----------------------------

initiateCircuitCreation();
