/* HIGH LEVEL MAP

podClient - use to read/write to any profile data
  has parallel for main ijod functions, .getOne, .getRange, .getTardis, .getBounds, .batchSmartAdd
  these functions must look up the associated profile and find the pod, then do a http serialization of the request/response and return the json just like ijod
  a default "pod" for any non assigned profiles and for account@app or just "app" ids (non-service based profiles)

nexusClient - use to read/write to any app/account information

webservice.js -
  mostly uses entries.runBases
  uses of ijod.* should switch all over to podClient.*
  /id/*
    for bare ids, the _part needs to be compared against the auth'd profiles to determine which pod to talk to for it

authManager.js -
  needs to use podClient to write the self/profile during an auth to make sure it's saved to the pod

entries.js -
  the ijod.getRange/getTardis calls need to use podClient
  .write should just convert to a podClient.batchSmartAdd

push.js - 
  needs to use podClient to talk to the account@app style stored data (in the 'nexus'?) to get routes and save backlogs

friends.js -
  can all switch to podClient.*

friendsPump.js -
  needs to use nexusClient to get matching pids for "peers" query
  it's ijod.* calls are all account@app and device based ones (use podClient to talk to that data in the main/nexus?)

*/

// things from ijod.* as used by entries.js
exports.getRange // use the base, get the pid, lookup the pod, pass the base+options, get the results back and return them
exports.getTardis // same same
exports.getBounds // same same

exports.getOne // this needs to be passed in the list of possible pids when it's a "bare" id, and match the _partition bytes against them to find the pod to ask

// in ijod.* used by webservices.js in a few places to write raw data
exports.batchSmartAdd // similar, pull out pid->pod, POST raw entries back to it to write
