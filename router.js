var net = require('net');

// Tor61 router -----------------------------------------------------

// Establish socket listening for Tor61 connections
var torSocket = net.createServer();
torSocket.listen(1234, function() {
  var address = torSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

torSocket.on('connection', function(client) {
  console.log('client connected');
  client.on('data', function(message) {
    console.log(message.toString());
    if (message.toString() == 'open') {
      client.write('opened');
    } else if (message.toString() == 'create') {
      client.write('created');
    } else if (message.toString() == 'extend') {
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
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
function circuitConnect() {
  // Construct circuit
  var availableRouters = getAvailableRouters();
  var routerInfo = availableRouters[0].split(' ');
  var routerAddress = routerInfo[0];
  var routerPort = parseInt(routerInfo[1]);
  var routerId = routerInfo[2];

  if (routerId in connectedRouters) {
    var circuitSocket = connectedRouters[routerId];
    circuitSocket.write('open');
  } else {
    var circuitSocket = net.connect({host: 'localhost', port: 1234}, function() {
      circuitSocket.write('open');
      connectedRouters[routerId] = circuitSocket;

      circuitSocket.on('data', function(message) {
        console.log(message.toString());
        if (message.toString() == 'opened') {
          var circuitNum = getNewCircuitNumber(true);
          circuitSocket.write('create');
        } else if (message.toString() == 'created') {
          console.log('circuit creation successful, begin extending the circuit');

          sendRelayExtend()
        }
      });
    });
  }
}

// Send a Relay Extend Cell through the circuit
function sendRelayExtend() {

}

// Global variables
var connectedRouters = {};

// ----------------------------

circuitConnect();
