'use strict';

var _ = require('lodash');
var UI = require('./ui.js');
var type = require('component-type');

function Document(engine, data, options) {
  this.engine = engine;
  this.data = data;
  this.options = options;
  this.screen = engine.screen;
  this.position = { top: 1, left: 3 };
  this.keyQueue = [];
  this.ui = new UI.Window(this.screen);
  this.cursor = new UI.Cursor(this);
  this.map = {};
  this.load(data);
}

Document.prototype.load = function(data) {
  var _this = this;
  var keyActions;
  var content;
  var keysAssigned = [];

  this.data = data || this.data;
  this.refresh();

  // select first element
  //this.select({ index: Object.keys(this.data)[0] });
  this.screen.render();

  // keybindings
  this.engine.config.keys.document.forEach(function(kb) {
    _this.ui.key(kb.keys, function() {
      _this.engine.exec(kb.cmd); 
    });
    keysAssigned = keysAssigned.concat(kb.keys);
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

Document.prototype.getNode = function(pos, stringify) {
  var data;
  if(pos.type === 'key') {
    if(stringify) {
      return '{bold}' + pos.index + '{/bold}';
    }
    return pos.index;
  }
  data = _.get(this.data, pos.path());
  //console.log(data);
  if(stringify) {
    data = this.stringify(data, 0).lines.join('\n');
  }
  return data;
};

/*Document.prototype.gotoPreview = function(q) {
  var _this = this;
  var preview = this.content({ gotoPreview: q });

  this.ui.setContent(preview.text);
  _this.screen.render();
  return preview;
};*/

Document.prototype.select = function(input) {
  return this.cursor.select(input);

  /*var nodes = this.data;
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

  return true;*/
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
  this.map = content.map;
  this.ui.setContent(content.text);
  this.cursor.refresh();
  this.screen.render();
};

Document.prototype.stringify = function(obj, startLine, parent, opts) {
  var _this = this;
  var options = opts || {};
  var highlight = function(text) {
    return '{yellow-bg}{black-fg}' + text + '{/black-fg}{/yellow-bg}';
  };
  var out = [];
  var map = {};
  var previewMatches = [];
  var line = startLine;
  if(type(obj) === 'object' || type(obj) === 'array') {
    
    if(parent) {
      line = line + 1;
    }

    Object.keys(obj).forEach(function(key, i) {
      var nestedLevel = parent && parent.match(/\./) ? parent.match(/\./).length + 1: 1;
      var padding = parent ? _.repeat('  ', nestedLevel) : ''; 
      var okey = key;
      var force = false;
      var valResult;
      var oval;
      var cline = line + i;
      var prefix = '';
      var localOptions = _.clone(options);

      if(options.gotoPreview) {
        if(key.match(new RegExp(options.gotoPreview, 'i'))) {
          okey = okey.replace(new RegExp(options.gotoPreview, 'i'), function(x) {    
            return highlight(x);   
          });
          if(!options.forceShow) {
            previewMatches.push(parent ? [parent, key].join('.') : key);
          }
          localOptions.forceShow = true;
        } else {
          if(!options.forceShow) {
            prefix = '{ye!nomatch}';
          }
        }
      }

      var mapKey = (parent ? parent + '.' : '') + key;
      valResult = _this.stringify(obj[key], cline, mapKey, localOptions);
      oval = valResult.lines.join('\n');
      var header = padding + prefix + '{bold}' + okey + '{/bold}: ';
      if(valResult.nested) {
        line = line + valResult.lines.length;
        map = _.assign(map, valResult.map);
        previewMatches = previewMatches.concat(valResult.previewMatches);
        map[mapKey+'@value'] = [ cline + 1, padding.length + 2, 10, valResult.lines.length ];
        map[mapKey+'@key'] = [ cline, padding.length, padding.length, 1 ];
        out.push(header);
        out = out.concat(oval.split('\n'));
      } else {
        map[mapKey+'@value'] = [ cline, padding.length + (okey.length+2), valResult.length, valResult.lines.length ];
        map[mapKey+'@key'] = [ cline, padding.length, okey.length, 1 ];
        out.push(header + oval);
      }
    });
    return { lines: out, map: map, nested: true, previewMatches: previewMatches };
  }
  else {
  }
  return { lines: [ _this.engine.tools.yaml.dump(obj).trim() ], nested: false, previewMatches: previewMatches };
}

Document.prototype.content = function(opts) {
  var _this = this;
  var options = opts || {};

  var output = {
    previewMatches: [],
    position: {},
    map: {}
  };

  var result = this.stringify(_.clone(this.data), 0, undefined, options);
  output.text = result.lines.join('\n');
  output.map = result.map;
  //output.text = output.text + '\n\n' + JSON.stringify(output.map);

  // ruler
  if(this.engine.config.editor.lines) {
    output = this.rulerize(output);
  }

  if(!output.text.split){ 
    console.log(typeof output.text);process.exit(1);
  }

  // remove non matched
  if(options.gotoPreview) {
    output.previewMatches = result.previewMatches;
    output.text = _.remove(output.text.split('\n').map(function(line) {
      if(line.match(/{ye!nomatch}/)) {
        return null;
      }
      return line;
    }), function(i) { return i !== null; }).join('\n');
  }

  // empty lines ~
  if(!options.noTilde) {
    output.rows = output.text.split(/\r\n|\r|\n/).length;
    if(output.rows < this.ui.binding.height) {
      var offset = (this.ui.binding.height - output.rows) + 1;
      output.text = output.text + _.repeat('{#87875F-fg}~{/#87875F-fg}\n', offset);
    }
  }

  // cursor position
  /*var cursorStr = '{ye!selected}';
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
  }*/
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

module.exports = Document;
