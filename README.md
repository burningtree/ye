```
  ██╗   ██╗███████╗
  ╚██╗ ██╔╝██╔════╝
   ╚████╔╝ █████╗  
    ╚██╔╝  ██╔══╝  
     ██║   ███████╗
     ╚═╝   ╚══════╝
```

# ye

Vi(m)-like JSON/YAML editor

## Introduction
### Installation

```
$ npm install -g ye-editor 
```

### Usage

```
$ ye [options] [file]
```

## Help

### Command-mode

#### Move
Action | Key | Binding
---- | ---- | ----
Next key | <kbd>j</kbd> or <kbd>down</kbd> |
Prev key | <kbd>k</kbd> or <kbd>up</kbd> |
Children | <kbd>l</kbd> or <kbd>right</kbd> |
Parent | <kbd>h</kbd> or <kbd>left</kbd> |
Jump to key | <kbd>g</kbd>`<expr>`<kbd>Enter</kbd> |
Next value | <kbd>w</kbd> |
Prev value | <kbd>b</kbd> |

#### Action
Action | Key | Binding
---- | ---- | ----
Delete current node | <kbd>x</kbd> |
Change current node | <kbd>c</kbd> |
Insert key after | <kbd>o</kbd> |

#### Others
Action | Key | Binding
---- | ---- | ----
Enter command | <kbd>:</kbd>`<command> [arguments]`<kbd>Enter</kbd>
Search | <kbd>/</kbd>`<expr>`<kbd>Enter</kbd> |
Exit | <kbd>q</kbd> or <kbd>Esc</kbd><> |

### Available commands
- `:echo`
- `:echoerr`
- `:exit` or `:quit`
- `:pwd` or `:cwd`

## TODO
- scrolling
- undo/redo
- Buffers
- stdout input
- JSON Schema integration
- Diff
- Transformations
- windows / screen management
- Templates for popular formats (package.json etc.)

## Author
Jan Stránský &lt;<jan.stransky@arnal.cz>&gt;

## Licence
MIT

