var net = require('net');
var cellHandler = require('./cell-handler.js');

// Tor61 router -----------------------------------------------------

// Establish socket listening for Tor61 connections
var torServerSocket = net.createServer();
torServerSocket.listen(1234, function() {
  var address = torServerSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

torServerSocket.on('connection', function(routerSocket) {
  console.log('routerSocket connected');

  routerSocket.on('data', function(message) {
    message = message.toString();
    console.log(message);
    if (message == 'open') {  // open
      routerSocket.write('opened');
    } else if (message.substring(0, message.indexOf(' ')) == 'create') {  // create
      var circuitId = message.substring(message.indexOf(' ') + 1);
      var routerInfo = [routerSocket, circuitId];
      routerTable[routerInfo] = undefined;  // this router is now the end of this circuit
      routerSocket.write('created ' + circuitId);
    } else if (message.substring(0, message.indexOf(' ')) == 'extend') {  // extend
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      var circuitId = message.substring(message.indexOf(' ') + 1);
      var routerInfo = [routerSocket, circuitId];
      if (routerTable[routerInfo] === undefined) {
        var tokens = message.split(' ');  // 'extend', circuitId, address:port, routerId
        var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
        var routerAddress = addressAndPort[0];
        var routerPort = parseInt(addressAndPort[1]);
        var routerId = parseInt(tokens[3]);
        circuitConnect(routerId, routerAddress, routerPort, routerSocket, circuitId);
      } else {
        var nextHop = routerTable[routerInfo];
        var nextRouterSocket = nextHop[0];
        var nextCircuitId = nextHop[1];
        message = swapCircuitIdRelayCell(message, nextCircuitId);
        nextRouterSocket.write(message);
      }
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
function getAvailableRouters(routerId) {
  return ['127.0.0.1 1234 ' + routerId];
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
  var nextRouter = getAvailableRouters(2)[0];  // e.x. '127.0.0.1 1234 1'
  var nextRouterData = nextRouter.split(' ');
  var nextRouterAddress = nextRouterData[0];
  var nextRouterPort = nextRouterData[1];
  var nextRouterId = nextRouterData[2];
  var relayExtendCell = 'extend ' + firstRouterCircuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
  return relayExtendCell;
}

// Establishes a full circuit. Only to be called once upon startup.
function initiateCircuitCreation() {
  var routerData = getAvailableRouters(2)[0].split(' ');  // e.x. '127.0.0.1 1234 1'
  var routerAddress = routerData[0];
  var routerPort = routerData[1];
  var routerId = routerData[2];
  circuitConnect(routerId, routerAddress, routerPort);
}

// Extend the circuit by a single node, from the current router
function circuitConnect(routerId, routerAddress, routerPort, incomingRouterSocket, incomingCircuitId) {
  if (routerId in connectedRouters) {
    var routerSocket = connectedRouters[routerId];
    var newCircuitId = getNewCircuitId(true);
    routerSocket.write('create ' + newCircuitId);
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      routerSocket.write('open');

      routerSocket.on('data', function(cell) {
        cell = cell.toString();
        console.log(cell);
        if (cell == 'opened') {  // opened
          var newCircuitId = getNewCircuitId(true);
          connectedRouters[routerId] = routerSocket;
          routerSocket.write('create ' + newCircuitId);
        } else if (cell.substring(0, cell.indexOf(' ')) == 'created') {  // created
          console.log('connection creation successful');
          var circuitId = cell.substring(cell.indexOf(' ') + 1);
          if (incomingRouterSocket === undefined && incomingCircuitId === undefined) {  // first connection in circuit, do not send 'extended' cell
            var routerInfo = [routerSocket, circuitId];
            routerTable.firstRouterInfo = routerInfo;
            routerTable[routerInfo] = undefined;
            circuitLength++;
            // since this is the first connection in the circuit, initiate the chain of 'extend' cells
            var nextRouterData = getAvailableRouters(2)[0].split(' ');  // e.x. '127.0.0.1 1234 1'
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
        } else if (cell.substring(0, cell.indexOf(' ')) == 'extended') {  // extended
          var circuitId = cell.substring(cell.indexOf(' ') + 1);
          var routerInfo = [routerSocket, circuitId];
          if (routerTable[routerInfo] === undefined) {  // we are at the first router in the circuit, process the 'extended' cell
            circuitLength++;
            if (circuitLength < 3) {  // circuit not yet complete

            }
          } else {  // we are NOT at the first router, forward the cell towards the first router
            var nextHop = routerTable[routerInfo];

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
