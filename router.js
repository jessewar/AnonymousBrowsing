var net = require('net');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

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
      var routerTableKey = [routerSocket, circuitId];
      routerTable[routerTableKey] = undefined;
      routerSocket.write('created ' + circuitId);
    } else if (message.substring(0, message.indexOf(' ')) == 'extend') {  // extend
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      var circuitId = message.substring(message.indexOf(' ') + 1);
      var routerTableKey = [routerSocket, circuitId];
      if (routerTable[routerTableKey] === undefined) {
        var tokens = message.split(' ');  // 'extend' circuitId address:port routerId
        var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
        var routerAddress = addressAndPort[0];
        var routerPort = parseInt(addressAndPort[1]);
        var routerId = parseInt(tokens[3]);
        circuitConnect(routerId, routerAddress, routerPort, routerSocket, circuitId);  // want socket to next router and the next circuit id
        // var nextRouterTableKey = [nextRouterSocket, nextCircuitId];
        // routerTable[routerTableKey] = nextRouterTableKey;
        // routerTable[nextRouterTableKey] = routerTableKey;
      } else {
        var nextHop = routerTable[routerTableKey];
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
  var nextRouterInfo = nextRouter.split(' ');
  var nextRouterAddress = nextRouterInfo[0];
  var nextRouterPort = nextRouterInfo[1];
  var nextRouterId = nextRouterInfo[2];
  var relayExtendCell = 'extend ' + firstRouterCircuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
  return relayExtendCell;
}

// Establishes a full circuit. Only to be called once upon startup.
function createCircuit() {
  var availableRouter = getAvailableRouters(1)[0];  // e.x. '127.0.0.1 1234 1'
  var routerInfo = availableRouter.split(' ');
  var routerAddress = routerInfo[0];
  var routerPort = parseInt(routerInfo[1]);
  var routerId = routerInfo[2];

  if (routerId in connectedRouters) {
    var routerSocket = connectedRouters[routerId];
    var newCircuitId = getNewCircuitId(true);
    routerSocket.write('create ' + newCircuitId);
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      routerSocket.write('open');

      routerSocket.on('data', function(message) {
        message = message.toString();
        console.log(message);
        if (message == 'opened') {  // opened
          var newCircuitId = getNewCircuitId(true);
          routerSocket.write('create ' + newCircuitId);
        } else if (message.substring(0, message.indexOf(' ')) == 'created') {  // created
          console.log('creation successful');
          var circuitId = message.substring(message.indexOf(' ') + 1);
          connectedRouters[routerId] = routerSocket;
          firstRouterInfo = [routerSocket, circuitId];
          routerTable[firstRouterInfo] = undefined;
          var relayExtendCell = getRelayExtendCell();
          routerSocket.write(relayExtendCell);
        } else if (message.substring(0, message.indexOf(' ')) == 'extended') {  // extended
          // this is the first router in circuit so we process Relay Extended Cell
          // TODO: we should process every type of Relay Cell here
          circuitLength++;
          if (circuitLength < 3) {

          }
        }
      });
    });
  }
}

// Extend the circuit by a single node, from the current router
function circuitConnect(routerId, routerAddress, routerPort, incomingRouterSocket, incomingCircuitId) {
  if (routerId in connectedRouters) {
    var routerSocket = connectedRouters[routerId];
    var circuitNum = getNewCircuitId(true);
    routerSocket.write('create');
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      routerSocket.write('open');

      routerSocket.on('data', function(message) {
        message = message.toString();
        console.log(message);
        if (message == 'opened') {  // opened
          var newCircuitId = getNewCircuitId(true);
          routerSocket.write('create ' + newCircuitId);
        } else if (message.substring(0, message.indexOf(' ')) == 'created') {  // created
          console.log('creation successful');
          var circuitId = message.substring(message.indexOf(' ') + 1);
          connectedRouters[routerId] = routerSocket;
          var routerTableKey = [incomingRouterSocket, incomingCircuitId];
          var nextRouterTablekey = [routerSocket, circuitId];
          routerTable[routerTableKey] = nextRouterTableKey;
          routerTable[nextRouterTableKey] = routerTableKey;
          incomingRouterSocket.write('extended ' + incomingCircuitId) // TODO: making sure this is the right circuitId to use
        } else if (message.substring(0, message.indexOf(' ')) == 'extended') {  // extended

        }
      });
    });
  }
}

function processCell(cell) {

}

// Indicates that the first circuit connection was successfully established
emitter.on('circuitConnect', function(routerSocket, circuitNum, isFirst) {
  console.log('first circuit connection successful');
  if (isFirst) {
    firstRouterInfo = routerInfo;
  } else {

  }
});

// Send a Relay Extend Cell through the circuit
function sendRelayExtend(routerSocket) {
  routerSocket.write('extend');
}

// Global variables
var connectedRouters = {};  // routerId -> socket to router
var circuitLength = 0;
var firstRouterInfo;
var routerTable = {};  // incoming (socket, circuitId) -> outgoing (socket, circuitId)

// ----------------------------

createCircuit();
