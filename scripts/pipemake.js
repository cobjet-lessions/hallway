var async = require('async');
var path  = require('path');
var _     = require('underscore');

var dal            = require('dal');
var lconfig = require('lconfig');
var logger         = require('logger').logger('pipemake');
var profileManager = require('profileManager');
var idr = require("idr");
var request = require("request");
var serializer = require('serializer').createSecureSerializer(lconfig.authSecrets.crypt, lconfig.authSecrets.sign);

function errorAndQuit(err) {
  logger.error(err);
  process.exit(1);
}

var limit = process.argv[2] || 10;

function sync(dat, callback) {
  var parts = dat.split('@');
  var id = parts[0];
  var service = parts[1];
  var account = parts[2];
  var category;
  if(service == "facebook") category = "photos";
  if(service == "twitter") category = "tweets";
  console.log('Piping', dat);

    var pipe = {"service":service, "category":category, "schedule":31536000, "initial_time_index":1, "include_raw":true};
    pipe.identifier = id+"@"+service;
    pipe.target_url = 'https://quiet-hamlet-4298.herokuapp.com/drain/'+service+'/'+id;
    pipe.auth = {"singly_token":serializer.stringify([account, "b4ac1d88c60fff4223b4997aedcfa063", +new Date(), null])};
    var args = {};
    args.url = "https://5d142cc1287784c0aff6c597d103e0f97eb03334:PASSWORD@v2beta.singly.com/applications/5d142cc1287784c0aff6c597d103e0f97eb03334/pipes";
    args.body = JSON.stringify(pipe);
    args.headers = {"Content-Type":"application/json"};
    request.post(args, function(err, resp, body){
      if(resp.statusCode != 201) logger.warn(resp.statusCode+" "+body);
      callback();
    })


}

function getPids(callback) {
  logger.info('Loading profiles');
  dal.query('SELECT profile, account FROM Accounts where app = "b4ac1d88c60fff4223b4997aedcfa063" and (profile like "%facebook" or profile like "%twitter") limit '+limit, [], callback);
}

function run() {
  getPids(function(err, rows) {
    if (err) errorAndQuit(err);

    logger.info('loading', rows.length, 'profiles');

    var queue = async.queue(sync, 3);

    queue.drain = function(err) {
      logger.info('Done');
      if (err) logger.error(err);
      process.exit(0);
    };

    rows.forEach(function(row) {
      queue.push(row.profile+"@"+row.account);
    });
  });
}

run();
