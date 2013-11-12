require('chai').should();

var fakeweb = require('node-fakeweb');
var path = require('path');

var helper  = require(path.join(__dirname, '..', '..', 'support', 'locker-helper.js'));

var self = require(path.join('services', 'linkedin', 'self.js'));
var lib = require(path.join('services', 'linkedin', 'lib.js'));


describe("linkedin connector", function () {
  var pinfo;

  beforeEach(function () {
    fakeweb.allowNetConnect = false;

    pinfo = helper.loadFixture(path.join(__dirname, '..', '..', 'fixtures', 'connectors', 'linkedin.json'));
  });

  afterEach(function () {
    fakeweb.tearDown();
  });

  describe("self synclet", function () {
    beforeEach(function () {
      fakeweb.registerUri({
        uri: 'http://api.linkedin.com:80/v1/people/~:(id,first-name,last-name,email-address,headline,location:(name,country:(code)),industry,current-share,num-connections,summary,specialties,proposal-comments,associations,honors,interests,positions,publications,patents,languages,skills,certifications,educations,num-recommenders,recommendations-received,phone-numbers,im-accounts,twitter-accounts,date-of-birth,main-address,member-url-resources,picture-url,site-standard-profile-request:(url),api-standard-profile-request:(url),site-public-profile-request:(url),api-public-profile-request:(url),public-profile-url)?format=json',
        headers: { "Content-Type": "text/plain" },
        file: __dirname + '/../../fixtures/synclets/linkedin/self.json'
      });
    });

    it('can fetch profile information', function (done) {
      self.sync(pinfo, function (err, response) {
        if (err) return done(err);
        response.data['profile:42@linkedin/self'][0].id.should.equal("42");
        done();
      });
    });
  });

});
