'use strict';

var commands = {
  echo: {
    expand: true,
    handler: function(args, engine, callback) {
      engine.echo(args.join(' '));
      callback();
    }
  },
  echoerr: {
    handler: function(args, engine, callback) {
      engine.echoerr(args.join(' '));
      callback();
    }
  },
  exit: {
    expand: true,
    alias: [ 'quit', 'q' ],
    handler: function(args, engine) {
      engine.exit();
    }
  },
  pwd: {
    alias: [ 'cwd' ],
    handler: function(args, engine, callback) {
      engine.echo(process.cwd());
      callback();
    }
  }
};

module.exports = commands;
