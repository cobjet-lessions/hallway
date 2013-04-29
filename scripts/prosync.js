var conf = JSON.parse(require('fs').readFileSync(process.argv[2]));

var async = require('async');
var path  = require('path');
var dal = require('dal');
var logger = require("logger").logger('prosync');
var _     = require('underscore');

if(!process.argv[3] || !conf || !conf.from || !conf.to) return errorAndQuit("need config file w/ from and to, and appid");

var redis = require("redis").createClient(6379, conf.to.hostname);

KVfrom = require('kvstore').instance("riak", conf.from);
KVto = require('kvstore').instance("riak", conf.to);
DBfrom = dal.create(conf.from);
DBto = dal.create(conf.to);

function errorAndQuit(err) {
  logger.error(err);
  process.exit(1);
}

var queue = async.queue(sync, 50);

function sync(pid, callback) {
  logger.debug('Syncing', pid, queue.length());
  var parts = pid.split('@');
  var start = Date.now();
  KVfrom.get('profiles', pid, {}, function(err, data) {
    if(err || !data) {
      logger.warn("missing profile for", pid);
      return callback();
    }
    data.config = {};
    KVto.put("profiles", pid, data, function () {
      redis.zadd([parts[1]+"_schedule", 3, parts[0]], function(){
        console.log("EACH",Date.now() - start);
        callback();
      });
    });    
  });
}

function getPids(callback) {
  logger.info('Loading profiles');
  DBfrom.query('SELECT DISTINCT profile From Accounts WHERE app = ?', [process.argv[3]], function(err, rows) {
    return callback(err, _.pluck(rows, 'profile'));
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
