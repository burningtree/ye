'use strict';

var _ = require('lodash');
var jmespath = require('jmespath');

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
  },
  pos: {
    handler: function(args, engine, callback) {
      engine.echo(JSON.stringify(engine.doc.position));
      callback();
    }
  },
  goNextKey: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = args || doc.current;
      var keys = Object.keys(doc.data);
      doc.select({
        index: keys[keys.indexOf(cur.index) + doc.numberMove()],
        nested: doc.current.nested,
        type: 'key'
      });
    }
  },
  goPrevKey: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = doc.current;
      var keys = Object.keys(doc.data);
      doc.select({
        index: keys[keys.indexOf(cur.index) - doc.numberMove()],
        nested: cur.nested,
        type: 'key'
      });
    }
  },
  goPrevValue: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = args || doc.current;
      var keys = Object.keys(doc.data);
      doc.select({
        index: keys[keys.indexOf(cur.index) - doc.numberMove()],
        nested: doc.current.nested,
        type: 'value'
      });
    }
  },
  goNextValue: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var cur = args || doc.current;
      var keys = Object.keys(doc.data);
      var move = doc.numberMove();
      var index = doc.current.type === 'value' ? 
                  keys[keys.indexOf(cur.index) + move] : 
                  (move > 1 ? keys[keys.indexOf(cur.index) + (move-1)]: doc.current.index);
      doc.select({
        index: index,
        nested: doc.current.nested,
        type: 'value'
      });
    }
  },
  goChildren: {
    handler: function(args, engine, callback) {
      engine.doc.select({
        index: engine.doc.current.index,
        nested: engine.doc.current.nested,
        type: 'value'
      });
    }
  },
  goParent: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      if(doc.current.type === 'value') {
        doc.select({
          index: doc.current.index,
          nested: doc.current.nested,
          type: 'key'
        });
        return true;
      }
      doc.select({
        index: doc.current.nested,
        type: 'key'
      });
    }
  },
  transform: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var orig = _.clone(doc.data);
      doc.engine.pathLine.goInput('%=', function(res) {
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
          doc.data = orig;
        } else {
          try {
            var result = jmespath.search(orig, _.escape(value));
            if(result) {
              doc.engine.echo('JMESPath valid: ' + value);
              doc.data = result;
            } else {
              doc.engine.echo('JMESPath not found');
            }

          } catch(e) {
            doc.engine.echoerr('JMESPath error: '+e);
            doc.data = {};
          }
        }
        doc.refresh();
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
      var keyToDelete = _.clone(doc.current);
      var move = doc.numberMove();
      for(var i=1;i<=move;i++) {
        doc.engine.exec('goNextKey');
        delete doc.data[keyToDelete.index];
        keyToDelete = _.clone(doc.current);
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
  goto: {
    handler: function(args, engine, callback) {
      var doc = engine.doc;
      var matches = [];
      doc.engine.pathLine.goInput('.', function(res) {
        if(res !== null) {
          var select = { index: matches[0], type: 'key', nested: null };
          doc.select(select);
        } else {
          doc.refresh();
        }
        doc.ui.focus();
        doc.engine.refresh();
      }, function(ch, value) {
        var preview = doc.engine.doc.gotoPreview(value);
        if(preview.previewMatches.length > 0) {
          matches = preview.previewMatches;
        }
      });
      doc.screen.render();
    }
  }
};

module.exports = commands;
