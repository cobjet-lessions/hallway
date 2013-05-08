var redisHost = process.argv[2];
var riakHost = process.argv[3];

var async = require('async');
var path  = require('path');
var dal = require('dal');
var logger = require("logger").logger('prosync');
var _     = require('underscore');

if(!process.argv[3]) return errorAndQuit("script redishost riakhost");

var redis = require("redis").createClient(6379, redisHost);

KV = require('kvstore').instance("riak", {"servers":[riakHost]});

function errorAndQuit(err) {
  logger.error(err);
  process.exit(1);
}

var queue = async.queue(sync, 20);

function sync(pid, callback) {
  logger.debug('Syncing', pid, queue.length());
  var parts = pid.split('@');
  redis.zadd([parts[1]+"_schedule", 3, parts[0]], function(){
    redis.zadd([parts[1]+"_last", 10, parts[0]], function(){
      callback();
    });
  });
}

function getPids(callback) {
  redis.keys("*_last", function(err, keys){
    if(!keys) return callback(err);
    logger.info('Loading profiles from', keys);
    var ret = [];
    async.forEach(keys, function(key, cbKeys){
      var service = key.split("_")[0];
      redis.zrangebyscore([key, 0, 1], function(err, ids){
        ids.forEach(function(id){ ret.push([id,service].join("@"))});
        console.log("added",service,ids.length);
        cbKeys();
      });
    }, function(){ callback(null, ret)});
  });
}

queue.drain = function(err) {
  logger.info('Done');
  if (err) logger.error(err);
  process.exit(0);
};

function run() {
  logger.info('Syncing all profiles');
  getPids(function(err, pids) {
    if (err) errorAndQuit(err);

    logger.info('Syncing', pids.length, 'profiles');


    pids.forEach(function(pid) {
      queue.push(pid);
    });
  });
}

redis.select(3, function (err) {
  run();
});
