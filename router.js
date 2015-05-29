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
    console.log(message.toString());
    if (message.toString() == 'open') {
      routerSocket.write('opened');
    } else if (message.toString() == 'create') {
      routerSocket.write('created');
    } else if (message.toString() == 'extend') {
      var circuitId = getCircuitId(message);
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      if (routerTable[routerSocket, circuitId] === undefined) {
        circuitConnect();
      } else {
        var nextHop = routerTable[[routerSocket, circuitId]];
        var nextRouterSocket = nextHop[0];
        var nextCircuitId = nextHop[1];
        nextRouterSocket.write('extend ' + nextCircuitId);
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
function getAvailableRouters() {
  return ['127.0.0.1 1234 1'];
}

// TODO: Randomly generate a new number that is not in use
// Returns a circuit number that is not currently in use. The odd parameter specifies whether it should be an odd or even number.
function getNewCircuitNumber(odd) {
  if (odd) {
    return 1;
  } else {
    return 2;
  }
}

// Extend the circuit by a single node, from the current router
function circuitConnect(isFirst) {
  // Construct circuit
  var availableRouters = getAvailableRouters();
  var routerInfo = availableRouters[0].split(' ');
  var routerAddress = routerInfo[0];
  var routerPort = parseInt(routerInfo[1]);
  var routerId = routerInfo[2];

  if (routerId in connectedRouters) {
    var routerSocket = connectedRouters[routerId];
    var circuitNum = getNewCircuitNumber(true);
    routerSocket.write('create');
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      routerSocket.write('open');

      var circuitNum = getNewCircuitNumber(true);
      routerSocket.on('data', function(message) {
        console.log(message.toString());
        if (message.toString() == 'opened') {
          routerSocket.write('create');
        } else if (message.toString() == 'created') {
          connectedRouters[routerId] = routerSocket;
          emitter.emit('circuitConnect', routerSocket, circuitNum, isFirst);
        }
      });
    });
  }
}

emitter.on('circuitConnect', function(routerSocket, circuitNum, isFirst) {
  console.log('first circuit connection successful');
  if (isFirst) {
    firstRouterSocket = routerSocket;
  } else {

  }
});

// Send a Relay Extend Cell through the circuit
function sendRelayExtend(routerSocket) {
  routerSocket.write('extend');
}

// Global variables
var connectedRouters = {};  // routerId -> socket to router
var firstRouterSocket;
var routerTable = {};  // incoming (socket, circuitId) -> outgoing (socket, circuitId)

// ----------------------------

circuitConnect(true);
