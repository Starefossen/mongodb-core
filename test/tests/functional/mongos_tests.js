var f = require('util').format
  , Long = require('bson').Long;

exports['Should correctly connect using mongos object'] = {
  metadata: {
    requires: {
      topology: "mongos"
    }
  },

  test: function(configuration, test) {
    var Mongos = configuration.require.Mongos;

    // Attempt to connect
    var server = new Mongos([{
        host: configuration.host
      , port: configuration.port
    }, {
        host: configuration.host
      , port: configuration.port + 1
    }])

    // Add event listeners
    server.on('connect', function(_server) {
      setTimeout(function() {
        test.equal(true, _server.isConnected());
        _server.destroy();
        test.equal(false, _server.isConnected());
        test.done();        
      }, 100);
    })

    // Start connection
    server.connect();
  }
}

exports['Should correctly execute command using mongos'] = {
  metadata: {
    requires: {
      topology: "mongos"
    }
  },

  test: function(configuration, test) {
    var Mongos = configuration.require.Mongos
      ReadPreference = configuration.require.ReadPreference;

    // Attempt to connect
    var server = new Mongos([{
        host: configuration.host
      , port: configuration.port
    }]);

    // Add event listeners
    server.on('connect', function(_server) {
      // Execute the command
      _server.command("system.$cmd", {ismaster: true}, {readPreference: new ReadPreference('primary')}, function(err, result) {
        test.equal(null, err);
        test.equal(true, result.result.ismaster);
        // Destroy the connection
        _server.destroy();
        // Finish the test
        test.done();
      });      
    });

    // Start connection
    server.connect();
  }
}

exports['Should correctly execute write using mongos'] = {
  metadata: {
    requires: {
      topology: "mongos"
    }
  },

  test: function(configuration, test) {
    var Mongos = configuration.require.Mongos;

    // Attempt to connect
    var server = new Mongos([{
        host: configuration.host
      , port: configuration.port
    }]);

    // Add event listeners
    server.on('connect', function(_server) {
      // Execute the write
      _server.insert(f("%s.inserts_mongos1", configuration.db), [{a:1}], {
        writeConcern: {w:1}, ordered:true
      }, function(err, results) {
        test.equal(null, err);
        test.equal(1, results.result.n);
        // Destroy the connection
        _server.destroy();
        // Finish the test
        test.done();
      });
    })

    // Start connection
    server.connect();
  }
}

exports['Should correctly remove mongos and re-add it'] = {
  metadata: {
    requires: {
      topology: "mongos"
    }
  },

  test: function(configuration, test) {
    var Mongos = configuration.require.Mongos
      , ReadPreference = configuration.require.ReadPreference;
    // Attempt to connect
    // Attempt to connect
    var server = new Mongos([{
        host: configuration.host
      , port: configuration.port
    }, {
        host: configuration.host
      , port: configuration.port + 1
    }])

    // The state
    var joined = 0;
    var left = 0;

    // Add event listeners
    server.on('connect', function(_server) {
      _server.on('joined', function(t, s) {
        joined = joined + 1;
      });

      _server.on('left', function(t, s) {
        left = left + 1;
      });

      var interval = setInterval(function() {
        // We are done
        if(joined == 2 && left == 2) {
          clearInterval(interval);
          server.destroy();
          return test.done();
        }

        // Execute the write
        _server.insert(f("%s.inserts_mongos2", configuration.db), [{a:1}], {
          writeConcern: {w:1}, ordered:true
        }, function(err, results) {
          test.equal(null, err);
        });
      }, 1000)

      setTimeout(function() {
        // Shutdown the first secondary
        configuration.manager.remove('mongos', {index: 0}, function(err, serverDetails) {
          if(err) console.dir(err);

          setTimeout(function() {
            // Shutdown the second secondary
            configuration.manager.add(serverDetails, function(err, result) {
              // Shutdown the first secondary
              configuration.manager.remove('mongos', {index: 1}, function(err, serverDetails) {
                if(err) console.dir(err);

                setTimeout(function() {
                  // Shutdown the second secondary
                  configuration.manager.add(serverDetails, function(err, result) {});          
                }, 2000)
              });
            });
          }, 2000)
        });
      }, 2000);
    });

    // Start connection
    server.connect();
  }
}