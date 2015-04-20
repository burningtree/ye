'use strict';
var blessed = require('blessed');


function Screen() {
  this.binding = blessed.screen({
    title: 'ye'
    // autoPadding: true,
    // smartCSR: true,
  });
}

Screen.prototype.key = function(keys, fn) {
  this.binding.key(keys, fn);
};

Screen.prototype.render = function() {
  this.binding.render();
};

function PathLine(engine) {
  this.engine = engine;
  this.screen = engine.screen.binding;
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
  var cur = null;
  if(this.engine.doc) {
    if(this.engine.doc.cursor.position) {
      cur = this.engine.doc.cursor.position;
      return ('.' + cur.path() + ' [' + cur.type + ']');
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
  var topOffset;
  var controlWidth = 20;
  this.msgTimeout = 5000;
  this.lastMessage = null;
  this.engine = engine;
  this.screen = engine.screen;
  topOffset = this.screen.binding.height - 1;
  this.ui = blessed.box({
    parent: this.screen.binding,
    top: topOffset,
    tags: true,
    width: this.screen.binding.width - controlWidth
  });
  this.control = blessed.box({
    parent: this.screen.binding,
    top: topOffset,
    tags: true,
    left: this.ui.width,
    width: controlWidth
  });
  this.refresh();
}
StatusLine.prototype.addMessage = function(text, type) {
  this.lastMessage = {
    text: text,
    type: type,
    time: Date.now()
  };
}

StatusLine.prototype.show = function(text) {
  this.addMessage(text);
  this.screen.render();
};

StatusLine.prototype.showError = function(text) {
  this.addMessage(text, 'error');
  this.screen.render();
};

StatusLine.prototype.cmdInput = function(cb) {
  return this.input(':', cb);
};

StatusLine.prototype.searchInput = function(cb) {
  return this.input('/', cb);
};

StatusLine.prototype.refresh = function() {
  var content = this.content();
  this.ui.setContent(content.main);
  this.control.setContent(content.control);
  this.screen.render();
};

StatusLine.prototype.content = function() {
  var lm;
  var msg;
  var toError = function(text) { 
    return '{red-bg}{white-fg}' + text + '{/white-fg}{/red-bg}';
  }
  var doc = this.engine.doc;
  var output = {
    control: '',
    main: ''
  };
  if(this.lastMessage) {
    lm = this.lastMessage;
    if(lm.time > (Date.now() - this.msgTimeout)) {
      output.main = lm.type === 'error' ? toError(lm.text) : lm.text;
    }
  }

  // default
  if(output.main === '') {
    if(doc && doc.options && doc.options.filename) {
      output.main = '"' + doc.options.filename + '"';
      if(doc.options.newFile) {
        output.main = output.main + ' [new file]';
      }
    }
  }
  if(doc && doc.keyQueue.length > 0) {
    output.control = doc.keyQueue.join('');
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

function Window(screen) {
  var height = screen.binding.height - 2;
  this.screen = screen;
  this.preview = null;
  this.binding = blessed.box({
    parent: screen.binding,
    width: '100%',
    left: 0,
    height: height,
    scrollable: true,
    tags: true,
    scrollbar: {
      bg: 'black'
    }
  });
}

Window.prototype.setContent = function(data) {
  this.binding.setContent(data);
};

Window.prototype.key = function(key, fn) {
  this.binding.key(key, fn);
};

Window.prototype.on = function(ev, fn) {
  this.binding.on(ev, fn);
};

Window.prototype.focus = function() {
  this.binding.focus();
};

Window.prototype.showPreview = function(content) {
  content = content || '';
  if(!this.preview) {
    this.preview = blessed.box({
      parent: this.binding,
      tags: true,
      top: 'center',
      left: 'center',
      width: '90%',
      height: 'shrink',
      content: content,
      border: {
        type: 'line',
      }
    });
  } else {
    this.preview.setContent(content);
    this.preview.show();
  }
  return this.preview;
}

Window.prototype.removePreview = function() {
  this.preview.hide();
}

function Position(data) {
  this.index = data.index;
  this.nested = data.nested;
  this.type = data.type || 'key';
}
Position.prototype.mapKey = function() {
  return this.path() + '@' + this.type;
}
Position.prototype.path = function() {
  return this.nested ? [this.nested,this.index].join('.') : this.index;
}

function Cursor(doc) {
  var _this = this;
  this.doc = doc;
  this.position = new Position({
    index: Object.keys(this.doc.data)[0],
    type: 'key'
  });
  this.binding = blessed.box({
    parent: doc.ui.binding,
    height: 'shrink',
    width: 'shrink',
    tags: true,
    content: '',
    style: {
      bg: 'blue',
      fg: 'white'
    }
  });
  this.binding.hide();
}

Cursor.prototype.mapPos = function(pos) {
  return this.doc.map[pos.mapKey()];
}

Cursor.prototype.selectPath = function(path, type) {
  type = type || 'key';
  var splitted = path.split('.').reverse();
  if(splitted.length === 1) {
    return this.select({
      index: splitted[0],
      type: type
    });
  }
  if(splitted.length > 1) {
    return this.select({
      index: splitted.shift(),
      nested: splitted.reverse().join('.'),
      type: type
    });
  }
}

Cursor.prototype.select = function(pos) {
  //this.doc.engine.echo(JSON.stringify(pos));
  //this.doc.engine.refresh();
  if(pos) {
    this.position = new Position(pos);
  }
  var mapPos = this.mapPos(this.position);
  if(!mapPos) {
    return null;
  }
  this.binding.top = mapPos[0];
  this.binding.left = mapPos[1] + 3;
  this.binding.height = mapPos[3];
  this.binding.content = this.doc.getNode(this.position, true);
  this.binding.show();
  this.realPosition = { top: this.binding.top, left: this.binding.left };
  this.doc.engine.refresh();
  this.doc.screen.render();
}

Cursor.prototype.refresh = function() {
  this.select();
}

function Banner(screen, banner) {
  this.screen = screen;
  this.binding = blessed.box({
    parent: screen.binding,
    width: screen.binding - 1,
    left: 1,
    top: 1,
    height: screen.binding.height - 3,
    align: 'center',
    valign: 'middle',
    tags: true,
    content: banner,
    index: 100
  });
}

function InsertMode(doc, mode, position) {
  var _this = this;
  var endKeys = ['escape', 'enter'];

  this.mode = mode;
  this.doc = doc;
  this.engine = doc.engine;
  this.screen = doc.screen;
  this.ui = doc.ui.binding;
  this.position = position;

  this.box = blessed.box({
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
  this.input = blessed.textarea({
    left: 1,
    style: {
      bg: '#d9d9d9'
    },
    parent: this.box,
    width: 'shrink',
    inputOnFocus: true
  });
  this.after = blessed.box({
    parent: this.box,
    width: 1,
    left: 1,
    content: '"'
  });

  this.input.key(endKeys, function() {
    _this.end(_this.input.value.trim());
  });

  this.input.on('keypress', function(ch) {
    _this.after.left = (_this.input.value.length || 0) + 2;
    if(_this.mode === 'key' && ch === ':') {
      return _this.end(_this.input.value.trim(':', '\t'), true);
    }
    if(_this.onInputChange) {
      _this.onInputChange(_this.input.value + ch);
      _this.screen.render();
    }
  });

  this.input.focus();
  this.engine.echo('-- INSERT --');
  this.doc.refresh();
}

InsertMode.prototype.end = function(val, val2) {
  this.ui.remove(this.box);
  this.ui.remove(this.input);
  this.ui.focus();
  if(this.onEnd) {
    this.onEnd(val, val2);
  }
};

module.exports = {
  Screen: Screen,
  Window: Window,
  Cursor: Cursor,
  StatusLine: StatusLine,
  PathLine: PathLine,
  Banner: Banner,
  InsertMode: InsertMode
};
