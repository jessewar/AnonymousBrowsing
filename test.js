var RouterTable = require('./router-table.js');
var RouterInfo = require('./router-info.js');
var net = require('net');

var routerTable = new RouterTable();

// Establish socket listening for Tor61 connections
var torServerSocket = net.createServer();
torServerSocket.listen(1234, function() {
  var address = torServerSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

var prevRouterInfo = undefined;

torServerSocket.on('connection', function(routerSocket) {
  console.log('routerSocket connected');

  routerSocket.on('data', function(message) {
    message = message.toString();
//    console.log(message);
    if (message == 'open') {  // open
      routerSocket.write('opened');
    } else if (message.substring(0, message.indexOf(' ')) == 'create') {  // create
//      console.log(prevSocket === routerSocket);
      prevSocket = routerSocket;
      var circuitId = message.substring(message.indexOf(' ') + 1);
//      console.log(circuitId);
      var routerInfo = new RouterInfo(routerSocket, circuitId);
//      var routerInfo2 = new RouterInfo(routerSocket, 1);
      // var routerInfo2 = [routerSocket, 1];
//      console.log(routerInfo);
  //    console.log(routerInfo2.equals(routerInfo));
//      prevRouterInfo = routerInfo;
      routerTable.set(routerInfo, 'asd');  // this router is now the end of this circuit
      console.log(routerTable);
//      console.log(routerTable.get(routerInfo));
  //    console.log(routerTable);
    } else if (message.substring(0, message.indexOf(' ')) == 'extend') {  // extend
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      var circuitId = message.split(' ')[1];
      var routerInfo = [routerSocket, circuitId];
      if (routerTable.get(routerInfo) === '') {  // we are at the end of the circuit
        var tokens = message.split(' ');  // 'extend', circuitId, address:port, routerId
        var addressAndPort = tokens[2].split(':');  // ['127.0.0.1', '1234']
        var routerAddress = addressAndPort[0];
        var routerPort = parseInt(addressAndPort[1]);
        var routerId = parseInt(tokens[3]);
        var newCircuitId = getNewCircuitId(false);
      } else {
        // console.log('here' + routerInfo[1]);
        // var nextHop = routerTable[routerInfo];
        // var nextRouterSocket = nextHop[0];
        // var nextCircuitId = nextHop[1];
        // //        message = swapCircuitIdRelayCell(message, nextCircuitId);
        // nextRouterSocket.write(message);
      }
    }
  });
});

var routerSocket = net.connect({host: 'localhost', port: 1234});
routerSocket.on('connect', function() {
  routerSocket.write('create 1');
//  routerSocket.write('create 2');
  setTimeout(function() { routerSocket.write('create 1'); }, 0);
});
