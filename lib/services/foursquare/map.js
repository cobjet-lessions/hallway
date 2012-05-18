exports.contact = {
  name: function(data) {
      return data.firstName + (data.lastName? ' ' + data.lastName: '');
  },
  gender: 'gender',
  email : 'contact.email',
  phoneNumber : {
      key: 'contact.phone',
      type: 'mobile'
  },
  address: {
      type: 'location',
      key: 'homeCity'
  },
  or: {
      'accounts.twitter.data.screen_name':'contact.twitter',
      'accounts.facebook.data.id':'contact.facebook'
  }
};

exports.checkin = {
  at: function(data) { return data.createdAt * 1000 },
  ll: function(data) {
    var loc = data.venue ? data.venue.location : data.location; // venueless happens
    return (loc && loc.lat && loc.lng) ? [loc.lat, loc.lng] : undefined;
  }
}

exports.photo = {
  at: function(data) { return data.createdAt * 1000 },
  oembed: function(data) {
    var ret = {type:'photo'};
    ret.height = data.sizes.items[0].height;
    ret.width = data.sizes.items[0].width;
    ret.url = data.url;
    return ret;
  }
}

exports.defaults = {
  friends: 'contact',
  recent: 'checkin',
  checkins: 'checkin',
  photos: 'photo',
  badges: 'badge',
  self: 'contact'
}

exports.types = {
  photos: ['photo:foursquare/photos']
}