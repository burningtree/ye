'use strict';

var jmespath = require('jmespath');
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
  var insertMode = new UI.InsertMode(this, mode, this.position);
  insertMode.onInputChange = onChange;
  insertMode.onEnd = cb;
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
    index: keys[keys.indexOf(cur.index) - this.numberMove()],
    nested: this.current.nested,
    type: 'key'
  });
};

Document.prototype.goPrevValue = function(current) {
  var cur = current || this.current;
  var keys = Object.keys(this.data);
  this.select({
    index: keys[keys.indexOf(cur.index) - this.numberMove()],
    nested: this.current.nested,
    type: 'value'
  });
};

Document.prototype.numberMove = function() {
  var num = this.keyQueue.length > 0 ? parseInt(this.keyQueue.join('')) : 1;
  this.keyQueue = [];
  this.engine.refresh();
  this.screen.render();
  return num;
}

Document.prototype.goNextValue = function(current) {
  var cur = current || this.current;
  var keys = Object.keys(this.data);
  var move = this.numberMove();
  var index = this.current.type === 'value' ? 
              keys[keys.indexOf(cur.index) + move] : 
              (move > 1 ? keys[keys.indexOf(cur.index) + (move-1)]: this.current.index);
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
    index: keys[keys.indexOf(cur.index) + this.numberMove()],
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
        var move = _this.numberMove();
        for(var i=1;i<=move;i++) {
          _this.goNextKey();
          delete _this.data[keyToDelete.index];
          keyToDelete = _.clone(_this.current);
        }
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
              var result = jmespath.search(orig, _.escape(res));
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
