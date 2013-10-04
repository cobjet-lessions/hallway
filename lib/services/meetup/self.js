var request = require('request');
var util = require('util');

exports.sync = function(pi, cb) {
  // Meetup is really finicky so we'll go ahead and refresh a lot more often
  request.post({
    uri: 'https://secure.meetup.com/oauth2/access',
    form: {
      client_id: pi.auth.clientId,
      client_secret: pi.auth.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: pi.auth.token.refresh_token
    },
    json: true
  }, function(err, resp, body) {
    if (err) return cb(err);
    if (resp.statusCode !== 200) return cb("Non 200 status code");
    pi.auth.token.access_token = body.access_token;
    pi.auth.token.refresh_token = body.refresh_token;

    pi.auth.access_token = pi.auth.token.access_token;
    var uri = 'https://api.meetup.com/2/member/self?'+'access_token='+pi.auth.access_token;
    request.get({uri:uri, json:true}, function(err, resp, json){
      if(err || !json || !json.name) return cb(err);
      pi.auth.profile = json;
      pi.auth.pid = json.id+'@meetup';
      var base = 'member:'+pi.auth.pid+'/self';
      var data = {};
      data[base] = [json];
      cb(null, {auth: pi.auth, data: data});
    });
  });

};
