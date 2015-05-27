var net = require('net');

// Establish socket listening for HTTP connections
var serverSocket = net.createServer();
serverSocket.listen(5555, function() {
  var address = serverSocket.address();
  console.log('HTTP server socket listening on ' + address.address + ":" + address.port);
});

// Establish socket listening for Tor61 connections
var torSocket = net.createServer();
torSocket.listen(1234, function() {
  var address = torSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

// Returns a list of other routers available within the network
function getAvailableRouters() {
  return ['127.0.0.1 1234 1'];
}

var connectedRouters = [];

// Construct circuit
var availableRouters = getAvailableRouters();
var routerInfo = availableRouters[0].split(' ');
var routerAddress = routerInfo[0];
var routerPort = parseInt(routerInfo[1]);
var routerId = routerInfo[2];

var circuitSocket;
if (connectedRouters.indexOf(routerId) < 0) {
  
}
