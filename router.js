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
    if (message == 'open') {
      routerSocket.write('opened');
    } else if (message.substring(0, message.indexOf(' ')) == 'create') {
      var circuitId = message.substring(message.indexOf(' ') + 1);
      var routerTableKey = [routerSocket, circuitId];
      routerTable[routerTableKey] = undefined;
      routerSocket.write('created ' + circuitId);
    } else if (message.substring(0, message.indexOf(' ')) == 'extend') {
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      var circuitId = message.substring(message.indexOf(' ') + 1);
      var routerTableKey = [routerSocket, circuitId];
      if (routerTable[routerTableKey] === undefined) {
	var tokens = message.split(' ');  // 'extend' circuitId address:port routerId
        var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
	var routerId = parseInt(tokens[3]);
        var routerIpAddress = addressAndPort[0];
        var routerPort = parseInt(addressAndPort[1]);
        circuitConnect();
      } else {
        var nextHop = routerTable[routerTableKey];
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

function createCircuit() {

}

// Extend the circuit by a single node, from the current router
function circuitConnect(incomingRouterSocket, incomingCircuitId) {
  // Construct circuit
  var availableRouter = getAvailableRouters(1)[0];  // e.x. '127.0.0.1 1234 1'
  var routerInfo = availableRouter.split(' ');
  var routerAddress = routerInfo[0];
  var routerPort = parseInt(routerInfo[1]);
  var routerId = routerInfo[2];

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
          if (incomingRouterSocket === undefined && incomingCircuitId === undefined) {
            firstRouterInfo = [routerSocket, circuitId];
	    routerTable[firstRouterInfo] = undefined;
          } else {
            var routerTableKey = [incomingRouterSocket, incomingCircuitId];
            routerTable[routerTableKey] = [routerSocket, circuitId];
          }
          // if circuit length < 3: extend circuit
          circuitLength++;
          if (circuitLength < 3) {
            var firstRouterSocket = firstRouterInfo[0];
            var firstRouterCircuitId = firstRouterInfo[1];
	    var nextRouter = getAvailableRouters(2)[0];  // e.x. '127.0.0.1 1234 1'
	    var nextRouterInfo = nextRouter.split(' ');
	    var nextRouterAddress = routerInfo[0];
	    var nextRouterPort = routerInfo[1];
	    var nextRouterId = routerInfo[2];
	    var relayExtendCell = 'extend ' + firstRouterCircuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
            firstRouterSocket.write(relayExtendCell);
          }
        } else if (message.substring(0, message.indexOf(' ')) == 'extended' && routerSocket == firstRouterInfo[0]) {  // extended
	  
	}
      });
    });
  }
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

circuitConnect();
