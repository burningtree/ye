'use strict';

var _ = require('lodash');
var UI = require('./ui.js');

function Document(engine, data, options) {
  this.engine = engine;
  this.data = data;
  this.options = options;
  this.screen = engine.screen;
  this.ui = null;
  this.position = { top: 1, left: 3 };
  this.keyQueue = [];
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

Document.prototype.insertMode = function(mode, cb, onChange) {
  var _this = this;
  var insertMode = new UI.InsertMode(this, mode, this.position);
  insertMode.onInputChange = onChange;
  insertMode.onEnd = cb;
};

Document.prototype.numberMove = function() {
  var num = this.keyQueue.length > 0 ? parseInt(this.keyQueue.join('')) : 1;
  this.keyQueue = [];
  this.engine.refresh();
  this.screen.render();
  return num;
}

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
        var padded = false;

        if(selected && selected.gotoPreview) {
          if(key.match(new RegExp(selected.gotoPreview, 'i'))) {
            okey = okey.replace(new RegExp(selected.gotoPreview, 'i'), function(x) {
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
        nested = stringify(val, key, force);
        if(nested && nested.toString().match(/\n/)) {
          padding = _.repeat('  ', parent ? (parent.split('.').length + 1) : 1);
        }
        if(selected && key === selected.index && parent == selected.nested) {
          if(selected.type === 'key') {
            okey = highlight(okey, true);
          }
          if(selected.type === 'value') {
            nested = highlight((padding ? padding : '')+_.trim(nested), true);
            padded = true;
          }
        }
        if(nested && nested.toString().match(/(\n|\s{2})/)) {
          nested = '\n' + (!padded ? padding : '') + _.trim(nested).replace(/\n/g, '\n' + padding);
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
  var content;

  this.data = data || this.data;
  this.ui = new UI.Window(this.screen);
  this.refresh(this.screen);

  // select first element
  this.select({ index: Object.keys(this.data)[0] });
  this.screen.render();

  // key bindings
  keyActions = [
    {
      keys: ['h', 'left'],
      handler: function() {
        _this.engine.exec('goParent');
      }
    },
    {
      keys: ['l', 'right'],
      handler: function() {
        _this.engine.exec('goChildren');
      }
    },
    {
      keys: ['j', 'down', 'enter'],
      handler: function() {
        _this.engine.exec('goNextKey');
      }
    },
    {
      keys: ['k', 'up'],
      handler: function() {
        _this.engine.exec('goPrevKey');
      }
    },
    {
      keys: ['w'],
      handler: function() {
        _this.engine.exec('goNextValue');
      }
    },
    {
      keys: ['b'],
      handler: function() {
        _this.engine.exec('goPrevValue');
      }
    },
    {
      keys: ['x'],
      handler: function() {
        _this.engine.exec('deleteElement');
      }
    },
    {
      keys: ['/'],
      handler: function() {
        _this.engine.exec('search');
      }
    },
    {
      keys: ['f'],
      handler: function() {
        _this.engine.exec('goto');
      }
    },
    {
      keys: ['='],
      handler: function() {
        _this.engine.exec('transform');
      }
    },
    {
      keys: ['o'],
      handler: function() {
        _this.engine.exec('insertAfter');
      }
    },
    {
      keys: ['c'],
      handler: function() {
        _this.engine.exec('changeElement');
      }
    }
  ];

  var keysAssigned = [];
  keyActions.forEach(function(ka) {
    _this.ui.key(ka.keys, ka.handler);
    keysAssigned = keysAssigned.concat(ka.keys);
  });

  _this.ui.on('keypress', function(name, ch) {
    if(name && (name.match(/^[0-9]$/) || !(_.includes(keysAssigned, name)))) {
      if(name.length === 1) {
        _this.keyQueue.push(name);
      }
      _this.engine.refresh();
    }
    return true;
  });

  this.ui.focus();

  this.screen.render();
  return this.ui;
};

module.exports = Document;
