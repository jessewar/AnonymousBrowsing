var net = require('net');
var RouterTable = require('./router-table.js');
var RouterInfo = require('./router-info.js');

// Tor61 router -----------------------------------------------------

// Establish socket listening for Tor61 connections
var torServerSocket = net.createServer();
torServerSocket.listen(1234, function() {
  var address = torServerSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

torServerSocket.on('connection', function(routerSocket) {
  console.log('routerSocket connected');
  routerSocket.id = Math.floor(Math.random() * 1000);
  routerSocket.on('data', function(cell) {
    cell = cell.toString();
    console.log(cell);
    if (cell == 'open') {  // open
      routerSocket.write('opened');
    } else if (cell.substring(0, cell.indexOf(' ')) == 'create') {  // create
      var circuitId = parseInt(cell.substring(cell.indexOf(' ') + 1));
      var routerInfo = new RouterInfo(routerSocket, circuitId);
      routerTable.set(routerInfo, '');  // this router is now the end of this circuit
      routerSocket.write('created ' + circuitId);
    } else if (cell.substring(0, cell.indexOf(' ')) == 'extend') {  // extend
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      var circuitId = parseInt(cell.split(' ')[1]);
      var routerInfo = new RouterInfo(routerSocket, circuitId);
      if (routerTable.get(routerInfo) === '') {  // we are at the end of the circuit
        var tokens = cell.split(' ');  // 'extend', circuitId, address:port, routerId
        var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
        var routerAddress = addressAndPort[0];
        var routerPort = parseInt(addressAndPort[1]);
        var routerId = parseInt(tokens[3]);
        var newCircuitId = getNewCircuitId(false);
        circuitIdMap[newCircuitId] = circuitId;
        circuitIdMap[circuitId] = newCircuitId;
        circuitConnect(routerId, routerAddress, routerPort, newCircuitId);
      } else {
        var nextRouterInfo = routerTable.get(routerInfo);
        var nextRouterSocket = nextRouterInfo.routerSocket;
        var nextCircuitId = nextRouterInfo.circuitId;
        cell = cell.substring(cell.indexOf(' ')) + ' ' + nextCircuitId + ' ' + cell.substring(cell.indexOf('127'));
        nextRouterSocket.write(cell);
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
function getNewCircuitId(odd) {
  if (odd) {
    return 1;
  } else {
    return 2;
  }
}

// Establishes a full circuit. Only to be called once upon startup.
function initiateCircuitCreation() {
  var routerData = getAvailableRouters()[0].split(' ');  // e.x. '127.0.0.1 1234 1'
  var routerAddress = routerData[0];
  var routerPort = routerData[1];
  var routerId = routerData[2];
  var newCircuitId = getNewCircuitId(true);
  startCircuitId = newCircuitId;
  circuitConnect(routerId, routerAddress, routerPort, newCircuitId);
}

// Extend the circuit by a single node, from the current router
function circuitConnect(routerId, routerAddress, routerPort, newCircuitId) {
  if (routerId in connectedRouters) {
    var routerSocket = connectedRouters[routerId];
    routerSocket.write('create ' + newCircuitId);
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      routerSocket.write('open');
      routerSocket.id = Math.floor(Math.random() * 1000);

      routerSocket.on('data', function(cell) {
        cell = cell.toString();
        console.log(cell);
        if (cell == 'opened') {  // opened
          connectedRouters[routerId] = routerSocket;
          routerSocket.write('create ' + newCircuitId);
        } else if (cell.substring(0, cell.indexOf(' ')) == 'created') {  // created
          console.log('connection creation successful');
          var circuitId = parseInt(cell.substring(cell.indexOf(' ') + 1));
          if (circuitId === startCircuitId) {  // first connection in circuit, do not send 'extended' cell
            var routerInfo = new RouterInfo(routerSocket, circuitId);
            routerTable.firstRouterInfo = routerInfo;
            routerTable.set(routerInfo, '');
            circuitLength++;
            // since this is the first connection in the circuit, initiate the chain of 'extend' cells
            var nextRouterData = getAvailableRouters()[0].split(' ');  // e.x. '127.0.0.1 1234 1'
            var nextRouterAddress = nextRouterData[0];
            var nextRouterPort = nextRouterData[1];
            var nextRouterId = nextRouterData[2];
            var relayExtendCell = 'extend ' + circuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
            routerSocket.write(relayExtendCell);
          } else {  // not at start router, need to send 'extended' cell back toward start router
            var lastCircuitId = circuitIdMap[circuitId];
            var lastRouterInfo = routerTable.getIncomingRouterInfoFromCircuitId(lastCircuitId);
            var outgoingRouterInfo = new RouterInfo(routerSocket, circuitId);
            routerTable.set(lastRouterInfo, outgoingRouterInfo);
            routerTable.set(outgoingRouterInfo, lastRouterInfo);
            console.log(routerTable.toString());
            lastRouterInfo.routerSocket.write('extended ' + lastRouterInfo.circuitId);
          }
        } else if (cell.substring(0, cell.indexOf(' ')) == 'extended') {  // extended
          var circuitId = parseInt(cell.substring(cell.indexOf(' ') + 1));
          var routerInfo = new RouterInfo(routerSocket, circuitId);
          if (routerTable.get(routerInfo) === '') {  // we are at the first router in the circuit, process the 'extended' cell
            circuitLength++;
            if (circuitLength < 2) {  // circuit not yet complete, send another 'extend' cell
              var nextRouterData = getAvailableRouters()[0].split(' ');
              var nextRouterAddress = nextRouterData[0];
              var nextRouterPort = nextRouterData[1];
              var nextRouterId = nextRouterData[2];
              var relayExtendCell = 'extend ' + circuitId + ' ' + nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId;
              routerSocket.write(relayExtendCell);
            }
          } else {  // we are NOT at the first router, forward the cell towards the first router
            var nextRouterInfo = routerTable.get(routerInfo);
            var nextRouterSocket = nextRouterInfo.routerSocket;
            var nextCircuitId = nextRouterInfo.circuitId;
            cell = cell.substring(cell.indexOf(' ')) + ' ' + nextCircuitId + ' ' + cell.substring(cell.indexOf('127'));
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
var routerTable = new RouterTable();  // incoming (socket, circuitId) -> outgoing (socket, circuitId)
var startCircuitId = undefined;
var circuitIdMap = {};

// ----------------------------

initiateCircuitCreation();
