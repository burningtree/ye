'use strict';

var _ = require('lodash');
var jmespath = require('jmespath');
var type = require('component-type');
var objectPath = require('object-path');

var commands = {
  cmdInput: {
    handler: function(args, engine, callback) {
      var splitted;
      engine.statusLine.cmdInput(function(doc, res) {
        engine.doc.ui.focus();
        engine.refresh();
        if(res !== null) {
          splitted = res.trim().split(' ');
          engine.exec(splitted.shift(), splitted.join(' '));
        }
        callback();
      });
    }
  },
  echo: {
    expand: true,
    handler: function(args, engine, callback) {
      engine.statusLine.show(args);
      callback();
    }
  },
  echoerr: {
    handler: function(args, engine, callback) {
      engine.statusLine.showError(args);
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
  },
  pos: {
    handler: function(args, engine, callback) {
      engine.echo(JSON.stringify(engine.doc.cursor.realPosition));
      callback();
    }
  },
  goNextKey: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = args || doc.cursor.position;
      var keys = Object.keys(cur.nested ? _.get(doc.data, cur.nested) : doc.data);
      var target = keys[keys.indexOf(cur.index) + doc.numberMove()];
      if(!target) {
        engine.exec('goParent');
        return null;
      }
      doc.select({
        index: target,
        nested: cur.nested,
        type: 'key'
      });
      callback();
    }
  },
  goPrevKey: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = doc.cursor.position;
      var keys = Object.keys(cur.nested ? _.get(doc.data, cur.nested) : doc.data);
      var target = keys[keys.indexOf(cur.index) - doc.numberMove()];
      if(!target) {
        engine.exec('goParent');
        return null;
      }
      doc.select({
        index: target,
        nested: cur.nested,
        type: 'key'
      });
    }
  },
  goPrevValue: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = args || doc.cursor.position;
      var keys = Object.keys(doc.data);
      doc.select({
        index: keys[keys.indexOf(cur.index) - doc.numberMove()],
        nested: cur.nested,
        type: 'value'
      });
    }
  },
  goNextValue: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = args || doc.cursor.position;
      var keys = Object.keys(cur.nested ? _.get(doc.data, cur.nested) : doc.data);
      var move = doc.numberMove();
      var index = cur.type === 'value' ? 
                  keys[keys.indexOf(cur.index) + move] : 
                  (move > 1 ? keys[keys.indexOf(cur.index) + (move-1)]: cur.index);
      doc.select({
        index: index,
        nested: cur.nested,
        type: 'value'
      });
    }
  },
  goChildren: {
    handler: function(args, engine, callback) {
      var cur = engine.doc.cursor.position;
      var node;
      if(cur.type === 'value') {
        node = engine.doc.getNode(cur);
        if(type(node) === 'object' || type(node) === 'array') {
          engine.doc.select({
            index: Object.keys(node)[0],
            nested: cur.nested ? [ cur.nested, cur.index ].join('.') : cur.index,
            type: 'key'
          });
        }
      } else {
        engine.doc.select({
          index: cur.index,
          nested: cur.nested,
          type: 'value'
        });
      }
    }
  },
  goParent: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = doc.cursor.position;
      if(cur.type === 'value') {
        doc.select({
          index: cur.index,
          nested: cur.nested,
          type: 'key'
        });
        return true;
      }
      if(!cur.nested) {
        return null;
      }
      var nesting = cur.nested.split('.').reverse();
      doc.select({
        index: nesting.shift(),
        nested: nesting.length > 0 ? nesting.reverse().join('.') : undefined,
        type: cur.type === 'key' ? 'value' : 'key'
      });
    }
  },
  transform: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var orig = _.clone(doc.data);
      var help = '{bold}{underline}Transform with JMESPath{/underline}{/bold}\n\n{bold}Expression examples:{/bold}\n\n' +
            'property:             foo\n' +
            'sub-expression:       foo.bar.baz\n' +
            'index slices:         [0:4]\n' +
            'flatten operator:     []\n' +
            'or expression:        foo || bar\n' +
            'multi-select list:    [foo,bar]\n' +
            'multi-select hash:    {foo: foo, bar: bar}\n' +
            'wildcard:             *.foo\n' +
            'literals:             `my text`\n' +
            'filters:              myarray[?mycond > `20`]\n' +
            'functions:            to_number(@)\n' +
            'pipe expressions:     myarray | sort(@)\n' +
            '\n\nFor more examples and help visit:\n  {bold}http://jmespath.org/{/bold}\n\nNow type your expression .. ';
      var preview = doc.ui.showPreview(help);
      doc.engine.pathLine.goInput('%=', function(res) {
        doc.ui.removePreview();
        if(res === null || res === '') {
          doc.data = orig;
          doc.engine.refresh();
        } else {
          try {
            var result = jmespath.search(orig, _.escape(res));
            if(result){
              doc.data = result;
              doc.select();
            } else {
              doc.engine.echoerr('JMESPath expression not found');
              doc.data = orig;
            }
          } catch(e) {}
        }
        doc.ui.focus();
        doc.refresh();

      }, function(ch, value) {
        //doc.engine.echo(value + JSON.stringify(orig));
        if(value.trim() === "") {
          preview.setContent(help);
          //doc.data = orig;
        } else {
          try {
            var result = jmespath.search(orig, _.escape(value));
            if(result) {
              doc.engine.echo('JMESPath valid: ' + value);
              //doc.data = result;
              var content = doc.stringify(result, 0);
              preview.setContent('{underline}Output:{/underline}\n'+content.lines.join('\n'));
            } else {
              preview.setContent('JMESPath return empty result');
            }

          } catch(e) {
            preview.setContent('JMESPath error: '+e);
          }
        }
        //doc.refresh();
      });
      doc.screen.render();
    }
  },
  insertAfter: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = _.clone(doc.current);
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
      doc.data = objAddKeyAfter(doc.data, cur.index);
      doc.select({
        index: '""',
        nested: cur.nested,
        type: 'key'
      });
      doc.insertMode('key', function(val){
        if(!val) {
          delete doc.data['""'];
          doc.select(cur);
          return;
        }
        doc.data = objAddKeyAfter(doc.data, cur.index, val);
        delete doc.data['""'];
        doc.select({
          index: val,
          nested: cur.nested,
          type: 'key'
        });
        doc.refresh();
        //doc.engine.echo(cur.index);
      }, function() { });
    }
  },
  changeElement: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = _.clone(doc.current);
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
      doc.data = objChangeEl(doc.data, cur, '""');
      doc.insertMode(cur.type, function(val, jumpToValue) {
        if(!val) {
          doc.data = objChangeEl(doc.data, lastState, origValue);
          doc.refresh();
          return;
        }
        doc.data = objChangeEl(doc.data, lastState, val);
        doc.select({
          index: val,
          nested: cur.nested,
          type: cur.type
        });
        if(jumpToValue) {
          doc.engine.exec('goNextValue');
          doc.changeElement();
        }
        doc.refresh();

      }, function(val) { 
        if(lastState.type === 'key') {
          var tval =  val + '" '
          var tkey = tval;
        } else {
          var tval = val + '" ';
          var tkey = lastState.index;
        }
        doc.data = objChangeEl(doc.data, lastState, tval);
        lastState = { index: tkey, nested: lastState.nested, type: lastState.type }; 
        doc.refresh();
      });
    }
  },
  deleteElement: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var keyToDelete = doc.cursor.position;
      var move = doc.numberMove();
      for(var i=1;i<=move;i++) {
        //_.set(doc.data, keyToDelete.path(), null);
        //engine.echo(doc.data[_.property(keyToDelete.path())]);
        if(keyToDelete.type === 'value') {
          objectPath.set(doc.data, keyToDelete.path(), null);
        } else {
          doc.engine.exec('goNextKey');
          objectPath.del(doc.data, keyToDelete.path());
        }
        keyToDelete = doc.cursor.position;
      }
      doc.refresh();
    }
  },
  search: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      doc.engine.statusLine.searchInput(function() {
        doc.ui.focus();
        doc.engine.statusLine.refresh();
      });
      doc.screen.render();
    }
  },
  gotoKey: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var matches = [];
      var preview = doc.ui.showPreview();
      doc.engine.pathLine.goInput('.', function(res) {
        if(res !== null) {
          doc.cursor.selectPath(matches[0]);
        }
        doc.ui.removePreview();
        doc.ui.focus();
        doc.engine.refresh();
        callback();
      }, function(ch, value) {
        var content = doc.content({ gotoPreview: value, noTilde: true });
        preview.setContent(content.text);
        doc.engine.echo(content.previewMatches.length.toString());
        if(content.previewMatches.length > 0) {
          matches = content.previewMatches;
        }
      });
      doc.screen.render();
    }
  },
  set: {
    alias: [ 's', 'se' ],
    handler: function(args, engine, callback) {
      var args = args.split(" ");
      var key = args.shift();
      var value = args.join(" ");
      if(value === "" || value === undefined) {
        value = true;
      }
      engine.config.editor[key] = engine.tools.yaml.load(value);
      engine.doc.refresh();
      engine.echo('Setting changed: "engine.'+key+'" => '+value);
      callback();
    }
  }
};

module.exports = commands;
