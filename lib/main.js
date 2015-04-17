'use strict';

var blessed = require('blessed');
var fs = require('fs');
var pInfo = require('../package.json');
// var yaml = require('js-yaml');
var _ = require('lodash');
var commands = require('./commands.js');
var jmespath = require('jmespath');

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

function PathLine(engine) {
  this.engine = engine;
  this.screen = engine.screen;
  this.ui = blessed.box({
    parent: this.screen,
    top: this.screen.height - 2,
    height: 1,
    content: this.content(),
    width: '100%',
    style: {
      bg: '#d3d3d3'
    }
  });
}

PathLine.prototype.refresh = function() {
  this.ui.setContent(this.content());
  this.screen.render();
};

PathLine.prototype.content = function() {
  var curr = null;
  if(this.engine.doc) {
    if(this.engine.doc.current) {
      curr = this.engine.doc.current;
      return ('.' + (curr.nested ? curr.nested + '.' : '') +
              curr.index + ' ' + '[' + curr.type + ']');
    }
  }
  return '';
};

PathLine.prototype.goInput = function(prefix, cb, onKeyPress) {
  var _this = this;
  var search = blessed.box({
    parent: this.ui,
    style: {
      bg: '#d3d3d3'
    },
    content: prefix
  });
  var input = blessed.textarea({
    parent: search,
    style: {
      bg: '#d3d3d3'
    },
    left: prefix.length,
    inputOnFocus: true
  });
  var callback = function(val) {
    _this.ui.remove(search);
    cb(val);
  };
  input.focus();
  input.on('keypress', function(name, ch) {
    var val = input.value;
    var out = (ch.full.length > 1 ?
              val.substr(0, val.length - 1) : (val + ch.full));
    if(input.value.length === 0 && ch.full === 'backspace') {
      return callback(null);
    }
    onKeyPress(ch.full, out);
  });
  input.on('submit', function() { callback(input.value); });
  input.key('escape', function() { callback(null); });
  input.key('enter', function() { callback(input.value); });
};

function StatusLine(engine) {
  this.engine = engine;
  this.screen = engine.screen;
  this.ui = blessed.box({
    parent: this.screen,
    top: this.screen.height - 1,
    tags: true,
    width: '100%',
    content: this.content()
  });
}

StatusLine.prototype.show = function(text) {
  this.ui.setContent(text.toString());
  this.screen.render();
};

StatusLine.prototype.showError = function(text) {
  this.show('{red-bg}{white-fg}' + text + '{/white-fg}{/red-bg}');
};

StatusLine.prototype.cmdInput = function(cb) {
  return this.input(':', cb);
};

StatusLine.prototype.searchInput = function(cb) {
  return this.input('/', cb);
};

StatusLine.prototype.refresh = function() {
  this.ui.setContent(this.content());
  this.screen.render();
};

StatusLine.prototype.content = function() {
  var doc = this.engine.doc;
  var output = '';
  if(doc && doc.options && doc.options.filename) {
    output = '"' + doc.options.filename + '"';
    if(doc.options.newFile) {
      output = output + ' [new file]';
    }
  }
  return output;
};

StatusLine.prototype.input = function(prefix, cb) {
  var _this = this;
  var search = blessed.box({
    parent: this.ui,
    content: prefix
  });
  var input = blessed.textarea({
    parent: search,
    inputOnFocus: true,
    left: prefix.length
  });
  var callback = function(val) {
    _this.ui.remove(search);
    _this.ui.remove(input);
    cb(null, val);
  };
  input.focus();
  this.screen.render();
  input.on('submit', function() { callback(input.value); });
  input.on('keypress', function(name, ch) {
    if(input.value.length === 0 && ch.full === 'backspace') {
      return callback(null);
    }
  });
  input.key('escape', function() { callback(''); });
  input.key('enter', function() { callback(input.value); });
};

function Document(engine, data, options) {
  this.engine = engine;
  this.data = data;
  this.options = options;
  this.screen = engine.screen;
  this.ui = null;
  this.position = { top: 1, left: 3 };
  this.current = {
    index: 0,
    type: 'key'
  };
  this.load(data);
}

Document.prototype.getNode = function(config) {
  if(config.nested) {
    return this.data[config.nested][config.index];
  }
  return this.data[config.index];
};

Document.prototype.gotoPreview = function(q) {
  var _this = this;
  var preview = this.content({ gotoPreview: q });
  this.ui.setContent(preview.text);
  _this.screen.render();
  return preview;
};

Document.prototype.select = function(input) {
  var nodes = this.data;
  var config;
  var target;
  var content;
  input = input || {};

  config = {
    index: input.index !== undefined ? input.index : this.current.index,
    type: input.type || this.current.type,
    nested: input.nested
  };
  if(nodes[config.index] === undefined) {
    return false;
  }
  if(typeof nodes[config.index].data === 'object' && config.type === 'value') {
    target = nodes[config.index].children.nodes[0];
    config = {
      index: 0,
      type: 'key',
      nested: config.index
    };
  } else {
    target = this.getNode(config);
  }

  content = this.content(config);
  this.ui.setContent(content.text);
  this.position = content.position;

  this.current = config;
  this.engine.refresh();

  return true;
};

Document.prototype.goParent = function() {
  if(this.current.type === 'value') {
    this.select({
      index: this.current.index,
      nested: this.current.nested,
      type: 'key'
    });
    return true;
  }
  this.select({
    index: this.current.nested,
    type: 'key'
  });
};

Document.prototype.changeElement = function() {
  var _this = this;
  var cur = _.clone(this.current);
  var objChangeEl = function(data, cur, value) {
    var out = {};
    var value = value || '""';
    Object.keys(data).forEach(function(key) {
      if(key === cur.index) {
        if(cur.type === 'key') {
          out[value] = data[key];
          return;
        }
        if(cur.type === 'value') {
          out[key] = value;
          return;
        }
      }
      out[key] = data[key];
    });
    return out;
  }
  if(cur.type === 'key') {
    var origValue = cur.index;
    var lastState = { index: '""', nested: cur.nested, type: cur.type };
  } else {
    var origValue = 'xxx';
    var lastState = cur;
  }
  this.data = objChangeEl(this.data, cur, '""');
  this.insertMode(cur.type, function(val, jumpToValue) {
    if(!val) {
      _this.data = objChangeEl(_this.data, lastState, origValue);
      _this.refresh();
      return;
    }
    _this.data = objChangeEl(_this.data, lastState, val);
    _this.select({
      index: val,
      nested: cur.nested,
      type: cur.type
    });
    if(jumpToValue) {
      _this.goNextValue();
      _this.changeElement();
    }
    _this.refresh();

  }, function(val) { 
    if(lastState.type === 'key') {
      var tval =  val + '" '
      var tkey = tval;
    } else {
      var tval = val + '" ';
      var tkey = lastState.index;
    }
    _this.data = objChangeEl(_this.data, lastState, tval);
    lastState = { index: tkey, nested: lastState.nested, type: lastState.type }; 
    _this.refresh();
  });
};

Document.prototype.insertAfter = function() {
  var _this = this;
  var cur = _.clone(this.current);
  var objAddKeyAfter = function(data, currentKey, value) {
    var out = {};
    var value = value || '""';
    Object.keys(data).forEach(function(key) {
      out[key] = data[key];
      if(key == currentKey) {
        out[value] = '';
      }
    });
    return out;
  }
  this.data = objAddKeyAfter(this.data, cur.index);
  this.select({
    index: '""',
    nested: cur.nested,
    type: 'key'
  });
  this.insertMode('key', function(val){
    if(!val) {
      delete _this.data['""'];
      _this.select(cur);
      return;
    }
    _this.data = objAddKeyAfter(_this.data, cur.index, val);
    delete _this.data['""'];
    _this.select({
      index: val,
      nested: cur.nested,
      type: 'key'
    });
    _this.refresh();
    //_this.engine.echo(cur.index);
  }, function() { });
};

Document.prototype.insertMode = function(mode, cb, onChange) {
  var _this = this;
  var box = blessed.box({
    parent: this.ui,
    style: {
      bg: '#d9d9d9'
    },
    height: 1,
    width: 'shrink',
    left: this.position.left,
    top: this.position.top,
    content: '""'
  });
  var input = blessed.textarea({
    left: 1,
    style: {
      bg: '#d9d9d9'
    },
    parent: box,
    width: 'shrink',
    inputOnFocus: true
  });
  var after = blessed.box({
    parent: box,
    width: 1,
    left: 1,
    content: '"'
  });
  var callback = function(val, secondArg) {
    _this.ui.remove(box);
    _this.ui.remove(input);
    _this.ui.focus();
    cb(val, secondArg);
  };
  input.on('keypress', function(ch) {
    after.left = (input.value.length || 0) + 2;
    if(mode === 'key' && ch == ':') {
      return callback(input.value.trim(':'), true);
    }
    onChange(input.value + ch);
    _this.screen.render();
  });
  var endKeys = ['escape', 'enter'];
  // if(mode === 'key') {
  //  endKeys.push('enter');
  // }
  input.key(endKeys, function() {
    callback(input.value.trim());
  });

  input.focus();
  this.engine.echo('-- INSERT --');
  this.refresh();
};

Document.prototype.goChildren = function() {
  this.select({
    index: this.current.index,
    nested: this.current.nested,
    type: 'value'
  });
};

Document.prototype.goPrevKey = function() {
  var cur = this.current;
  var keys = Object.keys(this.data);
  this.select({
    index: keys[keys.indexOf(cur.index) - 1],
    nested: this.current.nested,
    type: 'key'
  });
};

Document.prototype.goPrevValue = function(current) {
  var cur = current || this.current;
  var keys = Object.keys(this.data);
  this.select({
    index: keys[keys.indexOf(cur.index) - 1],
    nested: this.current.nested,
    type: 'value'
  });
};

Document.prototype.goNextValue = function(current) {
  var cur = current || this.current;
  var keys = Object.keys(this.data);
  var index = this.current.type === 'value' ? 
              keys[keys.indexOf(cur.index) + 1] : this.current.index;
  this.select({
    index: index,
    nested: this.current.nested,
    type: 'value'
  });
};

Document.prototype.goNextKey = function(current) {
  var cur = current || this.current;
  var keys = Object.keys(this.data);
  this.select({
    index: keys[keys.indexOf(cur.index) + 1],
    nested: this.current.nested,
    type: 'key'
  });
};

Document.prototype.refresh = function() {
  var _this = this;
  var content = this.content(this.current);
  this.ui.setContent(content.text);
  this.screen.render();
};

Document.prototype.content = function(selected) {
  var highlight = function(text, isSelect) {
    if(isSelect) {
      text = '{ye!selected}' + text;
    }
    return '{blue-bg}{white-fg}' + text + '{/white-fg}{/blue-bg}';
  };
  var output = {
    previewMatches: [],
    position: {}
  };
  var stringify = function(obj, parent, forceShow) {
    var out = '';
    if(obj.toString() === '[object Object]') {
      Object.keys(obj).forEach(function(key) {
        var okey = _.clone(key);
        var oval = oval;
        var force = forceShow;
        var val;
        var nested;
        var padding;
        var prefix = '';

        if(selected && selected.gotoPreview) {
          if(key.match(new RegExp(selected.gotoPreview))) {
            okey = okey.replace(selected.gotoPreview, function(x) {
              return highlight(x);
            });
            force = true;
            output.previewMatches.push(key);
          } else {
            if(!forceShow)
            {
              //return null;
              prefix = '{ye!nomatch}';
            }
          }
        }
        val = obj[key];
        if(selected && key === selected.index && parent == selected.nested) {
          if(selected.type === 'key') {
            okey = highlight(okey, true);
          }
          if(selected.type === 'value') {
            val = highlight(val, true);
          }
        }
        nested = stringify(val, key, force);
        if(nested && nested.toString().match(/\n/)) {
          padding = _.repeat('  ', parent ? (parent.split('.').length + 1) : 1);
          nested = '\n' + padding + nested.trim().replace(/\n/g, '\n' + padding);
        }
        out = out + prefix + '{bold}' + okey + '{/bold}: ' + nested + '\n';
      });
      return out;
    }
    return obj;
  };

  output.text = stringify(_.clone(this.data));

  // ruler
  output = this.rulerize(output);

  // remove non matched
  output.text = _.remove(output.text.split('\n').map(function(line) {
    if(line.match(/{ye!nomatch}/)) {
      return null;
    }
    return line;
  }), function(i) { return i !== null; }).join('\n');

  // empty lines ~
  output.rows = output.text.split(/\r\n|\r|\n/).length;
  if(output.rows < this.ui.height) {
    var offset = (this.ui.height - output.rows) + 1;
    output.text = output.text + _.repeat('{#87875F-fg}~{/#87875F-fg}\n', offset);
  }

  // cursor position
  var cursorStr = '{ye!selected}';
  var cursorIndex = output.text.indexOf(cursorStr);
  var lastLine;
  var linesBefore;
  if(cursorIndex !== -1) {
    var linesMatch = output.text.substr(0, cursorIndex).match(/\n/g);
    if(linesMatch) {
      var linesBefore = linesMatch.length + 1;
      var lastLineIndex = output.text.substr(0, cursorIndex).lastIndexOf('\n');
      var lastLine = output.text.substr(lastLineIndex, cursorIndex);
      lastLine = lastLine.substr(0, lastLine.indexOf(cursorStr));
    } else {
      var lastLine = output.text.substr(0, cursorIndex);
    }
    lastLine = lastLine.replace(/\{[^\}]+\}/g, '');
    output.position = {
      top: (linesBefore || 1) - 1,
      left: lastLine.length - 1,
    }
    if(output.position.top === 0)
    {
      output.position.left = output.position.left + 1;
    }
    output.text = output.text.replace(cursorStr, '');
    //console.log('                                                      ', position);
  }
  return output;
};
Document.prototype.rulerize = function(content) {
  content.text = content.text.toString();
  var lines = content.text.trim().split('\n');
  var output = '';
  var width = ('' + lines.length).length;
  if(width < 2) {
    width = 2;
  }

  lines.forEach(function(line, i) {
    var lineNo = i + 1;
    var padd = '';
    var size = (lineNo + '').length;
    if(size < width) {
      padd = _.repeat(' ', width - size);
    }
    output = output + '{#d6d6d6-bg}' + padd + '{#87875F-fg}' +
            lineNo + '{/#87875F-fg} {/#d6d6d6-bg}' + line + '\n';
  });

  content.text = output;
  return content;
};

Document.prototype.load = function(data) {
  var _this = this;
  var keyActions;
  var height = this.screen.height - 2;
  var content;

  this.data = data || this.data;

  this.ui = blessed.box({
    parent: this.screen,
    width: '100%',
    left: 0,
    height: height,
    scrollable: true,
    tags: true,
    scrollbar: {
      bg: 'blue'
    }
  });

  this.refresh();

  // select first element
  this.select({ index: Object.keys(this.data)[0] });
  this.screen.render();

  // key bindings
  keyActions = [
    {
      keys: ['h', 'left'],
      handler: function() {
        _this.goParent();
        _this.screen.render();
      }
    },
    {
      keys: ['l', 'right'],
      handler: function() {
        _this.goChildren();
        _this.screen.render();
      }
    },
    {
      keys: ['j', 'down', 'enter'],
      handler: function() {
        _this.goNextKey();
        _this.screen.render();
      }
    },
    {
      keys: ['k', 'up'],
      handler: function() {
        _this.goPrevKey();
        _this.screen.render();
      }
    },
    {
      keys: ['w'],
      handler: function() {
        _this.goNextValue();
        _this.screen.render();
      }
    },
    {
      keys: ['b'],
      handler: function() {
        _this.goPrevValue();
        _this.screen.render();
      }
    },
    {
      keys: ['x'],
      handler: function() {
        var keyToDelete = _.clone(_this.current);
        _this.goNextKey();
        delete _this.data[keyToDelete.index];
        _this.refresh();
      }
    },
    {
      keys: ['/'],
      handler: function() {
        _this.engine.statusLine.searchInput(function() {
          _this.ui.focus();
          _this.engine.statusLine.refresh();
        });
        _this.screen.render();
      }
    },
    {
      keys: ['f'],
      handler: function() {
        var matches = [];
        _this.engine.pathLine.goInput('.', function(res) {
          if(res !== null) {
            var select = { index: matches[0], type: 'key', nested: null };
            _this.select(select);
          } else {
            _this.refresh();
          }
          _this.ui.focus();
          _this.engine.refresh();
        }, function(ch, value) {
          var preview = _this.engine.doc.gotoPreview(value);
          if(preview.previewMatches.length > 0) {
            matches = preview.previewMatches;
          }
        });
        _this.screen.render();
      }
    },
    {
      keys: ['='],
      handler: function() {
        var orig = _.clone(_this.data);
        _this.engine.pathLine.goInput('%=', function(res) {
          if(res === null || res === '') {
            _this.data = orig;
            _this.engine.refresh();
          } else {
            try {
              var result = jmespath.search(orig || {}, _.escape(res));
              if(result){
                _this.data = result;
                _this.select();
              } else {
                _this.engine.echoerr('JMESPath expression not found');
                _this.data = orig;
              }
            } catch(e) {}
          }
          _this.ui.focus();
          _this.refresh();

        }, function(ch, value) {
          //_this.engine.echo(value + JSON.stringify(orig));
          if(value.trim() === "") {
            _this.data = orig;
          } else {
            try {
              var result = jmespath.search(orig, _.escape(value));
              if(result) {
                _this.engine.echo('JMESPath valid: ' + value);
                _this.data = result;
              } else {
                _this.engine.echo('JMESPath not found');
              }

            } catch(e) {
              _this.engine.echoerr('JMESPath error: '+e);
              _this.data = {};
            }
          }
          _this.refresh();
        });
        _this.screen.render();
      }
    },
    {
      keys: ['o'],
      handler: function() {
        _this.insertAfter();
      }
    },
    {
      keys: ['c'],
      handler: function() {
        _this.changeElement();
      }
    }
  ];

  keyActions.forEach(function(ka) {
    _this.ui.key(ka.keys, ka.handler);
  });

  this.ui.focus();

  this.screen.render();
  return this.ui;
};

function Engine() {
  var _this = this;

  this.commands = this.initCommands(commands);
  this.commandsList = Object.keys(this.commands);
  this.screen = blessed.screen({
    // autoPadding: true,
    // smartCSR: true,
  });
  this.screen.key(['escape', 'q', 'C-c'], function() {
    return process.exit(0);
  });
  this.statusLine = new StatusLine(this);
  this.pathLine = new PathLine(this);
  this.screen.key(':', function() {
    _this.statusLine.cmdInput(function(err, res) {
      _this.doc.ui.focus();
      _this.refresh();
      if(res !== null) {
        var splitted = res.trim().split(' ');
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
    this.banner = blessed.box({
      parent: this.screen,
      width: this.screen - 1,
      left: 1,
      top: 1,
      height: this.screen.height - 3,
      align: 'center',
      valign: 'middle',
      tags: true,
      content: banner,
      index: 100
    });
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

