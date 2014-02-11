var lconfig = require("lconfig");
var logger = require('logger').logger('instruments');
var stats = require("statsd-singly");

var host;
var port;
var client;

if (lconfig.statsd) {
  host = lconfig.statsd.host;
  port = lconfig.statsd.port;
  client = new stats.StatsD(host, port, function (err) {
    if (err) logger.warn('Error:', err);
  });
  client.init();
  module.exports = client;
} else {
  // fake it
  var send = { send: function() {} };
  module.exports.increment = function() { return send; };
  module.exports.timing = function() { return send; };
  module.exports.gauge = function() { return send; };
}



