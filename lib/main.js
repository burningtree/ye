'use strict';

var fs = require('fs');
var pInfo = require('../package.json');
 var yaml = require('js-yaml');

var UI = require('./ui.js');
var Document = require('./document.js');
var commands = require('./commands.js');

var logo = '' +
'██╗   ██╗███████╗\n' +
'╚██╗ ██╔╝██╔════╝\n' +
' ╚████╔╝ █████╗  \n' +
'  ╚██╔╝  ██╔══╝  \n' +
'   ██║   ███████╗\n' +
'   ╚═╝   ╚══════╝';

var banner = '{green-fg}' + logo + '{/green-fg}\n\n' +
'{bold}ye - JSON/YAML Editor{/bold}\n\n' +
'version ' + pInfo.version + '\n' +
'by Jan Stránský\n' +
'ye is open source and freely distributable\n\n' +
'Please support it or contribute on GitHub:\n' +
'{#696969-fg}https://github.com/burningtree/ye{/#696969-fg}\n\n' +
'type  {green-fg}<q>{/green-fg}  or  :q{green-fg}<Enter>{/green-fg}  to exit \n' +
'type  :help{green-fg}<Enter>{/green-fg}        for help\n' +
'\n\n' +
'{#696969-fg}Made in ♥ Prague{/#696969-fg}' +
'\n';

function Engine() {
  var _this = this;
  var splitted;
  var keys;

  this.keyConfig = yaml.load(fs.readFileSync('config/keys.yml'));
  this.commands = this.initCommands(commands);
  this.commandsList = Object.keys(this.commands);

  this.screen = new UI.Screen();
  this.keyConfig.engine.forEach(function(kb) {
    _this.screen.key(kb.keys, function() {
      _this.exec(kb.cmd);
    });
  });

  this.statusLine = new UI.StatusLine(this);
  this.pathLine = new UI.PathLine(this);
  this.screen.key(':', function() {
    _this.statusLine.cmdInput(function(doc, res) {
      _this.doc.ui.focus();
      _this.refresh();
      if(res !== null) {
        splitted = res.trim().split(' ');
        _this.exec(splitted.shift(), splitted);
      }
    });
  });
  this.screen.render();
}

Engine.prototype.echo = function(text) {
  this.statusLine.show(text);
};

Engine.prototype.echoerr = function(text) {
  this.statusLine.showError(text);
};

Engine.prototype.initCommands = function(data) {
  return data;
};

Engine.prototype.exec = function(cmd, args) {
  var picked = [];
  var cmds = this.commands;
  this.commandsList.forEach(function(c) {
    var cc = cmds[c];
    if(cmd === c) {
      return picked.push(c);
    }
    if(cc.alias && cc.alias.indexOf(cmd) !== -1) {
      return picked.push(c);
    }
    if(cc.expand && cmd.match(new RegExp('^' + c))) {
      return picked.push(c);
    }
  });
  if(picked.indexOf(cmd) !== -1) {
    picked = [picked[picked.indexOf(cmd)]];
  }
  if(picked.length === 0) {
    this.echoerr('Command not found: ' + cmd);
    return null;
  }
  if(picked.length > 1) {
    this.echoerr('This command is ambivalent: ' + cmd + ' [' + picked + ']');
    return null;
  }
  this.commands[picked[0]].handler(args, this, function() {
    // done
  });
};

Engine.prototype.refresh = function() {
  this.statusLine.refresh();
  this.pathLine.refresh();
};

Engine.prototype.start = function() {
  this.refresh();

  if(this.doc.options.newFile) {
    this.banner = new UI.Banner(this.screen, banner);
    this.screen.render();
  }
};

Engine.prototype.exit = function() {
  process.exit(1);
};

Engine.prototype.create = function(fn) {
  this.doc = new Document(this, {}, { filename: fn, newFile: true });
  this.start();
};

Engine.prototype.load = function(fn) {
  var json;
  if(!fs.existsSync(fn)) {
    this.create(fn);
    return true;
  }
  json = JSON.parse(fs.readFileSync(fn));
  this.doc = new Document(this, json, { filename: fn });
  this.start();
  return true;
};

module.exports = {
  logo: logo,
  version: pInfo.version,
  packageInfo: pInfo,
  start: function(config) {
    var engine = new Engine();
    if(config.file) {
      engine.load(config.file);
    } else {
      engine.create();
    }
    return engine;
  }
};

