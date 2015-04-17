#!/usr/bin/env node
'use strict';

var program = require('commander');
var ye = require('../lib/main');

var logo = ye.logo.split('\n').map(function(i) {
  return '  ' + i;
}).join('\n').trim();

program
  .version(ye.version)
  .usage('[options] [file ...]')
  .description(logo + '\n\n  ' + ye.packageInfo.description);

(function run(cli) {
  var options = {};
  if(cli.args.length > 0) {
    options.file = cli.args[0];
  }
  ye.start(options);
})(program.parse(process.argv));
