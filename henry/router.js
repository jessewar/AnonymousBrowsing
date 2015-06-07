// to do times outs for creat/created etc..

var net = require('net');
var RouterTable = require('./router-table.js');
var RouterInfo = require('./router-info.js');
var StreamInfo = require('./stream-info.js');
var StreamTable = require('./stream-table.js');

// Tor61 router -----------------------------------------------------

// Establish socket listening for Tor61 connections
var torServerSocket = net.createServer();
torServerSocket.listen(1234, function() {
  var address = torServerSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});

torServerSocket.on('connection', function(routerSocket) {
  routerSocket.id = 's' + globalSocketId++;

  routerSocket.on('data', function(cell) {
    var unpack_cell = unpack(cell);
    console.log(routerSocket.id + ': ' + unpack_cell[0] + ' ' + unpack_cell[1]);
    if (unpack_cell[0] == 'open') {  // open
      //routerSocket.write('opened');
      routerSocket.write(openedCell(1,1))
      // TODO: add router to connectedRouters table
    } else if(unpack_cell[0] == 'create') {
      var circuitId = unpack_cell[1];
      var routerInfo = new RouterInfo(routerSocket, circuitId);
      routerTable.set(routerInfo, '');  // this router is now the end of this circuit
      routerSocket.write(createdCell(circuitId))
    } else if (unpack_cell[0] == 'extend'){
      var pre = unpack_cell[3].split(' ');
      var addressAndPort = pre[0].split(':');
      var routerAddress = addressAndPort[0];
      var routerPort = parseInt(addressAndPort[1]);
      var routerId = parseInt(pre[1]);
      // if: last node in circuit, call circuitConnect
      // else: forward the extend cell through the ciruit
      var circuitId = parseInt(unpack_cell[1])
      var routerInfo = new RouterInfo(routerSocket, circuitId);
      if (routerTable.get(routerInfo) === '') {  // we are at the end of the circuit
        var newCircuitId = getNewCircuitId(false);
        circuitIdMap[newCircuitId] = circuitId;
        circuitIdMap[circuitId] = newCircuitId;
        circuitConnect(routerId, routerAddress, routerPort, newCircuitId);
      } else {
        var nextRouterInfo = routerTable.get(routerInfo);
        var nextRouterSocket = nextRouterInfo.routerSocket;
        var nextCircuitId = nextRouterInfo.circuitId;
        //        cell = 'extend ' + nextCircuitId + ' ' + routerAddress + ':' + routerPort + ' ' + routerId;
        nextRouterSocket.write(relayExtendCell(nextCircuitId, 0,routerAddress + ':' + routerPort + ' ' + routerId ));
      }
    } else if (unpack_cell[0] == 'begin'){
      var routerInfo = new RouterInfo(routerSocket, unpack_cell[1])
      var nextRouterInfo = routerTable.get(routerInfo);
      if (nextRouterInfo === ''){  // we are at the end of the circuit
        req = unpack_cell[3].split('\n')[0]
        var beg = req.indexOf('GET') + 11
        var end = req.indexOf('HTTP') - 1
        var add = req.substring(beg, end);

        //new socket to get shit from the web
        var s = require('net').Socket();
        s.connect(80, 'google.com');
        s.on('data', function(d){
          var str = d.toString();
          var i = 0
          while (i < str.length){
            var cell = relayDataCell(unpack_cell[1], unpack_cell[2], str.substring(i, i+498));
            routerInfo.routerSocket.write(cell);
            i += 498;
          }
        });

        s.on('end', function() {
          console.log('END server response');
          s.end();
        });

        //        s.write('GET http://www.google.com/ HTTP/1.1\n\n');
        s.write('GET http://www.google.com/ HTTP/1.0\nHost: www.google.com\nUser-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:31.0) Gecko/20100101 Firefox/31.0\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\nAccept-Language: en-US,en;q=0.5\nAccept-Encoding: gzip, deflate\nConnection: close\nCache-Control: max-age=0\n\n');
      } else {
        var nextRouterSocket = nextRouterInfo.routerSocket
        var nextCircuitId = nextRouterInfo.circuitId

        nextRouterSocket.write(relayBeginCell(nextCircuitId, unpack_cell[2], unpack_cell[3]));
      }
    }
  });
});




// TODO: Contact registration service to get actual list of available routers
// Returns a list of other routers available within the network
function getAvailableRouters() {
  return ['127.0.0.1 1234 1'];
}

// TODO: Randomly generate a new number that is not in use
// Returns a circuit number that is not currently in use. The odd parameter specifies whether it should be an odd or even number.
function getNewCircuitId(odd) {
  //return globalCircuitId++;
  globalCircuitId = globalCircuitId +1
  return globalCircuitId
}

function getNewStreamId(even){
  globalStreamId = globalStreamId + 1
  return globalStreamId

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
    routerSocket.write(createCell(newCircuitId));
  } else {
    var routerSocket = net.connect({host: routerAddress, port: routerPort});
    routerSocket.on('connect', function() {
      routerSocket.write(openCell(1,1));
      routerSocket.id = 's' + globalSocketId++;

      routerSocket.on('data', function(cell) {
        unpack_cell = unpack(cell);
	console.log(routerSocket.id + ': ' + unpack_cell[0] + ' ' + unpack_cell[1]);
        if (unpack_cell[0] == 'opened') {  // OPENED
          connectedRouters[routerId] = routerSocket;
          globalstart = routerId
          var routerInfo = new RouterInfo(routerSocket, newCircuitId);
          routerTable.firstRouterInfo = routerInfo;
          routerSocket.write(createCell(newCircuitId));
        } else if (unpack_cell[0] == 'created'){  // CREATED
          var circuitId = unpack_cell[1];
          var routerInfo = new RouterInfo(routerSocket, circuitId);
          if (routerTable.firstRouterInfo.equals(routerInfo)) {  // first connection in circuit, do not send 'extended' cell
            circuitLength++;
            // since this is the first connection in the circuit, initiate the chain of 'extend' cells
            var nextRouterData = getAvailableRouters()[0].split(' ');  // e.x. '127.0.0.1 1234 1'
            var nextRouterAddress = nextRouterData[0];
            var nextRouterPort = nextRouterData[1];
            var nextRouterId = nextRouterData[2];
            routerSocket.write(relayExtendCell(circuitId, 0, nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId));
          } else {  // not at start router, need to send 'extended' cell back toward start router
            var lastCircuitId = circuitIdMap[circuitId];
            var lastRouterInfo = routerTable.getIncomingRouterInfoFromCircuitId(lastCircuitId);
            var outgoingRouterInfo = new RouterInfo(routerSocket, circuitId);
            routerTable.set(lastRouterInfo, outgoingRouterInfo);
            routerTable.set(outgoingRouterInfo, lastRouterInfo);
            lastRouterInfo.routerSocket.write(relayExtendedCell(lastRouterInfo.circuitId, 0));
          }
        } else if (unpack_cell[0] == 'extended') {  // RELAY EXTENDED
          var circuitId = unpack_cell[1]
          var routerInfo = new RouterInfo(routerSocket, circuitId);
          if (routerTable.firstRouterInfo.equals(routerInfo)) {  // we are at the first router in the circuit, process the 'extended' cell
            circuitLength++;
            if (circuitLength < 3) {  // circuit not yet complete, send another 'extend' cell
              var nextRouterData = getAvailableRouters()[0].split(' ');
              var nextRouterAddress = nextRouterData[0];
              var nextRouterPort = nextRouterData[1];
              var nextRouterId = nextRouterData[2];
              routerSocket.write(relayExtendCell(circuitId, 0, nextRouterAddress + ':' + nextRouterPort + ' ' + nextRouterId));
            }
          } else {  // we are NOT at the first router, forward the cell towards the first router
            var nextRouterInfo = routerTable.get(routerInfo);
            var nextRouterSocket = nextRouterInfo.routerSocket;
            var nextCircuitId = nextRouterInfo.circuitId;
            nextRouterSocket.write(relayExtendedCell(nextCircuitId, 0));
          }
        } else if (unpack_cell[0] == 'data') {  // RELAY DATA
          var circuitId = unpack_cell[1]
          var routerInfo = new RouterInfo(routerSocket, circuitId);
          var streamId = unpack_cell[2];
          if (routerInfo.equals(routerTable.firstRouterInfo)) {  // at first router, process data cell
            var connection = streamMap[streamId];
            console.log(unpack_cell[3]);
	    
	    connection.write(unpack_cell[3]);
          } else {
            var nextRouterInfo = routerTable.get(routerInfo);
            var nextRouterSocket = nextRouterInfo.routerSocket;
            var nextCircuitId = nextRouterInfo.circuitId;

            nextRouterSocket.write(relayDataCell(nextCircuitId, streamId, unpack_cell[3].toString()))
          }
        } else if (unpack_cell[0] == 'end') {  // RELAY END
          var circuitId = unpack_cell[1]
          var routerInfo = new RouterInfo(routerSocket, circuitId);
          var streamId = unpack_cell[2];
          if (routerInfo.equals(routerTable.firstRouterInfo)) {
            var connection = streamMap[streamId];
            console.log("CLOSING CONNECTION");
	    // TODO: close the browser connection
          } else {
            var nextRouterSocket = nextRouterInfo.routerSocket;
            var nextCircuitId = nextRouterInfo.circuitId;

            nextRouterSocket.write(relayEndCell(nextCircuitId, streamId));
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
var streamMap = {};
var circuitIdMap = {};

var globalSocketId = 1;
var globalCircuitId = 0;
var globalStreamId = 1;
var globalstart = 0;

// ----------------------------

initiateCircuitCreation();


// HTTP socket ------------------------------------------------------

// Establish socket listening for HTTP connections
var serverSocket = net.createServer(function(connection){
  connection.id = "browser sock"
  var streamId = getNewStreamId(true)

  // TODO: this only works when the request fits in a single cell
  connection.on('data', function(request){
    var circuitId = routerTable.firstRouterInfo.circuitId;
    request = request.toString();

    //link to first router
    streamMap[streamId] = connection;

    //push request through
    routerTable.firstRouterInfo.routerSocket.write(relayBeginCell(circuitId, streamId, request))
  });

  // TODO: 'end' event should be emitted by us and the socket should be closed here
  connection.on('end', function(){
    console.log('END browser connection');
  });
});

serverSocket.listen(5555, function() {
  var address = serverSocket.address();
  console.log('HTTP server socket listening on ' + address.address + ":" + address.port);
});






// CELL HANDLING -----------------



//cell packing ---
function openCell(opener_id, opened_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(0,0)
  buf.writeInt8(5, 2)
  buf.writeInt16LE(opener_id,3)
  buf.writeInt16LE(opened_id,5)
  return buf
}

function openedCell(opener_id, opened_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(0,0)
  buf.writeInt8(6, 2)
  buf.writeInt16LE(opener_id,3)
  buf.writeInt16LE(opened_id,5)
  return buf
}

function openFailed(opener_id, opened_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(0,0)
  buf.writeInt8(7, 2)
  buf.writeInt16LE(opener_id,3)
  buf.writeInt16LE(opened_id,5)
  return buf
}

function createCell(circ_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(1, 2)
  return buf
}

function createdCell(circ_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(2, 2)
  return buf

}

function createFailCell(circ_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(8, 2)
  return buf

}

function destroyCell(circ_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(4, 2)
  return buf
}

function relayBeginCell(circ_id, stream_id, data){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length
  var len = Buffer.byteLength(data, 'utf8')
  buf.writeInt16LE(len,11)

  //


  buf.writeInt8(1,13)
  buf.write(data, 14, len);
  return buf
}

function relayDataCell(circ_id, stream_id, data){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length
  var len = Buffer.byteLength(data, 'utf8')
  buf.writeInt16LE(len,11)

  //


  buf.writeInt8(2,13)
  buf.write(data, 14, len);
  return buf
}

function relayEndCell(circ_id, stream_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length

  buf.writeInt16LE(0,11)

  //


  buf.writeInt8(3,13)
  return buf
}

function relayConnectedCell(circ_id, stream_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length

  buf.writeInt16LE(0,11)

  //


  buf.writeInt8(4,13)
  return buf
}

function relayExtendCell(circ_id, stream_id, data){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length
  var len = Buffer.byteLength(data, 'utf8')
  buf.writeInt16LE(len,11)

  //


  buf.writeInt8(6,13)
  buf.write(data, 14, len);
  return buf
}

function relayExtendedCell(circ_id, stream_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length
  buf.writeInt16LE(0,11)

  //


  buf.writeInt8(7,13)
  return buf
}

function relayBeginFailedCell(circ_id, stream_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length
  buf.writeInt16LE(0,11)

  //


  buf.writeInt8(11,13)
  return buf
}

function relayExtendFailedCell(circ_id, stream_id){
  var buf = new Buffer(512);
  buf.writeInt16LE(circ_id,0)
  buf.writeInt8(3, 2)
  buf.writeInt16LE(stream_id,3)
  buf.writeInt16LE(0,5)
  buf.writeInt32LE(0,7)

  //get body length
  buf.writeInt16LE(0,11)

  //


  buf.writeInt8(12,13)
  return buf
}


//cell unpacking --
function relayLogic(cell){
  if (cell.readUIntLE(13,1)== 1){
    var len = cell.readUIntLE(11, 2);
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["begin", circ, stream, cell.toString('utf8', 14, len + 14)]

  }
  if (cell.readUIntLE(13,1)== 2){
    var len = cell.readUIntLE(11, 2);
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["data", circ, stream, cell.toString('utf8', 14, len + 14)]

  }
  if (cell.readUIntLE(13,1) == 3){
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["end", circ, stream];
  }
  if (cell.readUIntLE(13,1) == 4){
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["connected", circ, stream];
  }
  if (cell.readUIntLE(13,1) ==  6){
    var len = cell.readUIntLE(11, 2);
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["extend",circ, stream, cell.toString('utf8', 14, len + 14)]
  }
  if (cell.readUIntLE(13,1) == 7){
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["extended", circ, stream];
  }
  if (cell.readUIntLE(13,1) == 11){
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["B FAIL", circ, stream];
  }
  if (cell.readUIntLE(13,1) == 12){
    var circ = cell.readUIntLE(0,2);
    var stream = cell.readUIntLE(3,2);
    return ["E FAIL", circ, stream];
  }
  else{
    return "ERROR"
  }
}
function unpack(cell){
  if (cell.readUIntLE(2,1) == 1){
    //console.log("huh")
    var circ = cell.readUIntLE(0,2);
    return ["create", circ] ;
  }
  if (cell.readUIntLE(2,1) == 2){
    var circ = cell.readUIntLE(0,2);
    return ["created", circ];
  }
  if (cell.readUIntLE(2, 1) == 3){
    return relayLogic(cell);
  }
  if (cell.readUIntLE(2, 1) == 4){
    var circ = cell.readUIntLE(0,2);
    return ["destroy", circ];
  }
  if (cell.readUIntLE(2,1) == 5){
    return ["open", cell.readUInt16LE(3), cell.readUInt16LE(5)];
  }
  if (cell.readUIntLE(2, 1) == 6){
    return ["opened", cell.readUInt16LE(3), cell.readUInt16LE(5)];
  }
  if (cell.readUIntLE(2, 1) == 7){
    return ["open failed", cell.readUInt16LE(3), cell.readUInt16LE(5)];
  }
  if (cell.readUIntLE(2, 1) == 8){
    var circ = cell.readUIntLE(0,2);
    return ["create failed", circ];
  }
  else{
    return "ERROR"
  }
}

function tests(){
  k = openCell(5, 3);
  console.log(unpack(k));
  k = openedCell(7, 3);
  console.log(unpack(k));
  k = openFailed(5, 18);
  console.log(unpack(k));
  k = createCell(1);
  console.log(unpack(k));
  k = createdCell(1);
  console.log(unpack(k));
  k = createFailCell(17);
  console.log(unpack(k));
  k = destroyCell(1);
  console.log(unpack(k));
  k = relayBeginCell(5, 1, "hey there");
  console.log(unpack(k));
  k = relayDataCell(9,7, "okiedoke");
  console.log(unpack(k));
  k = relayExtendCell(3,4, "sup");
  console.log(unpack(k));
  k = relayEndCell(13, 4);
  console.log(unpack(k));
  k = relayConnectedCell(1, 4);
  console.log(unpack(k));
  k = relayExtendedCell(0, 7);
  console.log(unpack(k));
  k = relayBeginFailedCell(9, 5)
  console.log(unpack(k));
  k = relayExtendFailedCell(7,7);
  console.log(unpack(k));

}

//END CELL HANDLING

// ----------------------------

//circuitConnect();
//tests();
