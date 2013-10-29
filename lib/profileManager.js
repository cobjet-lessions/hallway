var dal = require('dal');
var dMap = require('dMap');
var crypto = require('crypto');
var async = require('async');
var logger = require('logger').logger('profileManager');
var lconfig = require('lconfig');
var idr = require("idr");
var path = require("path");
var _ = require('underscore');
_.str = require('underscore.string');

var DEFAULT_AVATARS = [
  /images.instagram.com\/profiles\/anonymousUser.jpg/, // Instagram
  /static-ak\/rsrc.php\/v2\/yL\/r\/HsTZSDw4avx.gif/,   // FB Male
  /static-ak\/rsrc.php\/v2\/yp\/r\/yDnr5YfbJCH.gif/,   // FB Female
  /4sqi\.net\/img\/blank_(boy|girl)/,                  // Foursquare
  /foursquare\.com\/img\/blank_/,                      // Foursquare also
  /twimg.com\/sticky\/default_profile_images/          // Twitter
];

// when merging profile info, which fields win out
var BESTY_FIELDS = {
  "facebook":["thumbnail_url", "name"],
  "twitter":["url", "description"]
};

var backend;
exports.init = function (cbDone) {
  var args = lconfig.s3auth || lconfig.s3;
  if(!args)
  {
    logger.error("s3 backend required");
    process.exit(1);
  }
  var s3_backend = require('./s3');
  backend = new s3_backend.backend(args);
  cbDone();
};

exports.authGetAcct = function(id, app, acct, cbDone) {
  backend.get('auths/'+app+'/'+acct+'_'+id, 0, 0, function (err, buf) {
    var auth;
    try { auth = JSON.parse(buf.toString()); }catch(E){}
    if(auth) return cbDone(null, auth);
    cbDone("failed to find auth");
  });
}

// do magic to store auth per app
exports.authSet = function(id, app, newAuth, cbDone) {
  backend.put('auths/'+app+'/'+newAuth.account+'_'+id, new Buffer(JSON.stringify(newAuth)), function (err) {
    if(err) logger.warn("AUTH BACKUP FAILED", id, app, newAuth);
    cbDone(err);
  });
};

// combine multiple oembeds into one
exports.contactMerge = function(profile, entry, options) {
  options = options || {};
  if (!profile) profile = {services:{}};
  if (!entry) return profile;
  // TODO remove once all email's are map'd into oembed.email
  if (entry.data && entry.data.email) profile.email = entry.data.email;

  var oembed = dMap.get('oembed', entry.data, entry.idr);
  if (!oembed) return profile;
  // convenient to have and keep consistent
  if (!oembed.id) oembed.id = idr.parse(entry.idr).hash;
  oembed.entry = entry.id;

  var service = oembed.provider_name;
  profile.services[service] = oembed;

  // unoembedize
  oembed.name = oembed.title;
  delete oembed.type;
  delete oembed.provider_name;
  delete oembed.title;

  // remove any default thumbnails
  if (oembed.thumbnail_url) DEFAULT_AVATARS.forEach(function(avatar) {
    if (oembed.thumbnail_url && oembed.thumbnail_url.match(avatar)) delete oembed.thumbnail_url;
  });

  Object.keys(oembed).forEach(function(key) {
    // don't copy up some service-specific fields
    if (key === 'id' || key === 'entry') return;
    if (!profile[key] || (BESTY_FIELDS[service] && BESTY_FIELDS[service].indexOf(key) !== -1)) {
      profile[key] = oembed[key]; // copy up unique values
    }
    // don't keep dups around
    if (options.light && profile[key] === oembed[key]) delete oembed[key];
  });

  if (options.full)
  {
    if (!profile.full) profile.full = {};
    profile.full[service] = entry;
  }

  return profile;
};


// shared function for /profile pattern
// options are { app:required, auth:truefalse, fresh:truefalse, full:truefalse }
exports.genProfile = function genProfile(profiles, options, cbDone)
{
  var bases = [];
  var pids = [];
  var cached = [];

  profiles.forEach(function (x) {
    var pid = (typeof x === 'object') ? x.profile : x;
    pids.push(pid);
    var type = dMap.defaults(pid.split('@')[1], 'self') || 'data';
    bases.push(type + ':' + pid + '/self');
  });

  if (bases.length === 0) return cbDone('No data or profile found');

  var ret = {
    id: options.account,
    services: {}
  };

  exports.runBases(bases, options, function (item) {
    exports.contactMerge(ret, item, options);			
  }, function (err) {
    if (err) logger.error('error sending results for services', err);

    if (ret.email) {
      ret.gravatar = 'https://www.gravatar.com/avatar/' +
        crypto.createHash('md5').update(ret.email.toLowerCase()).digest('hex');
    }

    if (!options.auth) return cbDone(null, ret);
    getAuthsFromPIDs(pids, options, function (err, auths) {
      for (var service in auths) {
        if (!ret.services[service]) ret.services[service] = {};
        ret.services[service].auth = auths[service];
      }
      return cbDone(null, ret);
    });
  });
};

// just get profile bases
exports.runBases = function(bases, options, cbEach, cbDone) {
  if(!options.account) return cbDone("missing account");
  async.forEach(bases, function(base, cbBases){
    logger.debug("runBase",base);
    exports.authGetAcct(idr.pid(base), options.app, options.account, function (err, auth) {
      if(err)
      {
        logger.warn("failed to get auth for",base,options.app,options.account,err);
        return cbBases();
      }
      var self;
      try {
        self = require(path.join('services', idr.parse(base).hostname, 'self.js'));
      } catch (E) {
        logger.warn("failed to find self for",base,options.app,options.account,E);
        return cbBases();
      }

      var originalRefreshToken = auth && auth.token && auth.token.refresh_token;
      self.sync({auth: auth, config: {}}, function (err, data) {
        if (err || !data || !data.auth || !data.auth.profile) {
          // TODO this needs to be cleaned up, cached or live inconsistency
          if(auth.profile) {
                var id = dMap.get("id", auth.profile, base);
                var r = idr.parse(base+"#"+id);
                cbEach({warn:"cached copy",idr:idr.toString(r), id:idr.hash(r), data:auth.profile, at:dMap.get('at', auth.profile, base)});
                return cbBases();
          }
          logger.warn("failed to run self for",base,options.app,options.account,err);
          return cbBases();
        }
        var id = dMap.get("id", data.auth.profile, base);
        var r = idr.parse(base+"#"+id);
        cbEach({idr:idr.toString(r), id:idr.hash(r), data:data.auth.profile, at:dMap.get('at', data.auth.profile, base)});
        if (originalRefreshToken && data.auth.token.refresh_token
         && originalRefreshToken != data.auth.token.refresh_token) {
          exports.authSet(id + '@' + r.hostname, options.app, data.auth, cbBases);
        } else {
          cbBases();
        }
      });
    });
  }, cbDone);
}

function getAuthsFromPIDs(pids, options, cbDone) {
  var auths = {};

  async.forEach(pids, function (pid, cbPID) {
    var service = pid.split('@')[1];
    exports.authGetAcct(pid, options.app, options.account, function (err, auth) {
      auths[service] = {};
      if (err) {
        auths[service].error = err;
        return cbPID();
      }
      // add timestamps, might be useful!
      if (auth.accounts && auth.accounts[options.account]) auths[service].at = auth.accounts[options.account];
      // slightly heuristic
      if (auth.token) {
        if (typeof auth.token === 'string') {
          auths[service].token = auth.token;
          if (typeof auth.tokenSecret === 'string') {
            auths[service].token_secret = auth.tokenSecret;
          } else if (typeof auth.token_secret === 'string') {
            auths[service].token_secret = auth.token_secret;
          }
        } else if (auth.token.oauth_token && auth.token.oauth_token_secret) {
          auths[service] = {
            token: auth.token.oauth_token,
            token_secret: auth.token.oauth_token_secret
          };
        } else auths[service] = auth.token;
      }
      else if (auth.accessToken) auths[service].accessToken = auth.accessToken;

      // clear out instagram's user field
      if (auths[service].user) delete auths[service].user;
      cbPID();
    });
  }, function (err) {
    cbDone(err, auths);
  });
}
