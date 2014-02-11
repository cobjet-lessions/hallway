/*
 *
 * Copyright (C) 2011, Singly, Inc.
 * All rights reserved.
 *
 * Please see the LICENSE file for more information.
 *
 */

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

function setBase() {
  exports.lockerBase = 'http://' + exports.lockerHost +
    (exports.lockerPort != 80 ? (':' + exports.lockerPort) : '');

  exports.externalBase = 'http';

  if (exports.externalSecure === true ||
    (exports.externalPort == 443 &&
      exports.externalSecure !== false)) {
    exports.externalBase += 's';
  }

  exports.externalBase += '://' + exports.externalHost +
    (exports.externalPort != 80 &&
      exports.externalPort != 443 ? ':' + exports.externalPort : '');

  if (exports.externalPath) {
    exports.externalBase += exports.externalPath;
  }
}

// take an env var name of the form
//    first_key_name
// and return
//    firstKeyName
function camelCaseKey(key) {
  var words = key.split('_');
  var camelKey = [words[0].toLowerCase()];
  for (var i = 1; i < words.length; i++) {
    camelKey.push(words[i].charAt(0).toUpperCase());
    camelKey.push(words[i].substring(1).toLowerCase());
  }
  return camelKey.join('');
}

// loop through the env vars and nest values. e.g.
//    first_key__second_key=hello
// will result in
// {
//   "firstKey": {
//     "secondKey":"hello"
//   }
// }
//
// NOTE: does NOT parse integers this way.
function loadFromEnvVars() {
  var values = {};
  // loop over all env vars
  for(var key in process.env) {
    // __ means nested keys, so split by nest-depth
    var keys = key.split('__');

    // current holds a pointer to the current nest level,
    // start with the highest level object
    var current = values;

    // loop inwards
    for (var i = 0; i < keys.length; i++) {
      // get the camel-ized key
      var camel = camelCaseKey(keys[i]);
      var value = process.env[key];
      // if we are at the end of the nested keys, it's time to set the value
      if (i === keys.length -1) current[camel] = value;
      else {
        // create this nest level if it doesn't already exist
        if (!current[camel]) current[camel] = {};
        // iterate inwards
        current = current[camel];
      }
    }
  }

  return values;
}


exports.load = function () {
  if (exports.loaded) {
    return;
  }

  // Allow overriding
  var configDir = process.env.LOCKER_CONFIG || 'Config';

  var configPath = process.env.CONFIG_PATH || path.join(configDir,
    'config.json');
  var defaultsPath = path.join(configDir, 'defaults.json');

  var defaults;

  if (fs.existsSync(defaultsPath)) {
    defaults = JSON.parse(fs.readFileSync(defaultsPath));
  }

  if (!defaults) {
    console.error('Unable to load configuration defaults from', defaultsPath);

    process.exit(1);
  }

  var options;

  if (fs.existsSync(configPath)) {
    options = JSON.parse(fs.readFileSync(configPath));
  }

  var envVars = loadFromEnvVars();

  if (!options) {
    options = {};

    console.warn('Unable to load configuration from %s, using defaults only.',
      configPath);
  }

  options = _.merge(options || {}, envVars);

  // Merge the defaults and options into exports
  exports = _.merge(exports, defaults, options);

  // There's still some magic for lockerPort
  if (exports.lockerPort === 0) {
    exports.lockerPort = 8042 + Math.floor(Math.random() * 100);
  }

  // And some magic for externalPort
  if (options && options.externalPort) {
    exports.externalPort = options.externalPort;
  } else if (options && options.externalSecure) {
    exports.externalPort = 443;
  } else {
    exports.externalPort = exports.lockerPort;
  }

  setBase();

  if (fs.existsSync(path.join(configDir, 'apikeys.json'))) {
    exports.apikeysPath = path.join(configDir, 'apikeys.json');
  }

  exports.loaded = true;
};

exports.load();
