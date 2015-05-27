var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

// Establish socket listening for HTTP connections
var serverSocket = dgram.createSocket('udp4');
serverSocket.bind(5555);
serverSocket.on('listening', function() {
  var address = serverSocket.address();
  console.log('HTTP server socket listening on ' + address.address + ":" + address.port);
});

// Establish socket listening for Tor61 connections
var torSocket = dgram.createSocket('udp4');
torSocket.bind(1234);
torSocket.on('listening', function() {
  var address = torSocket.address();
  console.log('Tor61 socket listening on ' + address.address + ":" + address.port);
});



