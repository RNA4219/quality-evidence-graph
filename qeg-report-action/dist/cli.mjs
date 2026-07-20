#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash2 = {};
      for (const item of arr)
        hash2[item] = true;
      return hash2;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self } = it;
      const { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve10.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve10(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(input[i])) {
          output += input[i];
        } else {
          output += escape(input[i]);
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString2(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve10(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative7, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative7 = parse(serialize(relative7, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative7.scheme) {
        target.scheme = relative7.scheme;
        target.userinfo = relative7.userinfo;
        target.host = relative7.host;
        target.port = relative7.port;
        target.path = removeDotSegments(relative7.path || "");
        target.query = relative7.query;
      } else {
        if (relative7.userinfo !== void 0 || relative7.host !== void 0 || relative7.port !== void 0) {
          target.userinfo = relative7.userinfo;
          target.host = relative7.host;
          target.port = relative7.port;
          target.path = removeDotSegments(relative7.path || "");
          target.query = relative7.query;
        } else {
          if (!relative7.path) {
            target.path = base.path;
            if (relative7.query !== void 0) {
              target.query = relative7.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative7.path[0] === "/") {
              target.path = removeDotSegments(relative7.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative7.path;
              } else if (!base.path) {
                target.path = relative7.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative7.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative7.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative7.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escapePreservingEscapes(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = new URL("http://" + parsed.host).hostname;
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.fragment) {
            try {
              parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
            } catch {
              parsed.error = parsed.error || "URI malformed";
            }
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString2(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri === "string") {
        const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri === "object") {
        return serialize(uri, opts);
      }
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve10,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema, self } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self.opts;
      const sch = new compile_1.SchemaEnv({ schema, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv, sch) {
        return $data ? ajv.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20202 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20202;
    module.exports = exports = Ajv20202;
    module.exports.Ajv2020 = Ajv20202;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20202;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// src/cli.ts
import { exit as exit15 } from "process";

// src/cli/commands.ts
import { exit as exit14 } from "process";

// src/gate/context.ts
function isRiskNode(node) {
  return node.kind === "risk";
}
function isChangedCodeNode(node) {
  return node.kind === "changed_code";
}
function isTestPlacementNode(node) {
  return node.kind === "test_placement";
}
function buildBlockers(riskNodes2) {
  const blockers2 = [];
  for (const risk of riskNodes2) {
    if ((risk.severity === "critical" || risk.severity === "high") && risk.evidenceGap > 0.5) {
      blockers2.push({
        id: `blocker-${risk.id}`,
        message: `High/critical risk "${risk.title}" with evidence gap`,
        riskIds: [risk.id],
        sourceRefs: risk.traceability.sourceRefs
      });
    }
  }
  return blockers2;
}
function createGateEvaluationContext(input, validWaivers) {
  const riskNodes2 = input.graph.nodes.filter(isRiskNode);
  const changedCodeNodes2 = input.graph.nodes.filter(isChangedCodeNode);
  const testPlacementNodes2 = input.graph.nodes.filter(isTestPlacementNode);
  const waiverRiskIds = new Set(validWaivers.flatMap((waiver) => waiver.linkedRiskIds));
  return {
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers: input.waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
    evidenceVerification: input.evidenceVerification,
    preflightDisqualifications: input.preflightDisqualifications ?? [],
    validWaivers,
    riskNodes: riskNodes2,
    changedCodeNodes: changedCodeNodes2,
    testPlacementNodes: testPlacementNodes2,
    waiverRiskIds,
    blockers: buildBlockers(riskNodes2)
  };
}
function getEvidencePackageText(input) {
  if (!input.evidencePackage) {
    return "";
  }
  input.evidencePackageText ??= JSON.stringify(input.evidencePackage);
  return input.evidencePackageText;
}

// src/gate/verdict/blockers.ts
function computeBlockers(graph, validWaivers) {
  void validWaivers;
  const riskNodes2 = graph.nodes.filter((node) => node.kind === "risk");
  return buildBlockers(riskNodes2);
}

// src/gate/verdict/human-review.ts
function computeRequiredHumanReview(graph, validWaivers, residualRisks) {
  const required = [];
  for (const waiver of validWaivers) {
    required.push(waiver.id);
  }
  for (const riskId of residualRisks) {
    required.push(riskId);
  }
  for (const node of graph.nodes) {
    if (isLowConfidenceRisk(node)) {
      required.push(node.id);
    }
  }
  return required;
}
function isLowConfidenceRisk(node) {
  return node.kind === "risk" && node.traceability.confidence === "low";
}

// src/gate/verdict/reasons.ts
function buildReasons(verdict, disqualifications, blockers2, residualRisks, requiredHumanReview, validWaivers) {
  const reasons = [];
  appendDisqualifications(reasons, disqualifications);
  appendBlockers(reasons, blockers2);
  if (validWaivers.length > 0) {
    reasons.push(`Valid waivers: ${validWaivers.length} (conditional_go required)`);
  }
  if (residualRisks.length > 0) {
    reasons.push(`Residual risks: ${residualRisks.length}`);
  }
  if (requiredHumanReview.length > 0) {
    reasons.push(`Required human review: ${requiredHumanReview.length}`);
  }
  if (verdict === "go") {
    reasons.push("All gate conditions satisfied");
  }
  return reasons;
}
function appendDisqualifications(reasons, disqualifications) {
  if (disqualifications.length === 0) return;
  reasons.push(`Disqualified: ${disqualifications.length} DQ code(s)`);
  for (const dq2 of disqualifications) {
    reasons.push(`- ${dq2.code}: ${dq2.message}`);
  }
}
function appendBlockers(reasons, blockers2) {
  if (blockers2.length === 0) return;
  const effectiveCount = blockers2.filter((blocker) => blocker.effective !== false).length;
  reasons.push(effectiveCount === blockers2.length ? `No-go blockers: ${blockers2.length}` : `Blockers: ${blockers2.length} (${effectiveCount} effective, ${blockers2.length - effectiveCount} waived)`);
  for (const blocker of blockers2) {
    reasons.push(`- ${blocker.message}${blocker.effective === false ? " (waived)" : ""}`);
  }
}

// src/gate/verdict/residual-risks.ts
function computeResidualRisks(context) {
  const residualRisks = [];
  for (const risk of context.riskNodes) {
    if (context.waiverRiskIds.has(risk.id)) {
      residualRisks.push(risk.id);
      continue;
    }
    if (risk.severity !== "critical" && risk.severity !== "high" && risk.evidenceGap <= 0.5) {
      residualRisks.push(risk.id);
    }
  }
  return residualRisks;
}

// src/gate/verdict.ts
function computeVerdict(disqualifications, blockers2, residualRisks, requiredHumanReview, validWaivers) {
  if (disqualifications.length > 0) {
    return "disqualified";
  }
  if (blockers2.some((blocker) => blocker.effective !== false)) {
    return "no_go";
  }
  if (validWaivers.length > 0 || residualRisks.length > 0 || requiredHumanReview.length > 0) {
    return "conditional_go";
  }
  return "go";
}
function getExitCode(verdict, policy) {
  return policy.exitCodePolicy[verdict];
}

// src/gate/dq/basic.ts
function riskNodes(input) {
  return input.riskNodes ?? input.graph.nodes.filter((node) => node.kind === "risk");
}
function changedCodeNodes(input) {
  return input.changedCodeNodes ?? input.graph.nodes.filter(
    (node) => node.kind === "changed_code"
  );
}
function blockers(input) {
  return input.blockers ?? computeBlockers(input.graph, input.validWaivers);
}
function detectDQ01(input) {
  const parserDqs = input.graph.completeness.parserFailures.map((failure) => ({
    code: "DQ-01",
    message: `Parser failure: ${failure.reason}`,
    nodeIds: [],
    sourceRefs: failure.sourceRefs
  }));
  return [...input.preflightDisqualifications.filter((dq2) => dq2.code === "DQ-01"), ...parserDqs];
}
function detectDQ02(input) {
  return blockers(input).filter((blocker) => blocker.sourceRefs.length === 0).map((blocker) => ({
    code: "DQ-02",
    message: `Blocker "${blocker.message}" has no sourceRefs`,
    nodeIds: blocker.riskIds,
    sourceRefs: []
  }));
}
function detectDQ03(input) {
  return input.graph.completeness.unsupportedClaims.filter((claim) => claim.gateRelevant).map((claim) => ({
    code: "DQ-03",
    message: `Unsupported claim: ${claim.claim}`,
    nodeIds: claim.nodeIds,
    sourceRefs: []
  }));
}
function detectDQ04(input) {
  const disqualifications = [];
  for (const risk of riskNodes(input)) {
    if ((risk.priority === "P0" || risk.priority === "P1") && risk.evidenceGap > 0.5) {
      const hasWaiver = input.validWaivers.some((waiver) => waiver.linkedRiskIds.includes(risk.id));
      const hasReviewerNote = input.evidencePackage?.manualEvidence.some(
        (manual) => manual.traceTo.includes(risk.id) && manual.reviewerNote
      );
      if (!hasWaiver && !hasReviewerNote) {
        disqualifications.push({
          code: "DQ-04",
          message: `P0/P1 risk "${risk.title}" with oracle gap treated as fact`,
          nodeIds: [risk.id],
          sourceRefs: risk.traceability.sourceRefs
        });
      }
    }
  }
  return disqualifications;
}
function detectDQ05(input) {
  const disqualifications = [];
  for (const changedCode of changedCodeNodes(input)) {
    if (input.placementPlan) {
      const hasTestPlacement = input.placementPlan.placements.some(
        (placement) => placement.disposition !== "blocked"
      );
      const hasAcceptedWaiver = input.waivers.some((waiver) => waiver.valid);
      if (!hasTestPlacement && !hasAcceptedWaiver) {
        disqualifications.push({
          code: "DQ-05",
          message: `Changed code "${changedCode.path}" without test obligation or waiver`,
          nodeIds: [changedCode.id],
          sourceRefs: changedCode.traceability.sourceRefs
        });
      }
    } else {
      disqualifications.push({
        code: "DQ-05",
        message: `Changed code "${changedCode.path}" without test obligation or waiver`,
        nodeIds: [changedCode.id],
        sourceRefs: changedCode.traceability.sourceRefs
      });
    }
  }
  return disqualifications;
}
function detectDQ06(input) {
  return input.preflightDisqualifications.filter((dq2) => dq2.code === "DQ-06");
}
function detectDQ07(input) {
  if (input.graph.completeness.partial && !input.graph.completeness.score) {
    return {
      code: "DQ-07",
      message: "Partial graph without explicit completeness score",
      nodeIds: [],
      sourceRefs: []
    };
  }
  return null;
}

// src/gate/dq/source-refs.ts
var SR_DQ_15_POLICY = {
  id: "SR-DQ-15-POLICY",
  path: "docs/spec/gate-policy.md",
  startLine: 1,
  endLine: 10,
  label: "policyHash must match"
};
var SR_DQ_15_APPROVAL = {
  id: "SR-DQ-15-APPROVAL",
  path: "docs/spec/evidence-package.md",
  startLine: 1,
  endLine: 10,
  label: "approval evidence required for release_decision"
};
var SR_DQ_15_APPROVAL_POLICYID = {
  id: "SR-DQ-15-APPROVAL-POLICYID",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence policyId must match GatePolicy"
};
var SR_DQ_15_APPROVAL_POLICYHASH = {
  id: "SR-DQ-15-APPROVAL-POLICYHASH",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence policyHash must match GatePolicy"
};
var SR_DQ_15_APPROVAL_PKGHASH = {
  id: "SR-DQ-15-APPROVAL-PKGHASH",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence evidencePackageHash must match EvidencePackage"
};
var SR_DQ_15_APPROVAL_SOURCE = {
  id: "SR-DQ-15-APPROVAL-SOURCE",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence must have non-empty sourceRefs"
};
var SR_DQ_17 = {
  id: "SR-DQ-17",
  path: "docs/spec/waiver-approval.md",
  startLine: 69,
  endLine: 79,
  label: "ControlRoles required for IPO controlled"
};
var SR_DQ_16 = {
  id: "SR-DQ-16",
  path: "docs/spec/retention-immutability.md",
  startLine: 1,
  endLine: 10,
  label: "storage classification must be immutable/versioned"
};
var SR_DQ_09 = {
  id: "SR-DQ-09",
  path: "docs/spec/retention-immutability.md",
  startLine: 63,
  endLine: 65,
  label: "sensitive value redaction requirement"
};
var SR_DQ_11 = {
  id: "SR-DQ-11",
  path: "docs/spec/gate-policy.md",
  startLine: 65,
  endLine: 66,
  label: "required connector contract violation"
};

// src/gate/dq/evidence.ts
function detectDQ08(input) {
  if (!input.evidencePackage) return [];
  const disqualifications = [];
  for (const manual of input.evidencePackage.manualEvidence) {
    if (!manual.expectedResult || manual.oracleRefs.length === 0 || manual.traceTo.length === 0 || manual.evidenceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-08",
        message: `Manual evidence "${manual.executedCaseId}" incomplete`,
        nodeIds: [manual.executedCaseId],
        sourceRefs: []
      });
    }
  }
  return disqualifications;
}
var SENSITIVE_VALUE_PATTERNS = [
  /password\s*=\s*["'][^"']+["']/i,
  /api[_-]?key\s*=\s*["'][^"']+["']/i,
  /token\s*=\s*["'][^"']+["']/i,
  /secret\s*=\s*["'][^"']+["']/i,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
];
function detectDQ09(input) {
  if (!input.evidencePackage) return null;
  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(getEvidencePackageText(input)))) {
    return {
      code: "DQ-09",
      message: "Unredacted sensitive value detected in evidence package",
      nodeIds: [],
      sourceRefs: [SR_DQ_09]
    };
  }
  return null;
}
function detectDQ10(input) {
  if (input.metadata.benchmarkMode && input.metadata.hiddenOracleAccessed) {
    return {
      code: "DQ-10",
      message: "Candidate accessed hidden oracle in benchmark mode",
      nodeIds: [],
      sourceRefs: []
    };
  }
  return null;
}
function detectDQ11(input) {
  if (!input.metadata.requiredConnectorStatus) return [];
  const disqualifications = [];
  for (const [adapter, status] of Object.entries(input.metadata.requiredConnectorStatus)) {
    if (status === "contract_violation") {
      disqualifications.push({
        code: "DQ-11",
        message: `Required connector "${adapter}" contract violation treated as success`,
        nodeIds: [],
        sourceRefs: [SR_DQ_11]
      });
    }
  }
  return disqualifications;
}
function sourceRefsForProducerCheck(check) {
  return check.sourceRefs ?? [];
}
function producerConclusionMatchesReadiness(readinessStatus, conclusion) {
  switch (readinessStatus) {
    case "passed":
    case "passed_with_risk":
      return conclusion === "success";
    case "needs_review":
      return conclusion === "neutral" || conclusion === "action_required";
    case "blocked_input":
    case "failed":
      return conclusion === "failure" || conclusion === "action_required";
    case void 0:
    case "unknown":
      return true;
    default:
      return true;
  }
}
function detectDQ12(input) {
  const disqualifications = [];
  if (input.metadata.headRef) {
    for (const artifact of input.metadata.inputArtifacts) {
      if (artifact.revision && artifact.revision !== input.metadata.headRef) {
        disqualifications.push({
          code: "DQ-12",
          message: `Artifact revision "${artifact.revision}" mismatch with headRef "${input.metadata.headRef}"`,
          nodeIds: [artifact.id],
          sourceRefs: []
        });
      }
    }
    for (const check of input.metadata.producerChecks ?? []) {
      if (check.headSha && check.headSha !== input.metadata.headRef) {
        disqualifications.push({
          code: "DQ-12",
          message: `Producer check "${check.name}" headSha "${check.headSha}" mismatch with headRef "${input.metadata.headRef}"`,
          nodeIds: [check.id],
          sourceRefs: sourceRefsForProducerCheck(check)
        });
      }
    }
  }
  for (const check of input.metadata.producerChecks ?? []) {
    if (!producerConclusionMatchesReadiness(check.readinessStatus, check.conclusion)) {
      disqualifications.push({
        code: "DQ-12",
        message: `Producer check "${check.name}" conclusion "${check.conclusion}" contradicts readiness status "${check.readinessStatus}"`,
        nodeIds: [check.id],
        sourceRefs: sourceRefsForProducerCheck(check)
      });
    }
  }
  return disqualifications;
}
function detectDQ13(input) {
  if (input.evidencePackage && input.evidencePackage.sourceRefs.length === 0) {
    return {
      code: "DQ-13",
      message: "Evidence package sourceRefs is empty",
      nodeIds: [],
      sourceRefs: []
    };
  }
  return null;
}

// src/gate/dq/helpers.ts
function checkWaiverSourceBacked(waivers) {
  return waivers.filter((w) => !w.valid && (!w.sourceRefs || w.sourceRefs.length === 0)).map((w) => ({
    code: "DQ-15",
    message: `Waiver "${w.id}" is not source-backed`,
    nodeIds: [w.id],
    sourceRefs: []
  }));
}
function checkPolicyHashMismatch(input) {
  if (input.evidencePackage && input.evidencePackage.gatePolicy.policyHash !== input.policy.policyHash) {
    return {
      code: "DQ-15",
      message: "Gate policy hash mismatch - policy integrity violated",
      nodeIds: [],
      sourceRefs: [SR_DQ_15_POLICY]
    };
  }
  return null;
}
function checkApprovalRequired(input) {
  if (input.evidencePackage?.phase === "release_decision" && input.evidencePackage.approvalEvidence.length === 0) {
    return {
      code: "DQ-15",
      message: "Approval evidence missing in release_decision phase",
      nodeIds: [],
      sourceRefs: [SR_DQ_15_APPROVAL]
    };
  }
  return null;
}
function checkApprovalEvidenceHashes(input) {
  if (!input.evidencePackage) return [];
  const disqualifications = [];
  for (const approval of input.evidencePackage.approvalEvidence) {
    if (approval.policyId !== input.policy.policyId) {
      disqualifications.push({
        code: "DQ-15",
        message: `ApprovalEvidence "${approval.id}" policyId mismatch - expected "${input.policy.policyId}", got "${approval.policyId}"`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_POLICYID]
      });
    }
    if (approval.policyHash !== input.policy.policyHash) {
      disqualifications.push({
        code: "DQ-15",
        message: `ApprovalEvidence "${approval.id}" policyHash mismatch - expected "${input.policy.policyHash}", got "${approval.policyHash}"`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_POLICYHASH]
      });
    }
    if (input.evidencePackage.evidencePackageHash && approval.evidencePackageHash !== input.evidencePackage.evidencePackageHash) {
      disqualifications.push({
        code: "DQ-15",
        message: `ApprovalEvidence "${approval.id}" evidencePackageHash mismatch - expected "${input.evidencePackage.evidencePackageHash}", got "${approval.evidencePackageHash}"`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_PKGHASH]
      });
    }
    if (!approval.sourceRefs || approval.sourceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-15",
        message: `ApprovalEvidence "${approval.id}" has no sourceRefs`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_SOURCE]
      });
    }
  }
  return disqualifications;
}

// src/gate/dq/ipo.ts
function detectDQ15(input) {
  return [
    ...checkWaiverSourceBacked(input.waivers),
    checkPolicyHashMismatch(input),
    checkApprovalRequired(input),
    ...checkApprovalEvidenceHashes(input)
  ].filter((d) => d !== null);
}
function detectDQ16(input) {
  if (input.evidencePackage?.retention.storageClassification === "mutable") {
    return {
      code: "DQ-16",
      message: "Evidence used for release judgment exists only in silent-overwrite capable storage",
      nodeIds: [],
      sourceRefs: [SR_DQ_16]
    };
  }
  return null;
}
function detectDQ17(input) {
  if (input.metadata.profile !== "ipo_controlled") return [];
  if (!input.evidencePackage || !input.evidencePackage.controlRoles) {
    return [
      {
        code: "DQ-17",
        message: "Control roles (producer/reviewer/approver/waiverApprover/releaseOwner) not recorded",
        nodeIds: [],
        sourceRefs: [SR_DQ_17]
      }
    ];
  }
  return [];
}

// src/gate/test-evidence.ts
function isTestNode(node) {
  return node.kind === "test";
}
function isGateEligibleTestEvidence(test) {
  return test.testExecutionMode === "real";
}
function buildTestEvidenceAccounting(graph) {
  const tests = graph.nodes.filter(isTestNode);
  const countedTestIds = tests.filter(
    (test) => isGateEligibleTestEvidence(test) && (test.evidenceStrength !== void 0 || test.recentGreenRuns !== void 0)
  ).map((test) => test.id);
  const excludedMockTests = tests.filter((test) => !isGateEligibleTestEvidence(test)).map((test) => ({
    testId: test.id,
    reason: "mock_test",
    sourceRefs: test.traceability.sourceRefs
  }));
  return { countedTestIds, excludedMockTests };
}

// src/gate/dq/placement-change.ts
function testPlacementNodes(input) {
  return input.testPlacementNodes ?? input.graph.nodes.filter(
    (node) => node.kind === "test_placement"
  );
}
function testNodes(input) {
  return input.graph.nodes.filter((node) => node.kind === "test");
}
function sourceRefsFromEvidence(evidenceRefs) {
  return evidenceRefs.map(({ evidenceKind: _evidenceKind, capturedAt: _capturedAt, ...sourceRef }) => sourceRef);
}
function sourceRefsForPlacementChange(input, evidenceRefs) {
  const refs = sourceRefsFromEvidence(evidenceRefs);
  return refs.length > 0 ? refs : [...input.policy.sourceRefs];
}
function obligationsForSubject(obligations, placements, subjectId) {
  const obligationIds = new Set(
    placements.filter((placement) => placement.id === subjectId || placement.selectedTestIds.includes(subjectId)).map((placement) => placement.obligationId)
  );
  return obligations.filter((obligation) => obligationIds.has(obligation.id));
}
function riskIdsForSubject(obligations, placements, subjectId) {
  return [...new Set(obligationsForSubject(obligations, placements, subjectId).flatMap((obligation) => obligation.riskIds))];
}
function isManualLayer(layer) {
  return layer === "manual-scripted" || layer === "manual-exploratory";
}
function isRestored(input, subjectId) {
  return input.placementPlan?.manual_case_inventory?.current_subject_ids.includes(subjectId) ?? false;
}
function detectManualScriptedOracleGaps(input) {
  const disqualifications = [];
  for (const placement of testPlacementNodes(input)) {
    if (placement.primaryLayer !== "manual-scripted") continue;
    const hasAcceptableOracle = input.evidencePackage?.manualEvidence.some(
      (manual) => manual.oracleRefs.some((oracle) => oracle.evidenceKind === "human_review")
    ) || placement.candidateScores.some(
      (score) => score.sourceRefs.some((sourceRef) => sourceRef.label?.includes("oracle"))
    );
    if (!hasAcceptableOracle) {
      disqualifications.push({
        code: "DQ-14",
        message: `Manual-scripted placement "${placement.id}" without acceptable oracle`,
        nodeIds: [placement.id],
        sourceRefs: placement.traceability.sourceRefs
      });
    }
  }
  return disqualifications;
}
function detectPlacementChangeRetirementGaps(input) {
  if (!input.placementPlan) return [];
  const disqualifications = [];
  const placementChanges = input.placementPlan.placement_changes ?? [];
  const knownTests = new Map(testNodes(input).map((test) => [test.id, test]));
  const retirementPolicy = input.policy.placementRetirementPolicy;
  for (const change of placementChanges) {
    const sourceRefs = sourceRefsForPlacementChange(input, change.evidence_refs);
    const isRetirement = isManualLayer(change.from_layer) && change.to_layer === "automated";
    if (!isRetirement) continue;
    if (change.evidence_refs.length === 0) {
      disqualifications.push({
        code: "DQ-14",
        message: `Placement change "${change.id}" retires manual case "${change.subject_id}" without evidence_refs`,
        nodeIds: [change.id, change.subject_id],
        sourceRefs
      });
      continue;
    }
    if (!retirementPolicy || retirementPolicy.sourceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-14",
        message: `Placement change "${change.id}" has no source-backed retirement policy`,
        nodeIds: [change.id, change.policy_ref],
        sourceRefs
      });
      continue;
    }
    const replacementTests = change.replacement_ids.map((id) => knownTests.get(id));
    if (replacementTests.some((test) => test === void 0 || test.deleted)) {
      if (!isRestored(input, change.subject_id)) {
        disqualifications.push({
          code: "DQ-14",
          message: `Placement change "${change.id}" replacement test is missing or deleted and manual case "${change.subject_id}" is not restored`,
          nodeIds: [change.id, change.subject_id, ...change.replacement_ids],
          sourceRefs
        });
      }
      continue;
    }
    const concreteReplacementTests = replacementTests.filter((test) => test !== void 0);
    const hasMockEvidence = concreteReplacementTests.some(
      (test) => !isGateEligibleTestEvidence(test)
    );
    const evidenceTooWeak = concreteReplacementTests.some(
      (test) => !isGateEligibleTestEvidence(test) || (test.evidenceStrength ?? 0) < retirementPolicy.minEvidenceStrength || (test.recentGreenRuns ?? 0) < retirementPolicy.minConsecutiveGreen
    );
    const requiredRiskIds = riskIdsForSubject(input.placementPlan.obligations, input.placementPlan.placements, change.subject_id);
    const coveredRiskIds = new Set(concreteReplacementTests.flatMap((test) => test.coveredRiskIds ?? []));
    const riskCoverageMissing = retirementPolicy.requireRiskCoverage && requiredRiskIds.some((riskId) => !coveredRiskIds.has(riskId));
    if ((evidenceTooWeak || riskCoverageMissing) && !isRestored(input, change.subject_id)) {
      const reason = hasMockEvidence ? "mock test evidence is not Gate-eligible" : evidenceTooWeak ? "evidence strength or green-run threshold fell below policy" : "required risk coverage is missing";
      disqualifications.push({
        code: "DQ-14",
        message: `Placement change "${change.id}" is a revert candidate: ${reason}`,
        nodeIds: [change.id, change.subject_id, ...change.replacement_ids, ...requiredRiskIds],
        sourceRefs
      });
    }
  }
  return disqualifications;
}
function detectManualCaseDisappearance(input) {
  const inventory = input.placementPlan?.manual_case_inventory;
  if (!inventory) return [];
  const current = new Set(inventory.current_subject_ids);
  const retired = new Set((input.placementPlan?.placement_changes ?? []).map((change) => change.subject_id));
  return inventory.previous_subject_ids.filter((previousSubjectId) => !current.has(previousSubjectId) && !retired.has(previousSubjectId)).map((previousSubjectId) => ({
    code: "DQ-14",
    message: `Manual case "${previousSubjectId}" disappeared without placement_change retirement record`,
    nodeIds: [previousSubjectId],
    sourceRefs: inventory.sourceRefs
  }));
}
function detectDQ14(input) {
  return [
    ...detectManualScriptedOracleGaps(input),
    ...detectPlacementChangeRetirementGaps(input),
    ...detectManualCaseDisappearance(input)
  ];
}

// src/gate/dq-detectors.ts
var DQ_DETECTORS = [
  detectDQ01,
  detectDQ02,
  detectDQ03,
  detectDQ04,
  detectDQ05,
  detectDQ06,
  detectDQ07,
  detectDQ08,
  detectDQ09,
  detectDQ10,
  detectDQ11,
  detectDQ12,
  detectDQ13,
  detectDQ14,
  detectDQ15,
  detectDQ16,
  detectDQ17
];
function detectAllDQs(input) {
  const results = [];
  for (const detector of DQ_DETECTORS) {
    const detected = detector(input);
    if (Array.isArray(detected)) {
      results.push(...detected);
    } else if (detected !== null) {
      results.push(detected);
    }
  }
  return results;
}

// src/gate/reliability/utils.ts
import { createHash } from "crypto";
var RELIABILITY_REF = {
  id: "qeg:reliability-extension",
  path: "docs/spec/reliability-extension.md"
};
function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function isResilienceTest(node) {
  return node.testType === "resilience";
}
function isResilienceEvidence(node) {
  return Boolean(node) && typeof node === "object" && node.kind === "execution_evidence" && node.evidenceType === "resilience";
}
function dq(code, message, nodeIds) {
  return {
    code,
    message,
    nodeIds: [...nodeIds].sort(lexicalCompare),
    sourceRefs: [RELIABILITY_REF]
  };
}
function isFullGitObjectId(value) {
  return Boolean(value && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value));
}
function isSha256(value) {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/.test(value));
}
function sameNumber(left, right) {
  return left !== void 0 && right !== void 0 && left === right;
}
function nearestRank(values, percentile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile / 100 * sorted.length) - 1] ?? null;
}
function uniqueNodeIds(disqualifications) {
  return [...new Set(disqualifications.flatMap((item) => item.nodeIds))].sort(lexicalCompare);
}
function canonicalJson(value) {
  if (value === void 0) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, child]) => child !== void 0).sort(([left], [right]) => lexicalCompare(left, right));
    return "{" + entries.map(([key, child]) => JSON.stringify(key) + ":" + canonicalJson(child)).join(",") + "}";
  }
  return JSON.stringify(value);
}
function decisionFingerprint(evidence) {
  const {
    id: _id,
    title: _title,
    traceability: _traceability,
    sourceArtifactIds: _sourceArtifactIds,
    ...decisionFields
  } = evidence;
  return createHash("sha256").update(canonicalJson(decisionFields)).digest("hex");
}
function isPassing(evidence) {
  return evidence.status === "pass" && evidence.passed !== false;
}
function requiresQualificationEvidence(evidence) {
  return evidence.status === "pass" || evidence.status === "fail" || evidence.status === "aborted";
}
function uniqueSourceRefs(...groups) {
  const byKey = /* @__PURE__ */ new Map();
  for (const ref of groups.flat()) {
    byKey.set(ref.id + String.fromCharCode(0) + ref.path, ref);
  }
  return [...byKey.values()].sort(
    (left, right) => lexicalCompare(left.id, right.id) || lexicalCompare(left.path, right.path)
  );
}
function targetBounds(slo) {
  if (slo.target.targetType === "min") {
    return { min: slo.target.value, max: Number.POSITIVE_INFINITY };
  }
  if (slo.target.targetType === "max") {
    return { min: Number.NEGATIVE_INFINITY, max: slo.target.value };
  }
  return { min: slo.target.min, max: slo.target.max };
}
function policyBounds(input, role, phase) {
  const thresholds = input.policy.reliabilityPolicy?.thresholds;
  if (!thresholds) return void 0;
  if (phase === "fault" && role === "traffic_count") {
    return { min: thresholds.minRequestCount, max: Number.POSITIVE_INFINITY };
  }
  if (phase === "fault" && role === "error_rate") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxErrorRate };
  }
  if (phase === "fault" && role === "latency_p95") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxLatencyP95Ms };
  }
  if (phase === "fault" && role === "saturation") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxSaturationPct };
  }
  if (phase === "experiment" && role === "duplicate_side_effects") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxDuplicateSideEffects };
  }
  if (phase === "experiment" && role === "data_inconsistencies") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxDataInconsistencies };
  }
  return void 0;
}
function targetSatisfied(value, slo) {
  const bounds = targetBounds(slo);
  return value >= bounds.min && value <= bounds.max;
}
function metricMatchesSlo(metric, slo) {
  return metric.metricName === slo.metricName && metric.semanticRole === slo.semanticRole && metric.aggregation === slo.aggregation && metric.unit === slo.unit && (slo.semanticRole !== "custom" || metric.customSemanticRoleName === slo.customSemanticRoleName);
}
function sortDisqualifications(values) {
  return [...values].sort(
    (left, right) => lexicalCompare(left.code, right.code) || lexicalCompare(left.nodeIds.join(String.fromCharCode(0)), right.nodeIds.join(String.fromCharCode(0))) || lexicalCompare(left.message, right.message)
  );
}
function sortBlockers(values) {
  return [...values].sort(
    (left, right) => lexicalCompare(left.ruleId ?? "", right.ruleId ?? "") || lexicalCompare(left.riskIds.join(String.fromCharCode(0)), right.riskIds.join(String.fromCharCode(0))) || lexicalCompare(left.testId ?? "", right.testId ?? "") || lexicalCompare(left.evidenceId ?? "", right.evidenceId ?? "") || lexicalCompare(left.id, right.id)
  );
}

// src/gate/reliability/accounting.ts
function buildReliabilityAccounting(stage) {
  const {
    input,
    index,
    selectedByTest,
    disqualifications,
    blockers: blockers2,
    safetyBlockers: safetyBlockers2,
    qualifiedRiskIds,
    passingRiskIds
  } = stage;
  const selected = [...selectedByTest.values()].sort(
    (left, right) => lexicalCompare(left.id, right.id)
  );
  const unsafeRiskIds = new Set(
    blockers2.filter(
      (item) => item.ruleId === "BLK-REL-04" && item.effective !== false
    ).flatMap((item) => item.riskIds)
  );
  const effectiveBlockerTestIds = new Set(
    blockers2.filter((item) => item.effective !== false && item.testId !== void 0).map((item) => item.testId)
  );
  const dqNodeIds = new Set(uniqueNodeIds(disqualifications));
  const globallyDisqualified = !input.evidenceVerification || input.evidenceVerification.status === "fail" || input.preflightDisqualifications.some(
    (item) => item.code === "DQ-01" || item.code === "DQ-06"
  ) || disqualifications.some(
    (item) => item.code === "DQ-21" && item.nodeIds.length === 0
  );
  const qualifiedSelected = globallyDisqualified ? [] : selected.filter(
    (evidence) => !dqNodeIds.has(evidence.id) && !dqNodeIds.has(evidence.testId)
  );
  const passingSelected = qualifiedSelected.filter(
    (evidence) => isPassing(evidence) && !effectiveBlockerTestIds.has(evidence.testId)
  );
  const recoverySeconds = qualifiedSelected.filter(
    (evidence) => evidence.recovered === true && evidence.recoveryDurationMs !== void 0
  ).map((evidence) => (evidence.recoveryDurationMs ?? 0) / 1e3);
  const evidenceAgeHours = {};
  for (const evidence of selected) {
    const age = (Date.parse(input.metadata.createdAt) - Date.parse(evidence.endedAt)) / 36e5;
    if (Number.isFinite(age) && age >= 0) {
      evidenceAgeHours[evidence.id] = age;
    }
  }
  const countBy = (code) => disqualifications.filter((item) => item.code === code).length;
  const qualifiedRiskCount = globallyDisqualified ? 0 : qualifiedRiskIds.size;
  const passingRiskCount = globallyDisqualified ? 0 : [...passingRiskIds].filter((riskId) => !unsafeRiskIds.has(riskId)).length;
  const finalDrillDown = [...stage.drillDown].sort(
    (left, right) => lexicalCompare(left.riskId, right.riskId) || lexicalCompare(left.testId, right.testId)
  ).map((item) => {
    const evidence = item.evidence;
    const safetyIds = safetyBlockers2.filter(
      (blocker) => blocker.testId === item.testId && blocker.riskIds.includes(item.riskId)
    ).map((blocker) => blocker.id);
    return {
      riskId: item.riskId,
      testId: item.testId,
      ...evidence ? {
        selectedEvidenceId: evidence.id,
        adapter: evidence.adapter,
        experimentId: evidence.experimentId,
        attempt: evidence.attempt,
        targetRevision: evidence.targetRevision,
        environmentId: evidence.environmentId
      } : {},
      selectionReason: item.selectionReason,
      ...item.exclusionReason ? { exclusionReason: item.exclusionReason } : {},
      disqualificationCodes: [...new Set(item.disqualificationCodes)].sort(),
      blockerIds: [.../* @__PURE__ */ new Set([...item.blockerIds, ...safetyIds])].sort(
        lexicalCompare
      )
    };
  });
  return {
    enabled: true,
    requiredRiskCount: index.requiredRisks.length,
    qualifiedRiskCount,
    passingRiskCount,
    riskCoverageRate: index.requiredRisks.length === 0 ? null : qualifiedRiskCount / index.requiredRisks.length,
    requiredExecutionCount: new Set(stage.drillDown.map((item) => item.testId)).size,
    qualifiedExecutionCount: qualifiedSelected.length,
    passingExecutionCount: passingSelected.length,
    resiliencePassRate: qualifiedSelected.length === 0 ? null : passingSelected.length / qualifiedSelected.length,
    recoverySecondsP50: nearestRank(recoverySeconds, 50),
    recoverySecondsP95: nearestRank(recoverySeconds, 95),
    recoverySampleCount: recoverySeconds.length,
    duplicateSideEffectsCount: selected.reduce(
      (sum, evidence) => sum + (evidence.observed?.duplicateSideEffects ?? 0),
      0
    ),
    dataInconsistenciesCount: selected.reduce(
      (sum, evidence) => sum + (evidence.observed?.dataInconsistencies ?? 0),
      0
    ),
    evidenceAgeHours,
    excludedMockTests: index.excludedMockTests,
    dqCountByRule: {
      "DQ-12": countBy("DQ-12"),
      "DQ-18": countBy("DQ-18"),
      "DQ-19": countBy("DQ-19"),
      "DQ-20": countBy("DQ-20"),
      "DQ-21": countBy("DQ-21")
    },
    drillDown: finalDrillDown
  };
}

// src/gate/reliability/blockers.ts
function validWaiverId(input, riskId, testId) {
  return input.validWaivers.find(
    (waiver) => waiver.linkedRiskIds.includes(riskId) && Boolean(waiver.linkedTestIds?.includes(testId))
  )?.id;
}
function createBlocker(input, ruleId, riskId, test, evidence, message, waiverId) {
  const unwaivable = ruleId === "BLK-REL-04";
  return {
    id: [
      "blocker",
      "rel",
      ruleId.slice(-2),
      riskId,
      test.id,
      evidence?.id ?? "none"
    ].join(":"),
    message,
    riskIds: [riskId],
    sourceRefs: uniqueSourceRefs(
      [RELIABILITY_REF],
      input.policy.reliabilityPolicy?.sourceRefs ?? [],
      test.traceability.sourceRefs,
      evidence?.traceability.sourceRefs ?? []
    ),
    ruleId,
    testId: test.id,
    ...evidence ? { evidenceId: evidence.id } : {},
    effective: unwaivable || !waiverId,
    ...!unwaivable && waiverId ? { waiverId } : {}
  };
}
function safetyBlockers(input, index) {
  const policy = input.policy.reliabilityPolicy;
  const head = input.metadata.headRef;
  if (!policy || !head) return [];
  const allowedEnvironments = new Set(policy.safety.allowedEnvironments);
  const blockers2 = [];
  const candidates = input.graph.nodes.filter(isResilienceEvidence).sort((left, right) => lexicalCompare(left.id, right.id));
  for (const candidate of candidates) {
    const test = index.testsById.get(candidate.testId);
    if (!test || test.testExecutionMode !== "real" || candidate.targetRevision !== head) {
      continue;
    }
    const environmentViolation = candidate.environment === "production" || !allowedEnvironments.has(candidate.environment) || candidate.environment !== test.resilienceScenario.blastRadius.environment;
    const faultViolation = candidate.fault ? candidate.fault.actualTargetIds.length > policy.safety.maxBlastRadiusTargets || candidate.fault.appliedDurationMs > policy.safety.maxFaultDurationSeconds * 1e3 || candidate.fault.actualTargetIds.length > test.resilienceScenario.blastRadius.maxTargets || candidate.fault.actualTargetIds.some(
      (targetId) => !test.resilienceScenario.blastRadius.allowedTargets.includes(targetId)
    ) || candidate.fault.appliedDurationMs > test.resilienceScenario.blastRadius.maxDurationSeconds * 1e3 : false;
    if (!environmentViolation && !faultViolation) continue;
    for (const riskId of [...test.coveredRiskIds].sort(lexicalCompare)) {
      blockers2.push(
        createBlocker(
          input,
          "BLK-REL-04",
          riskId,
          test,
          candidate,
          "Safety policy violated by a current real resilience attempt"
        )
      );
    }
  }
  return blockers2;
}
function evidenceBlockers(input, riskId, test, evidence) {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const waiverId = validWaiverId(input, riskId, test.id);
  const threshold = policy.thresholds;
  const observed = evidence.observed;
  const blockers2 = [];
  let thresholdViolated = Boolean(
    observed && (observed.requestCount < threshold.minRequestCount || observed.errorRate > threshold.maxErrorRate || observed.latencyP95Ms > threshold.maxLatencyP95Ms || observed.saturationPct > threshold.maxSaturationPct || observed.duplicateSideEffects > threshold.maxDuplicateSideEffects || observed.dataInconsistencies > threshold.maxDataInconsistencies)
  );
  let recoverySloViolated = false;
  for (const slo of test.resilienceScenario.steadyState.slos) {
    for (const metric of evidence.signalManifest?.metrics ?? []) {
      if (!metricMatchesSlo(metric, slo) || !slo.evaluationPhases.includes(
        metric.phase
      )) {
        continue;
      }
      if (!targetSatisfied(metric.observedValue, slo)) {
        if (metric.phase === "fault") thresholdViolated = true;
        if (metric.phase === "recovery") recoverySloViolated = true;
      }
    }
  }
  if (thresholdViolated) {
    blockers2.push(
      createBlocker(
        input,
        "BLK-REL-01",
        riskId,
        test,
        evidence,
        "Resilience SLO threshold exceeded",
        waiverId
      )
    );
  }
  if (requiresQualificationEvidence(evidence) && policy.requireRecoveryObservation && (evidence.recovered !== true || evidence.recoveryConfirmedAt === void 0 || evidence.recoveryDurationMs === void 0 || evidence.recoveryDurationMs > threshold.maxRecoverySeconds * 1e3 || recoverySloViolated)) {
    blockers2.push(
      createBlocker(
        input,
        "BLK-REL-02",
        riskId,
        test,
        evidence,
        "Recovery is absent or exceeds the resilience threshold",
        waiverId
      )
    );
  }
  if (!isPassing(evidence)) {
    blockers2.push(
      createBlocker(
        input,
        "BLK-REL-03",
        riskId,
        test,
        evidence,
        "Resilience execution status is " + evidence.status,
        waiverId
      )
    );
  }
  return blockers2;
}

// src/gate/reliability/indexing.ts
function buildReliabilityIndex(input) {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) throw new Error("reliability policy is required");
  const allTests = input.graph.nodes.filter((node) => node.kind === "test").sort((left, right) => lexicalCompare(left.id, right.id));
  const resilienceTests = allTests.filter(isResilienceTest);
  const testsById = new Map(resilienceTests.map((test) => [test.id, test]));
  const requiredRisks = [...input.riskNodes ?? input.graph.nodes.filter((node) => node.kind === "risk")].filter((risk) => policy.requiredForSeverities.includes(risk.severity)).sort((left, right) => lexicalCompare(left.id, right.id));
  const testsByRiskId = new Map(
    requiredRisks.map((risk) => [
      risk.id,
      resilienceTests.filter(
        (test) => !test.deleted && test.testExecutionMode === "real" && test.coveredRiskIds.includes(risk.id)
      )
    ])
  );
  const excludedMockTests = resilienceTests.filter((test) => test.testExecutionMode === "mock").map((test) => ({
    testId: test.id,
    reason: "mock_test",
    sourceRefs: [...test.traceability.sourceRefs].sort(
      (left, right) => lexicalCompare(left.id, right.id) || lexicalCompare(left.path, right.path)
    )
  })).sort((left, right) => lexicalCompare(left.testId, right.testId));
  return {
    allTests,
    resilienceTests,
    testsById,
    requiredRisks,
    testsByRiskId,
    excludedMockTests
  };
}

// src/validation/reliability-semantics.ts
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function validateReliabilitySemantics(raw) {
  if (!isObject(raw)) return [];
  const issues = [];
  const add2 = (ruleId, path, message, nodeId) => {
    issues.push({ ruleId, path, message, ...nodeId ? { nodeId } : {} });
  };
  if (isObject(raw.graph) && Array.isArray(raw.graph.nodes)) {
    raw.graph.nodes.forEach((node, nodeIndex) => {
      if (!isObject(node)) return;
      const nodeId = typeof node.id === "string" ? node.id : void 0;
      if (node.kind === "test" && node.testType === "resilience" && isObject(node.resilienceScenario)) {
        const scenarioPath = "/graph/nodes/" + nodeIndex + "/resilienceScenario";
        const steadyState = isObject(node.resilienceScenario.steadyState) ? node.resilienceScenario.steadyState : void 0;
        const slos = Array.isArray(steadyState?.slos) ? steadyState.slos : [];
        const requiredMetrics = Array.isArray(steadyState?.requiredMetrics) ? steadyState.requiredMetrics.filter((value) => typeof value === "string") : [];
        const names = /* @__PURE__ */ new Set();
        const tuples = /* @__PURE__ */ new Set();
        slos.forEach((slo, sloIndex) => {
          if (!isObject(slo)) return;
          const base = scenarioPath + "/steadyState/slos/" + sloIndex;
          if (typeof slo.name === "string") {
            if (names.has(slo.name)) {
              add2("REL-SEM-001", base + "/name", "SLO names must be unique", nodeId);
            }
            names.add(slo.name);
          }
          const tuple = [slo.metricName, slo.semanticRole, slo.aggregation, slo.unit].map(String).join(String.fromCharCode(0));
          if (tuples.has(tuple)) {
            add2(
              "REL-SEM-002",
              base,
              "metricName/semanticRole/aggregation/unit SLO tuples must be unique",
              nodeId
            );
          }
          tuples.add(tuple);
          if (typeof slo.metricName === "string" && !requiredMetrics.includes(slo.metricName)) {
            add2(
              "REL-SEM-003",
              base + "/metricName",
              "every SLO metric must be present in requiredMetrics",
              nodeId
            );
          }
          if (isObject(slo.target) && slo.target.targetType === "range" && typeof slo.target.min === "number" && typeof slo.target.max === "number" && slo.target.min >= slo.target.max) {
            add2("REL-SEM-004", base + "/target", "SLO range min must be less than max", nodeId);
          }
        });
        const abortConditions = Array.isArray(node.resilienceScenario.abortConditions) ? node.resilienceScenario.abortConditions : [];
        const abortIds = abortConditions.map((condition) => isObject(condition) ? condition.id : void 0).filter((id) => typeof id === "string");
        if (new Set(abortIds).size !== abortIds.length) {
          add2(
            "REL-SEM-005",
            scenarioPath + "/abortConditions",
            "abort condition IDs must be unique",
            nodeId
          );
        }
      }
      if (node.kind === "execution_evidence" && node.evidenceType === "resilience") {
        if (typeof node.passed === "boolean" && typeof node.status === "string" && node.passed !== (node.status === "pass")) {
          add2(
            "REL-SEM-007",
            "/graph/nodes/" + nodeIndex + "/passed",
            "passed must agree with the canonical status when present",
            nodeId
          );
        }
        if (isObject(node.signalManifest)) {
          const entries = [
            node.signalManifest.metrics,
            node.signalManifest.traces,
            node.signalManifest.logs
          ].flatMap((value) => Array.isArray(value) ? value : []).filter(isObject);
          const entryIds = entries.map((entry) => entry.id).filter((id) => typeof id === "string");
          if (new Set(entryIds).size !== entryIds.length) {
            add2(
              "REL-SEM-006",
              "/graph/nodes/" + nodeIndex + "/signalManifest",
              "signal entry IDs must be unique across metrics, traces, and logs",
              nodeId
            );
          }
        }
      }
    });
  }
  if (isObject(raw.policy) && isObject(raw.policy.reliabilityPolicy)) {
    const reliability = raw.policy.reliabilityPolicy;
    const safety = isObject(reliability.safety) ? reliability.safety : void 0;
    const allowed = Array.isArray(safety?.allowedEnvironments) ? safety.allowedEnvironments : [];
    if (typeof reliability.requiredEnvironment === "string" && !allowed.includes(reliability.requiredEnvironment)) {
      add2(
        "REL-SEM-008",
        "/policy/reliabilityPolicy/requiredEnvironment",
        "requiredEnvironment must be included in safety.allowedEnvironments"
      );
    }
  }
  return issues.sort(
    (left, right) => compareText(left.path, right.path) || compareText(left.ruleId, right.ruleId) || compareText(left.nodeId ?? "", right.nodeId ?? "")
  );
}

// src/gate/reliability/signals.ts
function findAbortSignal(evidence, entryId) {
  const manifest = evidence.signalManifest;
  if (!manifest) return void 0;
  const metric = manifest.metrics.find((entry) => entry.id === entryId);
  if (metric) return { source: "metric", entry: metric };
  const trace = manifest.traces.find((entry) => entry.id === entryId);
  if (trace) return { source: "trace_count", entry: trace };
  const log = manifest.logs.find((entry) => entry.id === entryId);
  return log ? { source: "log_count", entry: log } : void 0;
}
var OBSERVED_METRICS = [
  {
    field: "requestCount",
    phase: "fault",
    role: "traffic_count",
    aggregation: "count",
    unit: "count"
  },
  {
    field: "errorRate",
    phase: "fault",
    role: "error_rate",
    aggregation: "rate",
    unit: "ratio"
  },
  {
    field: "latencyP95Ms",
    phase: "fault",
    role: "latency_p95",
    aggregation: "p95",
    unit: "ms"
  },
  {
    field: "saturationPct",
    phase: "fault",
    role: "saturation",
    aggregation: "max",
    unit: "percent"
  },
  {
    field: "duplicateSideEffects",
    phase: "experiment",
    role: "duplicate_side_effects",
    aggregation: "count",
    unit: "count"
  },
  {
    field: "dataInconsistencies",
    phase: "experiment",
    role: "data_inconsistencies",
    aggregation: "count",
    unit: "count"
  }
];
function signalDqs(input, test, evidence) {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const scenario = test.resilienceScenario;
  const manifest = evidence.signalManifest;
  const reasons = [];
  const qualificationRequired = requiresQualificationEvidence(evidence);
  if (!manifest) {
    return qualificationRequired || evidence.observed ? [dq("DQ-20", "Resilience signalManifest is missing", [evidence.id, test.id])] : [];
  }
  const allEntries = [...manifest.metrics, ...manifest.traces, ...manifest.logs];
  const refIds = evidence.evidenceRefs.map((ref) => ref.id);
  if (new Set(refIds).size !== refIds.length) {
    reasons.push("signal evidenceRef IDs are not unique");
  }
  const refs = new Map(evidence.evidenceRefs.map((ref) => [ref.id, ref]));
  const executionStart = Date.parse(evidence.startedAt);
  const executionEnd = Date.parse(evidence.endedAt);
  const faultStart = evidence.fault ? Date.parse(evidence.fault.faultStartedAt) : Number.NaN;
  const faultEnd = evidence.fault ? Date.parse(evidence.fault.faultEndedAt) : Number.NaN;
  const recoveryEnd = evidence.recoveryConfirmedAt ? Date.parse(evidence.recoveryConfirmedAt) : Number.NaN;
  const evaluationMs = Date.parse(input.metadata.createdAt);
  for (const entry of allEntries) {
    const ref = refs.get(entry.evidenceRefId);
    const expectedKind = manifest.metrics.includes(entry) ? "observability_metric" : manifest.traces.includes(entry) ? "observability_trace" : "observability_log";
    if (!ref || !ref.contentHash || ref.revision !== evidence.targetRevision || ref.evidenceKind !== expectedKind) {
      reasons.push(
        "signal " + entry.id + " has no matching hash-backed " + expectedKind + " reference"
      );
    }
    const windowStart = Date.parse(entry.windowStart);
    const windowEnd = Date.parse(entry.windowEnd);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart < executionStart || windowEnd > executionEnd || windowStart > windowEnd) {
      reasons.push("signal " + entry.id + " has an invalid execution window");
    }
    if (entry.phase === "steady_state" && Number.isFinite(faultStart) && windowEnd > faultStart) {
      reasons.push("signal " + entry.id + " exceeds the steady-state window");
    }
    if (entry.phase === "fault" && Number.isFinite(faultStart) && Number.isFinite(faultEnd) && (windowStart < faultStart || windowEnd > faultEnd)) {
      reasons.push("signal " + entry.id + " is outside the fault window");
    }
    if (entry.phase === "recovery" && Number.isFinite(faultEnd) && Number.isFinite(recoveryEnd) && (windowStart < faultEnd || windowEnd > recoveryEnd)) {
      reasons.push("signal " + entry.id + " is outside the recovery window");
    }
    if (ref) {
      const capturedAt = Date.parse(ref.capturedAt ?? "");
      if (!Number.isFinite(capturedAt) || capturedAt < windowEnd || Number.isFinite(evaluationMs) && capturedAt > evaluationMs) {
        reasons.push("signal " + entry.id + " has an invalid capturedAt");
      }
    }
  }
  if (qualificationRequired) {
    if (policy.requiredSignals.metrics && manifest.metrics.length === 0) {
      reasons.push("policy requires metrics");
    }
    for (const requiredMetric of scenario.steadyState.requiredMetrics) {
      if (!manifest.metrics.some(
        (metric) => metric.metricName === requiredMetric && metric.phase === "steady_state"
      )) {
        reasons.push("required steady-state metric " + requiredMetric + " is missing");
      }
    }
    for (const slo of scenario.steadyState.slos) {
      for (const phase of slo.evaluationPhases) {
        if (!manifest.metrics.some(
          (metric) => metricMatchesSlo(metric, slo) && metric.phase === phase
        )) {
          reasons.push("SLO " + slo.name + " has no exact " + phase + " signal");
        }
      }
    }
  }
  const metricGroups = /* @__PURE__ */ new Map();
  for (const metric of manifest.metrics) {
    const key = [
      metric.phase,
      metric.semanticRole,
      metric.customSemanticRoleName ?? "",
      metric.aggregation,
      metric.unit
    ].join(String.fromCharCode(0));
    const values = metricGroups.get(key) ?? /* @__PURE__ */ new Set();
    values.add(metric.observedValue);
    metricGroups.set(key, values);
  }
  if ([...metricGroups.values()].some((values) => values.size > 1)) {
    reasons.push("same-role signal measurements contain conflicting values");
  }
  const requireTraces = qualificationRequired && (policy.requiredSignals.traces || scenario.steadyState.requiredTraces);
  const requireLogs = qualificationRequired && (policy.requiredSignals.logs || scenario.steadyState.requiredLogs);
  const requiredPhases = policy.requireRecoveryObservation ? ["fault", "recovery"] : ["fault"];
  if (requireTraces && requiredPhases.some(
    (phase) => !manifest.traces.some(
      (entry) => entry.phase === phase && entry.matchedCount > 0
    )
  )) {
    reasons.push("required trace phases are missing or empty");
  }
  if (requireLogs && requiredPhases.some(
    (phase) => !manifest.logs.some(
      (entry) => entry.phase === phase && entry.matchedCount > 0
    )
  )) {
    reasons.push("required log phases are missing or empty");
  }
  if (qualificationRequired) {
    for (const condition of scenario.abortConditions) {
      if (condition.source === "metric" && !manifest.metrics.some(
        (entry) => entry.phase === "fault" && entry.metricName === condition.signal && entry.aggregation === condition.aggregation && entry.unit === condition.unit
      )) {
        reasons.push("abort metric " + condition.signal + " is missing");
      }
      if (condition.source === "trace_count" && !manifest.traces.some(
        (entry) => entry.phase === "fault" && entry.signalName === condition.signal && entry.matchedCount > 0
      )) {
        reasons.push("abort trace " + condition.signal + " is missing or empty");
      }
      if (condition.source === "log_count" && !manifest.logs.some(
        (entry) => entry.phase === "fault" && entry.signalName === condition.signal && entry.matchedCount > 0
      )) {
        reasons.push("abort log " + condition.signal + " is missing or empty");
      }
    }
  }
  const observed = evidence.observed;
  if (qualificationRequired && !observed) reasons.push("observed summary is missing");
  if (observed) {
    for (const expected of OBSERVED_METRICS) {
      const matches = manifest.metrics.filter(
        (metric) => metric.phase === expected.phase && metric.semanticRole === expected.role && metric.aggregation === expected.aggregation && metric.unit === expected.unit
      );
      const values = new Set(matches.map((metric) => metric.observedValue));
      if (matches.length === 0) {
        reasons.push("observed " + expected.field + " has no canonical signal");
      }
      if (values.size > 1) {
        reasons.push("observed " + expected.field + " has conflicting signal values");
      }
      const measured = matches[0]?.observedValue;
      if (measured !== void 0 && !sameNumber(measured, observed[expected.field])) {
        reasons.push(
          "observed " + expected.field + " differs from signal manifest"
        );
      }
    }
  }
  return reasons.length > 0 ? [
    dq(
      "DQ-20",
      "Resilience signals invalid: " + [...new Set(reasons)].join("; "),
      [evidence.id, test.id]
    )
  ] : [];
}
function steadyStateSloDqs(test, evidence) {
  const violations = test.resilienceScenario.steadyState.slos.filter(
    (slo) => slo.evaluationPhases.includes("steady_state") && evidence.signalManifest?.metrics.some(
      (metric) => metric.phase === "steady_state" && metricMatchesSlo(metric, slo) && !targetSatisfied(metric.observedValue, slo)
    )
  );
  return violations.length > 0 ? [
    dq(
      "DQ-18",
      "Steady-state SLO is not satisfied: " + violations.map((slo) => slo.name).join(", "),
      [evidence.id, test.id]
    )
  ] : [];
}

// src/gate/reliability/qualification.ts
function artifactFailureClasses(input) {
  const byArtifact = /* @__PURE__ */ new Map();
  for (const item of input.evidenceVerification?.items ?? []) {
    if (item.severity !== "fail" || item.code === "VERIFIED") continue;
    const current = byArtifact.get(item.artifactId);
    if (item.code !== "REVISION_MISMATCH" || current === "non_revision") {
      byArtifact.set(item.artifactId, "non_revision");
    } else {
      byArtifact.set(item.artifactId, "revision");
    }
  }
  return byArtifact;
}
function artifactVerificationDqs(input) {
  const report = input.evidenceVerification;
  if (!report) {
    return [
      dq(
        "DQ-06",
        "Reliability policy is enabled but artifact verification report is missing",
        []
      )
    ];
  }
  const classes = artifactFailureClasses(input);
  const result = [];
  const preflightOwnsDq06 = input.preflightDisqualifications.some(
    (item) => item.code === "DQ-06"
  );
  for (const artifactId of [...classes.keys()].sort()) {
    const failureClass = classes.get(artifactId);
    if (failureClass === "non_revision") {
      if (!preflightOwnsDq06) {
        result.push(
          dq("DQ-06", "Artifact verification failed for " + artifactId, [artifactId])
        );
      }
    } else if (failureClass === "revision") {
      result.push(
        dq("DQ-12", "Artifact revision mismatch for " + artifactId, [artifactId])
      );
    }
  }
  if (report.status === "fail" && classes.size === 0 && !preflightOwnsDq06) {
    result.push(
      dq(
        "DQ-06",
        "Artifact verification failed without a classified artifact diagnostic",
        []
      )
    );
  }
  return result;
}
function semanticInputDqs(input) {
  const issues = validateReliabilitySemantics(input);
  if (issues.length === 0 || input.preflightDisqualifications.some((item) => item.code === "DQ-01")) {
    return [];
  }
  return issues.map(
    (issue) => dq(
      "DQ-01",
      "[" + issue.ruleId + "] " + issue.message + " at " + issue.path,
      issue.nodeId ? [issue.nodeId] : []
    )
  );
}
function policyIntegrityDqs(input) {
  const { metadata, graph, policy } = input;
  const allowedProfiles = /* @__PURE__ */ new Set(["standard", "strict", "ipo_controlled"]);
  const requiredDqScope = [
    "DQ-18",
    "DQ-19",
    "DQ-20",
    "DQ-21"
  ];
  const valuesMatch = metadata.profile === policy.profile && graph.metadata.profile === policy.profile && metadata.policyId === policy.policyId && graph.metadata.policyId === policy.policyId && metadata.policyHash === policy.policyHash && graph.metadata.policyHash === policy.policyHash && metadata.headRef === graph.metadata.headRef;
  if (!isFullGitObjectId(metadata.headRef) || !isFullGitObjectId(graph.metadata.headRef) || !isSha256(policy.policyHash) || !isSha256(metadata.policyHash) || !isSha256(graph.metadata.policyHash) || !allowedProfiles.has(policy.profile) || !requiredDqScope.every((code) => policy.dqScope.includes(code)) || !valuesMatch) {
    return [
      dq(
        "DQ-21",
        "Reliability policy identity, SHA-256 hash, profile, DQ scope, or full revision is invalid or does not match across Gate, graph, and policy",
        []
      )
    ];
  }
  return [];
}
function globalQualificationDqs(input) {
  return [
    ...semanticInputDqs(input),
    ...artifactVerificationDqs(input),
    ...policyIntegrityDqs(input)
  ];
}
function evidenceRevisionDqs(input, evidence) {
  const head = input.metadata.headRef;
  const reportClasses = artifactFailureClasses(input);
  const mismatches = [];
  if (!head || evidence.targetRevision !== head) mismatches.push("targetRevision");
  if (evidence.rawArtifactRef.revision !== head && !reportClasses.has(evidence.rawArtifactRef.id)) {
    mismatches.push("rawArtifactRef.revision");
  }
  for (const ref of evidence.evidenceRefs) {
    if (ref.revision !== head && !reportClasses.has(ref.id)) {
      mismatches.push("evidenceRef:" + ref.id);
    }
  }
  return mismatches.length > 0 ? [
    dq(
      "DQ-12",
      "Resilience evidence revision mismatch (" + mismatches.join(", ") + ")",
      [evidence.id]
    )
  ] : [];
}
function scenarioDqs(input, test) {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const reasons = [];
  for (const slo of test.resilienceScenario.steadyState.slos) {
    if (policy.requireRecoveryObservation && !slo.evaluationPhases.includes("recovery")) {
      reasons.push("SLO " + slo.name + " omits recovery phase");
    }
    const bounds = targetBounds(slo);
    for (const phase of slo.evaluationPhases) {
      const policyLimit = policyBounds(input, slo.semanticRole, phase);
      if (policyLimit && Math.max(bounds.min, policyLimit.min) > Math.min(bounds.max, policyLimit.max)) {
        reasons.push(
          "SLO " + slo.name + " conflicts with the effective policy threshold in " + phase
        );
      }
    }
  }
  return reasons.length > 0 ? [
    dq(
      "DQ-18",
      "Resilience scenario is incompatible with policy: " + [...new Set(reasons)].join("; "),
      [test.id]
    )
  ] : [];
}
function abortTriggered(condition, observed) {
  switch (condition.operator) {
    case "gt":
      return observed > condition.threshold;
    case "gte":
      return observed >= condition.threshold;
    case "lt":
      return observed < condition.threshold;
    case "lte":
      return observed <= condition.threshold;
    case "eq":
      return observed === condition.threshold;
    case "ne":
      return observed !== condition.threshold;
  }
}
function lifecycleDqs(input, test, evidence) {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const evaluationMs = Date.parse(input.metadata.createdAt);
  const start = Date.parse(evidence.startedAt);
  const end = Date.parse(evidence.endedAt);
  const ageMs = evaluationMs - end;
  const scenario = test.resilienceScenario;
  const reasons = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || Number.isFinite(evaluationMs) && end > evaluationMs) {
    reasons.push("invalid or future execution timestamps");
  }
  if (Number.isFinite(ageMs) && ageMs > policy.maxEvidenceAgeHours * 60 * 60 * 1e3) {
    reasons.push("evidence exceeds maximum age");
  }
  if (evidence.environment !== policy.requiredEnvironment || evidence.environment !== scenario.blastRadius.environment) {
    reasons.push("environment differs from policy or scenario");
  }
  if (requiresQualificationEvidence(evidence) && policy.requireSteadyStateBeforeFault && evidence.steadyStateConfirmed !== true) {
    reasons.push("steady state is not confirmed");
  }
  if (requiresQualificationEvidence(evidence) && (!evidence.fault || evidence.fault.type !== scenario.faultModel)) {
    reasons.push("fault is absent or differs from scenario");
  }
  if (requiresQualificationEvidence(evidence) && evidence.fault) {
    const faultStart = Date.parse(evidence.fault.faultStartedAt);
    const faultEnd = Date.parse(evidence.fault.faultEndedAt);
    if (!Number.isFinite(faultStart) || !Number.isFinite(faultEnd) || faultStart < start || faultEnd > end || faultStart > faultEnd) {
      reasons.push("fault interval is outside execution");
    }
    if (Number.isFinite(faultStart) && Number.isFinite(faultEnd) && evidence.fault.appliedDurationMs !== faultEnd - faultStart) {
      reasons.push("appliedDurationMs differs from the fault interval");
    }
    if (evidence.recoveryConfirmedAt !== void 0) {
      const recoveryAt = Date.parse(evidence.recoveryConfirmedAt);
      if (!Number.isFinite(recoveryAt) || recoveryAt < faultEnd || recoveryAt > end) {
        reasons.push("recoveryConfirmedAt is outside the recovery interval");
      }
      if (evidence.recoveryDurationMs !== void 0 && Number.isFinite(recoveryAt) && evidence.recoveryDurationMs !== recoveryAt - faultEnd) {
        reasons.push(
          "recoveryDurationMs differs from the measured recovery interval"
        );
      }
    }
  }
  if (evidence.status === "aborted") {
    const record = evidence.abortRecord;
    const condition = scenario.abortConditions.find(
      (item) => item.id === record?.conditionId
    );
    const resolved = record ? findAbortSignal(evidence, record.signalEntryId) : void 0;
    if (!record || !condition || !resolved) {
      reasons.push("abort record, condition, or signal entry is absent");
    } else {
      const entry = resolved.entry;
      const observedValue = "observedValue" in entry ? entry.observedValue : entry.matchedCount;
      const signalName = "metricName" in entry ? entry.metricName : entry.signalName;
      const aggregation = "aggregation" in entry ? entry.aggregation : "count";
      const triggeredAt = Date.parse(record.triggeredAt);
      const windowStart = Date.parse(entry.windowStart);
      const windowEnd = Date.parse(entry.windowEnd);
      const faultStart = evidence.fault ? Date.parse(evidence.fault.faultStartedAt) : Number.NaN;
      const faultEnd = evidence.fault ? Date.parse(evidence.fault.faultEndedAt) : Number.NaN;
      if (resolved.source !== condition.source || signalName !== condition.signal || aggregation !== condition.aggregation || record.unit !== condition.unit || "unit" in entry && entry.unit !== condition.unit) {
        reasons.push("abort signal contract differs from its condition");
      }
      if (!sameNumber(observedValue, record.observedValue) || !abortTriggered(condition, observedValue)) {
        reasons.push("abort observed value does not trigger its condition");
      }
      if (!Number.isFinite(triggeredAt) || triggeredAt < windowStart || triggeredAt > windowEnd || triggeredAt < faultStart || triggeredAt > faultEnd) {
        reasons.push("abort timestamp is outside signal or fault windows");
      }
    }
  } else if (evidence.abortRecord) {
    reasons.push("non-aborted evidence contains an abort record");
  }
  return reasons.length > 0 ? [
    dq(
      "DQ-18",
      "Resilience lifecycle invalid: " + [...new Set(reasons)].join("; "),
      [evidence.id, test.id]
    )
  ] : [];
}
function qualifyEvidence(input, test, evidence) {
  const revision = evidenceRevisionDqs(input, evidence);
  if (revision.length > 0) return revision;
  const scenario = scenarioDqs(input, test);
  if (scenario.length > 0) return scenario;
  const lifecycle = lifecycleDqs(input, test, evidence);
  if (lifecycle.length > 0) return lifecycle;
  const signals = signalDqs(input, test, evidence);
  if (signals.length > 0) return signals;
  return requiresQualificationEvidence(evidence) ? steadyStateSloDqs(test, evidence) : [];
}

// src/gate/reliability/selection.ts
function evidencedByProvenanceDqs(input, test, evidenceNodes) {
  const nodesById = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const contradictoryIds = /* @__PURE__ */ new Set();
  for (const evidence of evidenceNodes) {
    const incoming = input.graph.edges.filter(
      (edge) => edge.kind === "evidenced_by" && edge.to === evidence.id
    );
    if (incoming.length === 0) continue;
    const sourceIds = [...new Set(incoming.map((edge) => edge.from))].sort(
      lexicalCompare
    );
    const source = sourceIds.length === 1 ? nodesById.get(sourceIds[0] ?? "") : void 0;
    if (sourceIds.length === 1 && sourceIds[0] === test.id && source?.kind === "test") {
      continue;
    }
    contradictoryIds.add(evidence.id);
    contradictoryIds.add(test.id);
    for (const sourceId of sourceIds) contradictoryIds.add(sourceId);
  }
  return contradictoryIds.size === 0 ? [] : [
    dq(
      "DQ-18",
      "Latest resilience evidence has evidenced_by provenance that contradicts testId",
      [...contradictoryIds]
    )
  ];
}
function selectEvidence(input, test) {
  const all = input.graph.nodes.filter(isResilienceEvidence).filter((evidence) => evidence.testId === test.id).sort((left, right) => lexicalCompare(left.id, right.id));
  const current = all.filter(
    (evidence) => evidence.targetRevision === input.metadata.headRef
  );
  if (current.length === 0) {
    const revisionDqs = all.flatMap((evidence) => evidenceRevisionDqs(input, evidence));
    return {
      disqualifications: revisionDqs.length > 0 ? revisionDqs : [dq("DQ-18", "No current resilience evidence exists for required test", [test.id])],
      exclusionReason: "no_current_real_evidence"
    };
  }
  const invalidTimestamps = current.filter(
    (evidence) => !Number.isFinite(Date.parse(evidence.endedAt))
  );
  if (invalidTimestamps.length > 0) {
    return {
      disqualifications: [
        dq(
          "DQ-18",
          "Current resilience evidence has an invalid endedAt timestamp",
          invalidTimestamps.map((evidence) => evidence.id)
        )
      ],
      exclusionReason: "invalid_current_timestamp"
    };
  }
  const byIdentity = /* @__PURE__ */ new Map();
  for (const evidence of current) {
    const key = [
      evidence.adapter,
      evidence.experimentId,
      evidence.attempt,
      evidence.targetRevision
    ].join(String.fromCharCode(0));
    byIdentity.set(key, [...byIdentity.get(key) ?? [], evidence]);
  }
  for (const duplicates of [...byIdentity.values()].sort(
    (left, right) => lexicalCompare(left[0]?.id ?? "", right[0]?.id ?? "")
  )) {
    if (duplicates.length > 1 && new Set(duplicates.map(decisionFingerprint)).size > 1) {
      return {
        disqualifications: [
          dq(
            "DQ-19",
            "Current resilience evidence reuses an execution identity with conflicting decision fingerprints",
            duplicates.map((evidence) => evidence.id)
          )
        ],
        exclusionReason: "ambiguous_execution_identity"
      };
    }
  }
  const newestTime = Math.max(
    ...current.map((evidence) => Date.parse(evidence.endedAt))
  );
  const newest = current.filter((evidence) => Date.parse(evidence.endedAt) === newestTime).sort((left, right) => lexicalCompare(left.id, right.id));
  if (new Set(newest.map(decisionFingerprint)).size > 1) {
    return {
      disqualifications: [
        dq(
          "DQ-19",
          "Latest current resilience evidence has conflicting decision fingerprints",
          newest.map((evidence) => evidence.id)
        )
      ],
      exclusionReason: "ambiguous_latest_evidence"
    };
  }
  const provenanceDqs = evidencedByProvenanceDqs(input, test, newest);
  if (provenanceDqs.length > 0) {
    return {
      evidence: newest[0],
      disqualifications: provenanceDqs,
      exclusionReason: "contradictory_evidenced_by_provenance"
    };
  }
  return { evidence: newest[0], disqualifications: [] };
}

// src/gate/reliability/evaluator.ts
function evaluateReliability(input) {
  if (!input.policy.reliabilityPolicy) {
    return {
      accounting: { enabled: false },
      disqualifications: [],
      blockers: []
    };
  }
  const index = buildReliabilityIndex(input);
  const disqualifications = [
    ...globalQualificationDqs(input)
  ];
  const blockers2 = [];
  const drillDown = [];
  const selectionByTest = /* @__PURE__ */ new Map();
  const qualificationByTest = /* @__PURE__ */ new Map();
  const selectedByTest = /* @__PURE__ */ new Map();
  const emittedTestDqs = /* @__PURE__ */ new Set();
  const qualifiedRiskIds = /* @__PURE__ */ new Set();
  const passingRiskIds = /* @__PURE__ */ new Set();
  for (const risk of index.requiredRisks) {
    const tests = index.testsByRiskId.get(risk.id) ?? [];
    if (tests.length === 0) {
      const mockOnly = index.resilienceTests.some(
        (test) => !test.deleted && test.coveredRiskIds.includes(risk.id) && test.testExecutionMode === "mock"
      );
      disqualifications.push(
        dq(
          "DQ-18",
          mockOnly ? "Required risk has only mock resilience tests" : "Required risk has no real resilience test",
          [risk.id]
        )
      );
      continue;
    }
    let riskQualified = true;
    let riskPassing = true;
    for (const test of tests) {
      let selection = selectionByTest.get(test.id);
      if (!selection) {
        selection = selectEvidence(input, test);
        selectionByTest.set(test.id, selection);
        if (selection.evidence) {
          selectedByTest.set(test.id, selection.evidence);
        }
      }
      const evidence = selection.evidence;
      let localDqs = qualificationByTest.get(test.id);
      if (!localDqs) {
        localDqs = evidence ? qualifyEvidence(input, test, evidence) : [];
        qualificationByTest.set(test.id, localDqs);
      }
      const localBlockers = evidence && selection.disqualifications.length === 0 && localDqs.length === 0 ? evidenceBlockers(input, risk.id, test, evidence) : [];
      if (!emittedTestDqs.has(test.id)) {
        disqualifications.push(...selection.disqualifications, ...localDqs);
        emittedTestDqs.add(test.id);
      }
      blockers2.push(...localBlockers);
      const qualified = evidence !== void 0 && selection.disqualifications.length === 0 && localDqs.length === 0;
      const passing = qualified && isPassing(evidence) && localBlockers.every((item) => item.effective === false);
      if (!qualified) riskQualified = false;
      if (!passing) riskPassing = false;
      drillDown.push({
        riskId: risk.id,
        testId: test.id,
        ...evidence ? { evidence } : {},
        selectionReason: evidence ? "latest_current_execution" : "no_selectable_current_execution",
        ...selection.exclusionReason ? { exclusionReason: selection.exclusionReason } : {},
        disqualificationCodes: [
          ...new Set(
            [...selection.disqualifications, ...localDqs].map(
              (item) => item.code
            )
          )
        ],
        blockerIds: localBlockers.map((item) => item.id)
      });
    }
    if (riskQualified) qualifiedRiskIds.add(risk.id);
    if (riskQualified && riskPassing) passingRiskIds.add(risk.id);
  }
  const safety = safetyBlockers(input, index);
  blockers2.push(...safety);
  const sortedDqs = sortDisqualifications(disqualifications);
  const sortedBlockers = sortBlockers(blockers2);
  return {
    accounting: buildReliabilityAccounting({
      input,
      index,
      selectedByTest,
      disqualifications: sortedDqs,
      blockers: sortedBlockers,
      safetyBlockers: safety,
      drillDown,
      qualifiedRiskIds,
      passingRiskIds
    }),
    disqualifications: sortedDqs,
    blockers: sortedBlockers
  };
}

// src/gate/waivers.ts
function validateWaiver(waiver, graph, executionTime) {
  const reasons = [];
  const riskIds = new Set(
    graph.nodes.filter((node) => node.kind === "risk").map((node) => node.id)
  );
  for (const riskId of waiver.linkedRiskIds) {
    if (!riskIds.has(riskId)) {
      reasons.push(`linkedRiskId "${riskId}" does not resolve to a risk node`);
    }
  }
  if (!waiver.approvalAuthority || waiver.approvalAuthority.trim() === "") {
    reasons.push("approvalAuthority is empty");
  }
  if (!waiver.sourceRefs || waiver.sourceRefs.length === 0) {
    reasons.push("sourceRefs is empty (minimum 1 required)");
  }
  if (new Date(waiver.expiry) < executionTime) {
    reasons.push(`expiry "${waiver.expiry}" is past execution time`);
  }
  if (!waiver.impactScope || waiver.impactScope.trim() === "") {
    reasons.push("impactScope is empty");
  }
  if (!waiver.rollbackOrContainment || waiver.rollbackOrContainment.trim() === "") {
    reasons.push("rollbackOrContainment is empty");
  }
  if (!waiver.followUpOwner || waiver.followUpOwner.trim() === "") {
    reasons.push("followUpOwner is empty");
  }
  if (!waiver.recheckCondition || waiver.recheckCondition.trim() === "") {
    reasons.push("recheckCondition is empty");
  }
  if (!waiver.reason || waiver.reason.trim() === "") {
    reasons.push("reason is empty");
  }
  return reasons.length > 0 ? { valid: false, invalidReason: reasons.join("; ") } : { valid: true };
}

// src/gate/evaluate.ts
function evaluateGate(input) {
  const executionMs = Date.parse(input.metadata.createdAt);
  const clockDqs = Number.isFinite(executionMs) ? [] : [{
    code: "DQ-01",
    message: `metadata.createdAt is not a parseable evaluation clock: ${input.metadata.createdAt}`,
    nodeIds: [],
    sourceRefs: [{ id: "qeg:evaluation-clock", path: "docs/spec/reliability-extension.md" }]
  }];
  const executionTime = new Date(executionMs);
  const validWaivers = Number.isFinite(executionMs) ? input.waivers.filter(
    (waiver) => validateWaiver(waiver, input.graph, executionTime).valid
  ) : [];
  const context = createGateEvaluationContext({
    ...input,
    preflightDisqualifications: [...input.preflightDisqualifications ?? [], ...clockDqs]
  }, validWaivers);
  const reliability = evaluateReliability(context);
  const enrichedContext = { ...context, blockers: [...context.blockers, ...reliability.blockers] };
  const disqualifications = [...detectAllDQs(enrichedContext), ...reliability.disqualifications];
  const blockers2 = enrichedContext.blockers;
  const residualRisks = computeResidualRisks(enrichedContext);
  const requiredHumanReview = computeRequiredHumanReview(input.graph, validWaivers, residualRisks);
  const verdict = computeVerdict(
    disqualifications,
    blockers2,
    residualRisks,
    requiredHumanReview,
    validWaivers
  );
  return {
    metadata: input.metadata,
    verdict,
    reasons: buildReasons(
      verdict,
      disqualifications,
      blockers2,
      residualRisks,
      requiredHumanReview,
      validWaivers
    ),
    disqualifications,
    blockers: blockers2,
    residualRisks,
    requiredHumanReview,
    testEvidenceAccounting: buildTestEvidenceAccounting(input.graph),
    reliability: reliability.accounting
  };
}

// src/cli/baseline.ts
import { readFile as readFile6, stat as stat3 } from "fs/promises";
import { relative as relative4, resolve as resolve5 } from "path";
import { exit as exit3 } from "process";

// src/cli/errors.ts
var CliError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "CliError";
  }
  cause;
};

// src/cli/report/targets.ts
import { readdir, stat } from "fs/promises";
import { join, relative, resolve } from "path";
async function safeStat(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}
function portable(path) {
  return path.split(String.fromCharCode(92)).join("/");
}
function relativeTarget(target) {
  return portable(relative(process.cwd(), target));
}
async function isFixtureLikeDirectory(path) {
  const input = await safeStat(join(path, "gate-input.json"));
  const expected = await safeStat(join(path, "expected-gate-verdict.json"));
  return Boolean(input?.isFile() || expected?.isFile());
}
async function collectChildFixtures(path, children) {
  const fixtures = [];
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const childPath = join(path, child.name);
    if (await isFixtureLikeDirectory(childPath)) {
      fixtures.push(childPath);
    }
  }
  return fixtures.sort();
}
async function collectReportTargets(rawTargets) {
  const targets = [];
  for (const rawTarget of rawTargets) {
    const target = resolve(rawTarget);
    const targetStat = await safeStat(target);
    if (!targetStat?.isDirectory()) {
      targets.push(target);
      continue;
    }
    if (await isFixtureLikeDirectory(target)) {
      targets.push(target);
      continue;
    }
    const childFixtures = await collectChildFixtures(target, await readdir(target, { withFileTypes: true }));
    targets.push(...childFixtures.length > 0 ? childFixtures : [target]);
  }
  return [...new Set(targets)];
}

// src/cli/report/core.ts
import { join as join5 } from "path";

// src/cli/dq-explain.ts
import { exit } from "process";
var DQ_EXPLANATIONS = {
  "DQ-01": {
    code: "DQ-01",
    title: "Parser or ingest failure",
    meaning: "QEG could not safely ingest one or more required inputs.",
    commonCauses: ["Missing or invalid gate-input.json", "External artifact carries direct gate_policy", "Malformed upstream artifact"],
    requiredEvidence: ["Valid gate-input.json", "Parser failure sourceRefs when converted into QEG completeness.parserFailures"],
    minimalFix: ["Fix the malformed input", "Regenerate gate-input.json", "Use gatePolicyProposal for external policy proposals"],
    references: ["docs/spec/node-identity-contract.md", "docs/spec/gate-policy.md"],
    remediation: "Fix parser/input failures and make required gate artifacts available before QEG runs."
  },
  "DQ-02": {
    code: "DQ-02",
    title: "Gate blocker has no sourceRefs",
    meaning: "A gate-relevant blocker exists but cannot be audited back to source evidence.",
    commonCauses: ["Risk sourceRefs are empty", "Generated blocker lost traceability"],
    requiredEvidence: ["sourceRefs on each blocker or source risk"],
    minimalFix: ["Add sourceRefs to the risk or blocker source", "Regenerate the QEG graph"],
    references: ["docs/requirements.md", "docs/spec/gate-policy.md"],
    remediation: "Add sourceRefs to each gate-relevant blocker so the release decision is auditable."
  },
  "DQ-03": {
    code: "DQ-03",
    title: "Unsupported gate-relevant claim",
    meaning: "A claim that affects the Gate is not backed by source evidence.",
    commonCauses: ["Assumption promoted to fact", "Generated claim lacks sourceRefs"],
    requiredEvidence: ["Source-backed claim", "Non-gate-relevant classification when the claim is advisory only"],
    minimalFix: ["Add sourceRefs for the claim", "Remove or downgrade unsupported gate-relevant claims"],
    references: ["docs/requirements.md"],
    remediation: "Replace gate-relevant unsupported claims with source-backed evidence or mark them non-gate-relevant."
  },
  "DQ-04": {
    code: "DQ-04",
    title: "P0/P1 oracle gap treated as fact",
    meaning: "A high-priority risk has a large evidence gap without review note or accepted waiver.",
    commonCauses: ["Manual oracle gap is unreviewed", "Waiver was missing or invalid"],
    requiredEvidence: ["Reviewer note", "Accepted waiver", "Manual evidence closing the oracle gap"],
    minimalFix: ["Add reviewerNote to matching manual evidence", "Provide a valid source-backed waiver", "Close the evidence gap"],
    references: ["docs/spec/waiver-approval.md", "docs/spec/evidence-package.md"],
    remediation: "Add reviewer notes or accepted waivers for P0/P1 oracle gaps, or close the evidence gap."
  },
  "DQ-05": {
    code: "DQ-05",
    title: "Changed code without test obligation",
    meaning: "Changed code is present but QEG cannot find a test placement or accepted waiver.",
    commonCauses: ["placementPlan missing", "All placements blocked", "No valid waiver"],
    requiredEvidence: ["TestPlacementPlan with non-blocked placement", "Accepted waiver tied to changed-code risk"],
    minimalFix: ["Add placement obligations for changed code", "Provide accepted waiver with sourceRefs"],
    references: ["docs/spec/acceptance.md", "docs/project/runbook.md"],
    remediation: "Add test placement obligations for changed code, or provide an accepted waiver."
  },
  "DQ-06": {
    code: "DQ-06",
    title: "Evidence hash mismatch",
    meaning: "Recorded evidence hash does not match the artifact used for release judgment.",
    commonCauses: ["Artifact regenerated without record update", "Wrong input path", "Silent overwrite"],
    requiredEvidence: ["Matching contentHash", "Artifact revision matching metadata"],
    minimalFix: ["Regenerate evidence package", "Recompute hashes", "Use immutable/versioned storage"],
    references: ["docs/spec/evidence-package.md", "docs/spec/retention-immutability.md"],
    remediation: "Regenerate or relink evidence artifacts so recorded content hashes match actual inputs."
  },
  "DQ-07": {
    code: "DQ-07",
    title: "Partial graph without completeness score",
    meaning: "The graph is marked partial but does not quantify completeness.",
    commonCauses: ["Partial ingest", "Missing completeness.score"],
    requiredEvidence: ["completeness.score between 0 and 1"],
    minimalFix: ["Set completeness.score", "Complete the graph ingest"],
    references: ["schemas/qeg.bundle.schema.json"],
    remediation: "Record an explicit completeness score when using a partial graph."
  },
  "DQ-08": {
    code: "DQ-08",
    title: "Manual evidence incomplete",
    meaning: "Manual evidence lacks expected result, oracle refs, traceability, or evidence refs.",
    commonCauses: ["Manual case result copied without oracle", "Missing screenshot/log/reference"],
    requiredEvidence: ["expectedResult", "oracleRefs", "traceTo", "evidenceRefs"],
    minimalFix: ["Complete manualEvidence entries", "Attach source-backed oracle and execution evidence"],
    references: ["docs/spec/evidence-package.md"],
    remediation: "Complete manual evidence with expectedResult, oracleRefs, traceTo, and evidenceRefs."
  },
  "DQ-09": {
    code: "DQ-09",
    title: "Unredacted sensitive value",
    meaning: "Evidence package appears to contain a secret or sensitive value.",
    commonCauses: ["Token/password/API key in artifact", "Email or private identifier in evidence"],
    requiredEvidence: ["Redacted evidence package", "Regenerated record after redaction"],
    minimalFix: ["Redact sensitive values", "Rotate exposed credentials if needed", "Regenerate QEG record"],
    references: ["docs/requirements.md"],
    remediation: "Redact sensitive values from the evidence package and regenerate the record."
  },
  "DQ-10": {
    code: "DQ-10",
    title: "Hidden oracle accessed",
    meaning: "Benchmark mode evidence indicates hidden oracle access.",
    commonCauses: ["Candidate used forbidden oracle data", "benchmarkMode set with hiddenOracleAccessed"],
    requiredEvidence: ["Clean benchmark run", "No hidden oracle access flag"],
    minimalFix: ["Remove hidden oracle access", "Rerun benchmark evidence"],
    references: ["docs/requirements.md"],
    remediation: "Remove hidden-oracle access from benchmark-mode runs and regenerate evidence."
  },
  "DQ-11": {
    code: "DQ-11",
    title: "Required connector contract violation",
    meaning: "A required connector reported contract_violation but the run treated it as success.",
    commonCauses: ["Required adapter output invalid", "Connector status copied as success incorrectly"],
    requiredEvidence: ["Required connector status success", "Contract-compliant adapter artifact"],
    minimalFix: ["Fix connector output", "Mark failed connector honestly and rerun"],
    references: ["docs/requirements.md"],
    remediation: "Fix required connector contract violations before treating connector output as successful."
  },
  "DQ-12": {
    code: "DQ-12",
    title: "Producer evidence identity mismatch",
    meaning: "Input artifact revision or producer check identity/verdict does not match metadata.headRef and exported readiness.",
    commonCauses: ["Artifact from a different commit", "headRef updated without regenerating evidence", "Producer check attached to a stale SHA", "Producer check conclusion contradicts its readiness artifact"],
    requiredEvidence: ["Artifact revision equal to headRef", "Producer check headSha equal to headRef", "Producer check conclusion consistent with readiness status"],
    minimalFix: ["Regenerate artifacts from current head", "Correct metadata headRef", "Attach producer checks to the PR head SHA", "Align producer check conclusion with readiness status"],
    references: ["docs/spec/evidence-package.md"],
    remediation: "Regenerate artifacts and producer checks from the same headRef, then ensure producer conclusions reflect their readiness status."
  },
  "DQ-13": {
    code: "DQ-13",
    title: "Evidence package sourceRefs empty",
    meaning: "The evidence package cannot be audited back to its source.",
    commonCauses: ["sourceRefs omitted", "Record generated from detached data"],
    requiredEvidence: ["evidencePackage.sourceRefs with at least one sourceRef"],
    minimalFix: ["Add sourceRefs to evidencePackage", "Regenerate record"],
    references: ["schemas/evidence-package.schema.json"],
    remediation: "Add sourceRefs to the evidence package."
  },
  "DQ-14": {
    code: "DQ-14",
    title: "Manual oracle or placement-change gap",
    meaning: "Manual-scripted placement, manual retirement, or revert condition lacks required evidence.",
    commonCauses: ["No human-review oracle", "Manual case retired without evidence_refs", "Replacement test degraded without restoration"],
    requiredEvidence: ["Human-review oracle", "placement_changes[].evidence_refs", "source-backed retirement policy", "revert evidence"],
    minimalFix: ["Add manual oracle", "Record placement_change evidence", "Restore manual case or fix replacement tests"],
    references: ["docs/spec/acceptance.md", "docs/spec/gate-policy.md"],
    remediation: "Add source-backed manual oracle or placement-change retirement/revert evidence."
  },
  "DQ-15": {
    code: "DQ-15",
    title: "Policy, waiver, or approval evidence integrity failure",
    meaning: "IPO controlled release judgment is missing or mismatching governance evidence.",
    commonCauses: [
      "release_decision phase has no approvalEvidence",
      "Gate policy hash differs from evidencePackage.gatePolicy.policyHash",
      "Approval evidence policyHash or evidencePackageHash mismatch",
      "Waiver lacks sourceRefs"
    ],
    requiredEvidence: [
      "evidencePackage.approvalEvidence[] for release_decision",
      "approvalEvidence.policyId matching gate policy",
      "approvalEvidence.policyHash matching gate policy hash",
      "approvalEvidence.evidencePackageHash matching evidence package hash",
      "sourceRefs on waivers and approvals"
    ],
    minimalFix: [
      "Add approvalEvidence for the release decision",
      "Regenerate policy/evidence hashes from the same package",
      "Attach sourceRefs to waiver and approval records",
      "Rerun qeg report to confirm DQ-15 is gone"
    ],
    references: ["docs/spec/waiver-approval.md", "docs/spec/evidence-package.md", "docs/spec/gate-policy.md"],
    remediation: "Provide source-backed waiver, policy hash, and approval evidence that match the evidence package."
  },
  "DQ-16": {
    code: "DQ-16",
    title: "Release evidence stored only in mutable storage",
    meaning: "Release judgment relies on evidence that can be silently overwritten.",
    commonCauses: ["storageClassification is mutable", "No immutable/versioned retention"],
    requiredEvidence: ["immutable, append_only, or versioned storageClassification", "Tamper evidence"],
    minimalFix: ["Move release evidence to immutable storage", "Update retention metadata"],
    references: ["docs/spec/retention-immutability.md"],
    remediation: "Move release evidence to immutable, append-only, or versioned storage before using it for release judgment."
  },
  "DQ-17": {
    code: "DQ-17",
    title: "Control roles missing",
    meaning: "IPO controlled profile requires recorded producer/reviewer/approver/waiverApprover/releaseOwner roles.",
    commonCauses: ["evidencePackage.controlRoles omitted", "Role split not recorded"],
    requiredEvidence: ["producer", "reviewer", "approver", "waiverApprover", "releaseOwner"],
    minimalFix: ["Add evidencePackage.controlRoles", "Regenerate evidence record"],
    references: ["docs/spec/evidence-package.md", "docs/ipo-controlled-profile.md"],
    remediation: "Record producer, reviewer, approver, waiverApprover, and releaseOwner control roles."
  },
  "DQ-18": {
    code: "DQ-18",
    title: "Resilience evidence is stale, future-dated, or has an invalid lifecycle",
    meaning: "The selected resilience execution cannot be used at the recorded Gate evaluation time.",
    commonCauses: ["Evidence exceeds the policy age", "endedAt is after the evaluation clock", "Fault/steady-state/recovery lifecycle is incomplete"],
    requiredEvidence: ["Recorded metadata.createdAt", "Started/ended timestamps", "Scenario lifecycle observations"],
    minimalFix: ["Run a current real experiment", "Correct the lifecycle evidence"],
    references: ["docs/spec/reliability-extension.md"],
    remediation: "Provide a current, internally consistent real resilience execution."
  },
  "DQ-19": {
    code: "DQ-19",
    title: "Ambiguous current resilience evidence selection",
    meaning: "Two equally latest current executions disagree, so a safe evidence choice is impossible.",
    commonCauses: ["Same endedAt with different decision fingerprints", "Duplicate adapter attempts"],
    requiredEvidence: ["Canonical, uniquely selected latest execution"],
    minimalFix: ["Resolve or supersede the conflicting executions", "Regenerate the evidence graph"],
    references: ["docs/spec/reliability-extension.md"],
    remediation: "Eliminate the current-evidence ambiguity; QEG never falls back to an older pass."
  },
  "DQ-20": {
    code: "DQ-20",
    title: "Required resilience signal is absent or inconsistent",
    meaning: "Metrics, traces, logs, or signal evidence references cannot support the scenario judgment.",
    commonCauses: ["Missing required metric", "Signal reference revision differs", "Wrong phase or semantic role"],
    requiredEvidence: ["Hash-backed signal manifest", "Required scenario and policy signals"],
    minimalFix: ["Publish the missing signals", "Correct the manifest and rerun"],
    references: ["docs/spec/reliability-extension.md"],
    remediation: "Supply hash-backed required signals whose phase and revision match the experiment."
  },
  "DQ-21": {
    code: "DQ-21",
    title: "Reliability policy identity or integrity mismatch",
    meaning: "The Gate, graph, and policy do not name the same immutable reliability policy and revision.",
    commonCauses: ["Short SHA", "Policy hash mismatch", "Profile or policy ID mismatch"],
    requiredEvidence: ["Full Git object ID", "SHA-256 policy hash", "Matching policy identity in all three locations"],
    minimalFix: ["Regenerate the policy and graph metadata from one revision"],
    references: ["docs/spec/reliability-extension.md"],
    remediation: "Align the recorded revision, profile, policy ID, and SHA-256 policy hash."
  }
};
function isDisqualificationCode(value) {
  return /^DQ-(0[1-9]|1[0-9]|2[0-1])$/.test(value);
}
function getDqExplanation(code) {
  return DQ_EXPLANATIONS[code];
}
function formatExplanationText(explanation) {
  const lines = [
    `${explanation.code}: ${explanation.title}`,
    "",
    "Meaning",
    `- ${explanation.meaning}`,
    "",
    "Common causes",
    ...explanation.commonCauses.map((cause) => `- ${cause}`),
    "",
    "Required evidence",
    ...explanation.requiredEvidence.map((evidence) => `- ${evidence}`),
    "",
    "Minimal fix",
    ...explanation.minimalFix.map((fix) => `- ${fix}`),
    "",
    "References",
    ...explanation.references.map((reference) => `- ${reference}`)
  ];
  return `${lines.join("\n")}
`;
}
async function runExplainCommand(args) {
  const [rawCode, ...rest] = args;
  const json = rest.includes("--json");
  if (!rawCode || !isDisqualificationCode(rawCode)) {
    throw new CliError("Usage: qeg explain <DQ-01..DQ-21> [--json]");
  }
  const explanation = getDqExplanation(rawCode);
  console.log(json ? JSON.stringify(explanation, null, 2) : formatExplanationText(explanation).trimEnd());
  exit(0);
}

// src/cli/fixture-io.ts
import { readFile as readFile3 } from "fs/promises";
import { join as join3, resolve as resolve3 } from "path";

// src/cli/ingest-contract.ts
var RESERVED_PRODUCERS = /* @__PURE__ */ new Set(["rand", "ctg", "mbb", "hate", "qeg"]);
var ID_FIELD_NAMES = /* @__PURE__ */ new Set([
  "id",
  "runId",
  "nodeId",
  "obligationId",
  "acceptanceId",
  "taskId",
  "policyId",
  "policy_ref",
  "executedCaseId",
  "subject_id"
]);
var ID_ARRAY_FIELD_NAMES = /* @__PURE__ */ new Set([
  "nodeIds",
  "riskIds",
  "requirementIds",
  "acceptanceCriteriaIds",
  "failureModeIds",
  "changedCodeIds",
  "sourceArtifactIds",
  "selectedTestIds",
  "replacement_ids",
  "linkedRiskIds",
  "traceTo",
  "previous_subject_ids",
  "current_subject_ids"
]);
var DIRECT_POLICY_KEYS = /* @__PURE__ */ new Set(["gate_policy", "gatePolicy"]);
var PROPOSAL_KEYS = /* @__PURE__ */ new Set([
  "gate_policy_proposal",
  "gatePolicyProposal",
  "policy_proposal",
  "policyProposal",
  "policyProposals"
]);
function sourceRefFor(path) {
  return {
    id: "qeg:source-ingest-contract",
    path: "docs/spec/node-identity-contract.md",
    label: path
  };
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pathString(path) {
  return path.join(".");
}
function isProposalPath(path) {
  return path.some((part) => PROPOSAL_KEYS.has(part));
}
function isQegOwnedGatePolicy(path, key) {
  return key === "gatePolicy" && pathString(path) === "gate-input.json.evidencePackage";
}
function validateNamespacedId(value, path, warnings) {
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1) {
    warnings.push(`Deprecated prefixless ID at ${path}: "${value}"`);
    return;
  }
  const producer = value.slice(0, colonIndex);
  const localId = value.slice(colonIndex + 1);
  if (!RESERVED_PRODUCERS.has(producer)) {
    throw new CliError(
      `Unknown ID producer prefix "${producer}" at ${path}; reserved prefixes are rand, ctg, mbb, hate, qeg`
    );
  }
  if (localId.length === 0) {
    throw new CliError(`Namespaced ID at ${path} must use <producer>:<local-id> with a non-empty local-id`);
  }
}
function inspectIdField(key, value, path, warnings) {
  const pathLabel = pathString(path);
  if (ID_FIELD_NAMES.has(key) && typeof value === "string") {
    validateNamespacedId(value, pathLabel, warnings);
  }
  if (ID_ARRAY_FIELD_NAMES.has(key) && Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (typeof value[index] === "string") {
        validateNamespacedId(value[index], `${pathLabel}[${index}]`, warnings);
      }
    }
  }
}
function inspectRawValue(value, path, parserFailures, warnings) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      inspectRawValue(value[index], [...path, String(index)], parserFailures, warnings);
    }
    return;
  }
  if (!isObject2(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    inspectIdField(key, child, childPath, warnings);
    if (DIRECT_POLICY_KEYS.has(key) && !isProposalPath(path) && !isQegOwnedGatePolicy(path, key)) {
      const location = pathString(childPath);
      parserFailures.push({
        path: location,
        reason: "External artifact carried gate_policy directly; QEG is the sole Gate policy source of truth and external policy must be explicit proposal-only",
        sourceRefs: [sourceRefFor(location)]
      });
    }
    inspectRawValue(child, childPath, parserFailures, warnings);
  }
}
function validateIngestContract(rawInput) {
  const parserFailures = [];
  const warnings = [];
  inspectRawValue(rawInput, ["gate-input.json"], parserFailures, warnings);
  return { parserFailures, warnings };
}

// src/validation/schema.ts
var import__ = __toESM(require__(), 1);
import { readdir as readdir2, readFile } from "fs/promises";
import { basename, join as join2 } from "path";
import { fileURLToPath } from "url";
var DEFAULT_SCHEMA_DIR = fileURLToPath(new URL("../../schemas/", import.meta.url));
var defaultRegistry;
function issueScope(path) {
  const segment = path.split("/").filter(Boolean)[0];
  if (segment === "metadata" || segment === "graph" || segment === "policy" || segment === "evidencePackage" || segment === "placementPlan" || segment === "optionalEvidence") return segment;
  if (segment === "waivers") return "waiver";
  return "envelope";
}
function formatSchemaErrors(errors) {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message ?? "schema validation failed",
    scope: issueScope(error.instancePath || "/")
  }));
}
async function schemaFiles(schemaDir) {
  return (await readdir2(schemaDir)).filter((file) => file.endsWith(".schema.json")).sort().map((file) => join2(schemaDir, file));
}
async function loadSchemaRegistry(schemaDir = DEFAULT_SCHEMA_DIR) {
  if (schemaDir === DEFAULT_SCHEMA_DIR && defaultRegistry) return defaultRegistry;
  const load = (async () => {
    const ajv = new import__.Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    const schemas = /* @__PURE__ */ new Map();
    for (const file of await schemaFiles(schemaDir)) {
      const schema = JSON.parse(await readFile(file, "utf-8"));
      schemas.set(basename(file), schema);
      ajv.addSchema(schema);
    }
    const validators = /* @__PURE__ */ new Map();
    for (const [name, schema] of schemas) {
      const id = typeof schema === "object" && schema !== null && "$id" in schema ? String(schema.$id) : name;
      validators.set(name, ajv.getSchema(id) ?? ajv.compile(schema));
    }
    return { ajv, validators, schemaDir };
  })();
  if (schemaDir === DEFAULT_SCHEMA_DIR) defaultRegistry = load;
  return load;
}
async function validateGateInput(raw) {
  const { validators } = await loadSchemaRegistry();
  const validator = validators.get("gate-input.schema.json");
  if (!validator) {
    return { reportVersion: "qeg-gate-input-validation-v2", valid: false, issues: [{ path: "/", keyword: "schema", message: "gate-input.schema.json is unavailable", scope: "envelope" }], warnings: [] };
  }
  validator(raw);
  const semanticIssues = validateReliabilitySemantics(raw).map((issue) => ({
    path: issue.path,
    keyword: issue.ruleId,
    message: issue.message,
    scope: issueScope(issue.path)
  }));
  const allIssues = [...formatSchemaErrors(validator.errors), ...semanticIssues];
  const warnings = allIssues.filter((issue) => issue.scope === "optionalEvidence");
  const issues = allIssues.filter((issue) => issue.scope !== "optionalEvidence");
  const valid = issues.length === 0;
  let input;
  if (valid && raw && typeof raw === "object" && !Array.isArray(raw)) {
    const sanitized = { ...raw };
    if (warnings.length > 0) delete sanitized.optionalEvidence;
    input = sanitized;
  }
  return { reportVersion: "qeg-gate-input-validation-v2", valid, issues, warnings, ...input ? { input } : {} };
}

// src/validation/evidence.ts
import { createHash as createHash2 } from "crypto";
import { readFile as readFile2, realpath, stat as stat2 } from "fs/promises";
import { isAbsolute, relative as relative2, resolve as resolve2 } from "path";
var OPTIONAL_ADAPTERS = /* @__PURE__ */ new Set(["junit", "coverage", "sarif", "git-diff"]);
async function isFile(path) {
  try {
    return (await stat2(path)).isFile();
  } catch {
    return false;
  }
}
function hash(bytes) {
  return "sha256:" + createHash2("sha256").update(bytes).digest("hex");
}
function severity(strict, required) {
  return strict && required ? "fail" : "warn";
}
function isOutsideBase(offset) {
  return offset === "" || offset === ".." || offset.startsWith("../") || offset.startsWith("..\\") || isAbsolute(offset);
}
function isResilienceEvidence2(node) {
  return Boolean(node) && typeof node === "object" && node.kind === "execution_evidence" && node.evidenceType === "resilience";
}
function allArtifacts(input) {
  const candidates = input.metadata.inputArtifacts.map((artifact) => ({
    artifact,
    required: !OPTIONAL_ADAPTERS.has(artifact.adapter)
  }));
  if (input.evidencePackage) {
    candidates.push(...input.evidencePackage.inputArtifactHashes.map((artifact) => ({
      artifact,
      required: !OPTIONAL_ADAPTERS.has(artifact.adapter)
    })));
    for (const [name, artifact] of Object.entries(input.evidencePackage.qegOutputs)) {
      if (artifact) candidates.push({ artifact, required: name !== "markdownSummary" });
    }
  }
  for (const evidence of input.graph.nodes.filter(isResilienceEvidence2)) {
    candidates.push({ artifact: evidence.rawArtifactRef, required: true, requireContainedRelativePath: true });
    for (const signalRef of evidence.evidenceRefs) {
      candidates.push({ artifact: signalRef, required: true, requireContainedRelativePath: true });
    }
  }
  return candidates;
}
function uniqueArtifacts(input) {
  const byKey = /* @__PURE__ */ new Map();
  for (const candidate of allArtifacts(input)) {
    const artifact = candidate.artifact;
    const key = [artifact.id, artifact.path, artifact.contentHash ?? "", artifact.revision ?? "", candidate.requireContainedRelativePath ? "contained" : "legacy"].join(String.fromCharCode(0));
    const previous = byKey.get(key);
    byKey.set(key, previous ? {
      artifact,
      required: previous.required || candidate.required,
      requireContainedRelativePath: previous.requireContainedRelativePath || candidate.requireContainedRelativePath
    } : candidate);
  }
  return [...byKey.values()];
}
async function verifyEvidenceArtifacts(input, options) {
  const strict = options.strict ?? (input.metadata.profile === "strict" || input.metadata.profile === "ipo_controlled");
  const baseDir = resolve2(options.baseDir);
  let realBaseDir = baseDir;
  try {
    realBaseDir = await realpath(baseDir);
  } catch {
  }
  const items = [];
  for (const { artifact, required, requireContainedRelativePath } of uniqueArtifacts(input)) {
    const failureSeverity = severity(strict || Boolean(requireContainedRelativePath), required);
    if (!artifact.path) {
      items.push({ artifactId: artifact.id, severity: failureSeverity, code: "PATH_MISSING", message: "artifact path is missing" });
      continue;
    }
    if (requireContainedRelativePath && isAbsolute(artifact.path)) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PATH_OUTSIDE_BASE", message: "resilience artifact path must be relative to the Gate target directory" });
      continue;
    }
    const path = isAbsolute(artifact.path) ? artifact.path : resolve2(baseDir, artifact.path);
    const lexicalRelative = relative2(baseDir, path);
    if (requireContainedRelativePath && isOutsideBase(lexicalRelative)) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PATH_OUTSIDE_BASE", message: "resilience artifact path escapes the Gate target directory" });
      continue;
    }
    if (!await isFile(path)) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "FILE_MISSING", message: "artifact file does not exist: " + artifact.path });
      continue;
    }
    if (requireContainedRelativePath) {
      const realArtifactPath = await realpath(path);
      const actualRelative = relative2(realBaseDir, realArtifactPath);
      if (isOutsideBase(actualRelative)) {
        items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PATH_OUTSIDE_BASE", message: "resilience artifact symlink escapes the Gate target directory" });
        continue;
      }
    }
    if (!artifact.contentHash) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "HASH_MISSING", message: "artifact contentHash is missing" });
    } else {
      const actual = hash(await readFile2(path));
      items.push(actual === artifact.contentHash ? { artifactId: artifact.id, path: artifact.path, severity: "pass", code: "VERIFIED", message: "artifact path and hash verified" } : { artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "HASH_MISMATCH", message: "artifact hash mismatch: expected " + artifact.contentHash + ", got " + actual });
    }
    if (input.metadata.headRef && artifact.revision && artifact.revision !== input.metadata.headRef) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "REVISION_MISMATCH", message: "artifact revision " + artifact.revision + " does not match " + input.metadata.headRef });
    }
  }
  const status = items.some((item) => item.severity === "fail") ? "fail" : items.some((item) => item.severity === "warn") ? "warn" : "pass";
  return { reportVersion: "qeg-evidence-verification-v2", status, items };
}

// src/cli/fixture-io.ts
var SchemaGateInputError = class extends Error {
  constructor(raw, report) {
    super("gate-input.json failed runtime schema validation");
    this.raw = raw;
    this.report = report;
  }
  raw;
  report;
};
async function readJsonFile(path) {
  return JSON.parse(await readFile3(path, "utf-8"));
}
function isObject3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function withParserFailures(input, parserFailures) {
  if (parserFailures.length === 0) return input;
  return { ...input, graph: { ...input.graph, completeness: { ...input.graph.completeness, parserFailures: [...input.graph.completeness.parserFailures, ...parserFailures] } } };
}
function emitDeprecationWarnings(warnings) {
  for (const warning of warnings.slice(0, 5)) console.warn(`Warning: ${warning}`);
  if (warnings.length > 5) console.warn(`Warning: ${warnings.length - 5} additional prefixless IDs accepted during deprecation period`);
}
async function readExpectedVerdict(fixtureDir) {
  try {
    return await readJsonFile(join3(fixtureDir, "expected-gate-verdict.json"));
  } catch (error) {
    throw new CliError(`Error reading expected verdict: ${error}`, error instanceof Error ? error : void 0);
  }
}
async function loadFixtureInput(fixtureDir, options = {}) {
  const inputPath = join3(fixtureDir, "gate-input.json");
  let raw;
  try {
    raw = await readJsonFile(inputPath);
  } catch (error) {
    throw new CliError(`gate-input.json not found or invalid
Input file: ${inputPath}
Error: ${error}`, error instanceof Error ? error : void 0);
  }
  if (!isObject3(raw) || !isObject3(raw.metadata) || !isObject3(raw.graph) || !isObject3(raw.policy)) {
    throw new CliError(`gate-input.json envelope is invalid
Input file: ${inputPath}`);
  }
  const schema = await validateGateInput(raw);
  if (!schema.valid || !schema.input) throw new SchemaGateInputError(raw, schema);
  if (!options.quiet) {
    for (const warning of schema.warnings) console.warn("Warning: optional artifact " + warning.path + " " + warning.message);
  }
  const ingest = validateIngestContract(raw);
  if (!options.quiet) emitDeprecationWarnings(ingest.warnings);
  return { input: withParserFailures(schema.input, ingest.parserFailures), schema };
}
function fallbackMetadata(raw) {
  const source = isObject3(raw.metadata) ? raw.metadata : {};
  return {
    qegVersion: "0.2",
    runId: typeof source.runId === "string" ? source.runId : "qeg:invalid-input",
    createdAt: typeof source.createdAt === "string" ? source.createdAt : "1970-01-01T00:00:00.000Z",
    profile: source.profile === "lean" || source.profile === "standard" || source.profile === "strict" || source.profile === "ipo_controlled" ? source.profile : "strict",
    inputArtifacts: []
  };
}
function fallbackPolicy(raw, metadata) {
  const source = isObject3(raw.policy) ? raw.policy : {};
  return {
    policyId: typeof source.policyId === "string" ? source.policyId : "qeg:invalid-policy",
    policyHash: typeof source.policyHash === "string" ? source.policyHash : "sha256:invalid",
    profile: metadata.profile,
    effectiveDate: typeof source.effectiveDate === "string" ? source.effectiveDate : "1970-01-01T00:00:00.000Z",
    approver: typeof source.approver === "string" ? source.approver : "qeg-runtime-validator",
    sourceRefs: [{ id: "qeg:schema-validation", path: "schemas/gate-input.schema.json" }],
    dqScope: ["DQ-01", "DQ-02", "DQ-03", "DQ-04", "DQ-05", "DQ-06", "DQ-07", "DQ-08", "DQ-09", "DQ-10", "DQ-11", "DQ-12", "DQ-13", "DQ-14", "DQ-15", "DQ-16", "DQ-17", "DQ-18", "DQ-19", "DQ-20", "DQ-21"],
    exitCodePolicy: { go: 0, conditional_go: 2, no_go: 2, disqualified: 2 }
  };
}
function schemaInvalidEvaluation(fixtureDir, error) {
  const metadata = fallbackMetadata(error.raw);
  const policy = fallbackPolicy(error.raw, metadata);
  const graph = { metadata, nodes: [], edges: [], completeness: { score: 1, partial: false, parserFailures: [], unsupportedClaims: [] } };
  const preview = error.report.issues.slice(0, 5).map((issue) => `${issue.path} ${issue.message}`).join("; ");
  const dq2 = { code: "DQ-01", message: `Gate input schema invalid: ${preview}`, nodeIds: [], sourceRefs: [{ id: "qeg:schema-validation", path: "schemas/gate-input.schema.json" }] };
  return {
    fixtureDir,
    metadata,
    graph,
    policy,
    waivers: [],
    evidencePackage: void 0,
    placementPlan: void 0,
    optionalEvidence: void 0,
    gateResult: evaluateGate({ metadata, graph, policy, waivers: [], preflightDisqualifications: [dq2] }),
    schemaValidation: error.report
  };
}
function evidenceDq(report) {
  const failures = report.items.filter((item) => item.severity === "fail" && item.code !== "REVISION_MISMATCH");
  if (failures.length === 0) return [];
  return [{
    code: "DQ-06",
    message: failures.map((item) => `${item.artifactId}: ${item.message}`).join("; "),
    nodeIds: [...new Set(failures.map((item) => item.artifactId))],
    sourceRefs: [{ id: "qeg:evidence-verification", path: "src/validation/evidence.ts" }]
  }];
}
async function evaluateFixture(rawFixtureDir, options = {}) {
  const fixtureDir = resolve3(rawFixtureDir);
  let input;
  let schemaValidation;
  try {
    const loaded = await loadFixtureInput(fixtureDir, options);
    input = loaded.input;
    schemaValidation = loaded.schema;
  } catch (error) {
    if (error instanceof SchemaGateInputError) return schemaInvalidEvaluation(fixtureDir, error);
    throw error;
  }
  const waivers = [...input.waivers ?? []];
  const evidenceVerification = await verifyEvidenceArtifacts(input, { baseDir: fixtureDir });
  if (!options.quiet) console.error("Using gate-input.json (runtime schema and evidence preflight complete)");
  return {
    fixtureDir,
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
    optionalEvidence: input.optionalEvidence,
    gateResult: evaluateGate({
      metadata: input.metadata,
      graph: input.graph,
      policy: input.policy,
      waivers,
      evidencePackage: input.evidencePackage,
      placementPlan: input.placementPlan,
      evidenceVerification,
      preflightDisqualifications: evidenceDq(evidenceVerification)
    }),
    schemaValidation,
    evidenceVerification
  };
}

// src/cli/validation.ts
function sortedDqCodes(disqualifications) {
  return disqualifications.map((disqualification) => disqualification.code).filter((code) => code !== void 0).sort();
}
function dqCodesMatch(expectedCodes, actualCodes, mode) {
  if (mode === "includes") {
    return expectedCodes.every((code) => actualCodes.includes(code));
  }
  return expectedCodes.length === actualCodes.length && expectedCodes.every((code, index) => code === actualCodes[index]);
}
function expectedBlockerMatches(expected, actual) {
  if (actual.id !== expected.id || actual.message !== expected.message) return false;
  const fields = [
    "ruleId",
    "riskIds",
    "testId",
    "evidenceId",
    "effective",
    "waiverId"
  ];
  return fields.every((field) => {
    const expectedValue = expected[field];
    if (expectedValue === void 0) return true;
    const actualValue = actual[field];
    return Array.isArray(expectedValue) ? JSON.stringify(actualValue) === JSON.stringify(expectedValue) : actualValue === expectedValue;
  });
}
function compareEvaluatedFixture(expected, evaluated) {
  const { gateResult, policy } = evaluated;
  const actualExitCode = getExitCode(gateResult.verdict, policy);
  const verdictMatch = gateResult.verdict === expected.expectedVerdict;
  const exitCodeMatch = actualExitCode === expected.expectedExitCode;
  const expectedDqCodes = sortedDqCodes(expected.expectedDisqualifications);
  const actualDqCodes = sortedDqCodes(gateResult.disqualifications);
  const mode = expected.expectedDisqualificationMode ?? "exact";
  const dqMatch = dqCodesMatch(expectedDqCodes, actualDqCodes, mode);
  const unexpectedDqCodes = mode === "exact" ? actualDqCodes.filter((code) => !expectedDqCodes.includes(code)) : [];
  const missingDqCodes = expectedDqCodes.filter((code) => !actualDqCodes.includes(code));
  const expectedBlockers = expected.expectedBlockers ?? [];
  const expectedBlockerIds = expectedBlockers.map((blocker) => blocker.id).sort();
  const actualBlockerIds = gateResult.blockers.map((blocker) => blocker.id).sort();
  const blockerMode = expected.expectedBlockerMode ?? (expectedBlockers.length > 0 ? "exact" : void 0);
  const blockerMatch = blockerMode === void 0 || (blockerMode === "includes" || expectedBlockerIds.length === actualBlockerIds.length && expectedBlockerIds.every((id, index) => id === actualBlockerIds[index])) && expectedBlockers.every(
    (blocker) => gateResult.blockers.some((actual) => expectedBlockerMatches(blocker, actual))
  );
  return {
    actualExitCode,
    verdictMatch,
    exitCodeMatch,
    expectedDqCodes,
    actualDqCodes,
    mode,
    dqMatch,
    unexpectedDqCodes,
    missingDqCodes,
    expectedBlockerIds,
    actualBlockerIds,
    blockerMatch,
    passed: verdictMatch && exitCodeMatch && dqMatch && blockerMatch
  };
}
function validateEvaluatedFixture(expected, evaluated) {
  const { gateResult } = evaluated;
  const comparison = compareEvaluatedFixture(expected, evaluated);
  console.log(`Fixture: ${expected.fixture}`);
  console.log(`Description: ${expected.description}`);
  console.log(`Expected verdict: ${expected.expectedVerdict}`);
  console.log(`Actual verdict: ${gateResult.verdict}`);
  console.log(`Verdict match: ${comparison.verdictMatch ? "PASS" : "FAIL"}`);
  console.log(`Expected exit code: ${expected.expectedExitCode}`);
  console.log(`Actual exit code: ${comparison.actualExitCode}`);
  console.log(`Exit code match: ${comparison.exitCodeMatch ? "PASS" : "FAIL"}`);
  console.log(`Contract ref: ${expected.contractRef}`);
  console.log(`DQ validation mode: ${comparison.mode}`);
  console.log(`Expected DQ codes: ${comparison.expectedDqCodes.join(", ")}`);
  console.log(`Actual DQ codes: ${comparison.actualDqCodes.join(", ")}`);
  if (comparison.mode === "exact" && !comparison.dqMatch) {
    if (comparison.unexpectedDqCodes.length > 0) {
      console.log(`Unexpected DQ codes (present but not expected): ${comparison.unexpectedDqCodes.join(", ")}`);
    }
    if (comparison.missingDqCodes.length > 0) {
      console.log(`Missing DQ codes (expected but not present): ${comparison.missingDqCodes.join(", ")}`);
    }
  }
  console.log(`DQ codes match: ${comparison.dqMatch ? "PASS" : "FAIL"}`);
  console.log(`Expected blocker IDs: ${comparison.expectedBlockerIds.join(", ")}`);
  console.log(`Actual blocker IDs: ${comparison.actualBlockerIds.join(", ")}`);
  console.log(`Blockers match: ${comparison.blockerMatch ? "PASS" : "FAIL"}`);
  if (!comparison.passed) {
    throw new CliError("Validation: FAIL");
  }
  console.log("Validation: PASS");
}

// src/cli/report/change-selection.ts
import { execFile } from "child_process";
import { readFile as readFile4 } from "fs/promises";
import { join as join4, relative as relative3 } from "path";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
function portable2(path) {
  return path.split(String.fromCharCode(92)).join("/");
}
function relativeTarget2(target) {
  return portable2(relative3(process.cwd(), target));
}
async function changedFiles() {
  if (process.env.QEG_CHANGED_FILES !== void 0) {
    const files = process.env.QEG_CHANGED_FILES.split(/[,\r\n]+/).map((file) => portable2(file.trim())).filter(Boolean);
    return { files, strategy: "env" };
  }
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"]);
  } catch (error) {
    return { files: [], strategy: "worktree", error: "git repository detection failed: " + error };
  }
  const attempts = [
    { strategy: "origin_main", args: ["diff", "--name-only", "--diff-filter=ACMRTUXB", "origin/main...HEAD"] },
    { strategy: "head_parent", args: ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD~1...HEAD"] }
  ];
  const errors = [];
  for (const attempt of attempts) {
    try {
      const { stdout } = await execFileAsync("git", attempt.args);
      return { files: stdout.split(/\r?\n/).map((file) => portable2(file.trim())).filter(Boolean), strategy: attempt.strategy };
    } catch (error) {
      errors.push(attempt.strategy + ": " + error);
    }
  }
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
    const files = stdout.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim()).map((path) => path.includes(" -> ") ? path.split(" -> ").at(-1) ?? path : path).map(portable2);
    if (files.length > 0) return { files, strategy: "worktree" };
    errors.push("worktree: clean worktree cannot replace unavailable history");
  } catch (error) {
    errors.push("worktree: " + error);
  }
  return { files: [], strategy: "worktree", error: "all changed-file detection strategies failed: " + errors.join(" | ") };
}
async function targetMentionsChangedFile(target, files) {
  const relTarget = relativeTarget2(target);
  if (files.some((file) => file === relTarget || file.startsWith(relTarget + "/"))) return true;
  try {
    const input = JSON.parse(await readFile4(join4(target, "gate-input.json"), "utf-8"));
    const artifacts = (input.metadata?.inputArtifacts ?? []).map((artifact) => artifact.path).filter((path) => Boolean(path)).map(portable2);
    const changedCode = (input.graph?.nodes ?? []).filter((node) => node.kind === "changed_code" && node.path).map((node) => portable2(node.path));
    return [...artifacts, ...changedCode].some((path) => files.includes(path));
  } catch {
    return false;
  }
}
async function selectChangedTargets(targets, changedOnly = false) {
  if (!changedOnly) return { targets: [...targets], selection: { mode: "all", status: "selected", strategy: "all", changedFileCount: 0, selectedTargetCount: targets.length } };
  const detected = await changedFiles();
  if (detected.error) return { targets: [], selection: { mode: "changed_only", status: "detection_failed", strategy: detected.strategy, changedFileCount: 0, selectedTargetCount: 0, error: detected.error } };
  const selected = [];
  for (const target of targets) if (await targetMentionsChangedFile(target, detected.files)) selected.push(target);
  return {
    targets: selected,
    selection: {
      mode: "changed_only",
      status: selected.length > 0 ? "selected" : "no_relevant_changes",
      strategy: detected.strategy,
      changedFileCount: detected.files.length,
      selectedTargetCount: selected.length
    }
  };
}

// src/cli/report/baseline-diff.ts
import { readFile as readFile5 } from "fs/promises";
async function readJsonFile2(path) {
  return JSON.parse(await readFile5(path, "utf-8"));
}
async function readBaseline(path) {
  if (!path) return void 0;
  return readJsonFile2(path);
}
function normalizeTargetForDiff(target) {
  return portable(target).replace(portable(process.cwd()), "<repo>");
}
function diffItemKey(item) {
  return JSON.stringify({
    target: normalizeTargetForDiff(item.target),
    code: item.code,
    message: item.message,
    nodeIds: [...item.nodeIds].sort()
  });
}
function reportDiffItems(report) {
  const items = [];
  for (const target of report.targets) {
    for (const disqualification of target.disqualifications) {
      items.push({
        target: normalizeTargetForDiff(target.target),
        code: disqualification.code,
        message: disqualification.message,
        nodeIds: disqualification.nodeIds
      });
    }
  }
  return items.sort((left, right) => diffItemKey(left).localeCompare(diffItemKey(right)));
}
async function createReportDiff(current, previousPath) {
  if (!previousPath) return void 0;
  const previous = await readJsonFile2(previousPath);
  const currentItems = reportDiffItems(current);
  const previousItems = reportDiffItems(previous);
  const currentKeys = new Set(currentItems.map(diffItemKey));
  const previousKeys = new Set(previousItems.map(diffItemKey));
  return {
    previousReport: previousPath,
    new: currentItems.filter((item) => !previousKeys.has(diffItemKey(item))),
    resolved: previousItems.filter((item) => !currentKeys.has(diffItemKey(item))),
    unchanged: currentItems.filter((item) => previousKeys.has(diffItemKey(item)))
  };
}
function sameNodeIds(left, right) {
  if (!left) return true;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
}
function baselineCovers(baseline, target, disqualification) {
  if (!baseline) return false;
  const relTarget = relativeTarget(target);
  return baseline.entries.some((entry) => {
    const targetMatches2 = !entry.target || portable(entry.target) === relTarget || relTarget.endsWith(portable(entry.target));
    const messageMatches = !entry.message || entry.message === disqualification.message;
    return targetMatches2 && entry.code === disqualification.code && messageMatches && sameNodeIds(entry.nodeIds, disqualification.nodeIds);
  });
}
function applyBaseline(target, baseline) {
  if (!baseline || target.status !== "gate_failed" || target.disqualifications.length === 0) {
    return target;
  }
  const allDisqualificationsCovered = target.disqualifications.every(
    (disqualification) => baselineCovers(baseline, target.target, disqualification)
  );
  const hasOtherFailures = target.blockers.length > 0 || target.residualRisks.length > 0 || target.requiredHumanReview.length > 0 || target.expected?.validationPassed === false;
  if (!allDisqualificationsCovered || hasOtherFailures) {
    return target;
  }
  return {
    ...target,
    status: "baseline_accepted",
    exitCode: 0,
    reasons: [
      ...target.reasons,
      "All current DQs are accepted by baseline; report fails only on new DQs."
    ]
  };
}

// src/cli/report/core.ts
async function readExpectedIfPresent(target) {
  const expectedPath = join5(target, "expected-gate-verdict.json");
  if (!(await safeStat(expectedPath))?.isFile()) {
    return void 0;
  }
  return readExpectedVerdict(target);
}
function toReportExpectedComparison(expected, comparison) {
  return {
    fixture: expected.fixture,
    expectedVerdict: expected.expectedVerdict,
    expectedExitCode: expected.expectedExitCode,
    contractRef: expected.contractRef,
    validationPassed: comparison.passed,
    verdictMatch: comparison.verdictMatch,
    exitCodeMatch: comparison.exitCodeMatch,
    dqMatch: comparison.dqMatch,
    expectedDqCodes: comparison.expectedDqCodes,
    actualDqCodes: comparison.actualDqCodes,
    unexpectedDqCodes: comparison.unexpectedDqCodes,
    missingDqCodes: comparison.missingDqCodes,
    blockerMatch: comparison.blockerMatch,
    expectedBlockerIds: comparison.expectedBlockerIds,
    actualBlockerIds: comparison.actualBlockerIds
  };
}
async function evaluateReportTarget(target) {
  try {
    const evaluated = await evaluateFixture(target, { quiet: true });
    const expected = await readExpectedIfPresent(evaluated.fixtureDir);
    const expectedComparison = expected ? toReportExpectedComparison(expected, compareEvaluatedFixture(expected, evaluated)) : void 0;
    const exitCode = getExitCode(evaluated.gateResult.verdict, evaluated.policy);
    const status = exitCode === 0 && (expectedComparison?.validationPassed ?? true) ? "passed" : "gate_failed";
    return gateTargetResult(evaluated, status, exitCode, expectedComparison);
  } catch (error) {
    return {
      target,
      status: "cli_error",
      exitCode: 1,
      reasons: [],
      disqualifications: [],
      blockers: [],
      residualRisks: [],
      requiredHumanReview: [],
      reliability: { enabled: false },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
function gateTargetResult(evaluated, status, exitCode, expected) {
  const { gateResult } = evaluated;
  return {
    target: evaluated.fixtureDir,
    status,
    exitCode,
    verdict: gateResult.verdict,
    reasons: gateResult.reasons,
    disqualifications: gateResult.disqualifications,
    blockers: gateResult.blockers,
    residualRisks: gateResult.residualRisks,
    requiredHumanReview: gateResult.requiredHumanReview,
    reliability: gateResult.reliability,
    expected
  };
}
function countByDq(targets) {
  const counts = /* @__PURE__ */ new Map();
  for (const target of targets) {
    for (const disqualification of target.disqualifications) {
      counts.set(disqualification.code, (counts.get(disqualification.code) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => ({
    code,
    count,
    remediation: getDqExplanation(code).remediation
  }));
}
function buildSummary(targets, reportErrorCount = 0) {
  return {
    totalTargets: targets.length,
    passed: targets.filter((target) => target.status === "passed").length,
    baselineAccepted: targets.filter((target) => target.status === "baseline_accepted").length,
    gateFailed: targets.filter((target) => target.status === "gate_failed").length,
    cliErrors: targets.filter((target) => target.status === "cli_error").length + reportErrorCount,
    dqCounts: countByDq(targets),
    blockerCount: targets.reduce((count, target) => count + target.blockers.length, 0),
    residualRiskCount: targets.reduce((count, target) => count + target.residualRisks.length, 0),
    humanReviewCount: targets.reduce((count, target) => count + target.requiredHumanReview.length, 0)
  };
}
async function createCiReport(rawTargets, options = {}) {
  const collectedTargets = await collectReportTargets(rawTargets);
  const selected = await selectChangedTargets(collectedTargets, options.changedOnly);
  const errors = selected.selection.status === "detection_failed" ? [{ code: "CHANGE_DETECTION_FAILED", message: selected.selection.error ?? "change detection failed" }] : [];
  const baseline = await readBaseline(options.baselinePath);
  const results = [];
  for (const target of selected.targets) {
    results.push(applyBaseline(await evaluateReportTarget(target), baseline));
  }
  const report = {
    reportVersion: "qeg-ci-report-v2",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    selection: selected.selection,
    errors,
    summary: buildSummary(results, errors.length),
    targets: results
  };
  const diff2 = await createReportDiff(report, options.diffPath);
  return diff2 ? { ...report, diff: diff2 } : report;
}

// src/cli/report/formatter.ts
function sourceRefLabel(sourceRef) {
  const parts = [sourceRef.id, sourceRef.path];
  if (sourceRef.label) {
    parts.push(sourceRef.label);
  }
  return parts.filter(Boolean).join(" ");
}
function sourceRefsLabel(sourceRefs) {
  if (sourceRefs.length === 0) return "none";
  return sourceRefs.map(sourceRefLabel).join("; ");
}
function appendExpectedMismatch(lines, expected) {
  if (!expected || expected.validationPassed) return;
  lines.push("  Expected comparison:");
  lines.push(`  - fixture: ${expected.fixture}`);
  lines.push(`  - verdict match: ${expected.verdictMatch ? "PASS" : "FAIL"}`);
  lines.push(`  - exit code match: ${expected.exitCodeMatch ? "PASS" : "FAIL"}`);
  lines.push(`  - DQ match: ${expected.dqMatch ? "PASS" : "FAIL"}`);
  if (expected.unexpectedDqCodes.length > 0) {
    lines.push(`  - unexpected DQ codes: ${expected.unexpectedDqCodes.join(", ")}`);
  }
  if (expected.missingDqCodes.length > 0) {
    lines.push(`  - missing expected DQ codes: ${expected.missingDqCodes.join(", ")}`);
  }
}
function appendGateFailure(lines, target) {
  lines.push(`- ${target.target}`);
  lines.push(`  status: ${target.status}`);
  if (target.verdict) {
    lines.push(`  verdict: ${target.verdict} (exit ${target.exitCode})`);
  } else {
    lines.push(`  exit: ${target.exitCode}`);
  }
  if (target.error) {
    lines.push(`  error: ${target.error}`);
  }
  for (const reason of target.reasons) {
    lines.push(`  reason: ${reason}`);
  }
  for (const disqualification of target.disqualifications) {
    lines.push(`  DQ ${disqualification.code}: ${disqualification.message}`);
    lines.push(`    nodes: ${disqualification.nodeIds.join(", ") || "none"}`);
    lines.push(`    sourceRefs: ${sourceRefsLabel(disqualification.sourceRefs)}`);
  }
  for (const blocker of target.blockers) {
    lines.push(`  blocker ${blocker.id}: ${blocker.message}`);
    lines.push(`    risks: ${blocker.riskIds.join(", ") || "none"}`);
    lines.push(`    sourceRefs: ${sourceRefsLabel(blocker.sourceRefs)}`);
  }
  if (target.residualRisks.length > 0) {
    lines.push(`  residual risks: ${target.residualRisks.join(", ")}`);
  }
  if (target.requiredHumanReview.length > 0) {
    lines.push(`  required human review: ${target.requiredHumanReview.join(", ")}`);
  }
  appendExpectedMismatch(lines, target.expected);
}
function isFailureTarget(target) {
  return target.status === "gate_failed" || target.status === "cli_error";
}
function rateLabel(value) {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}
function appendReliabilityTarget(lines, target) {
  const reliability = target.reliability;
  lines.push(`- ${target.target}`);
  lines.push(`  enabled: ${reliability.enabled}`);
  if (!reliability.enabled) return;
  lines.push(`  risk coverage: ${reliability.qualifiedRiskCount}/${reliability.requiredRiskCount} (${rateLabel(reliability.riskCoverageRate)})`);
  lines.push(`  executions required/qualified/passing: ${reliability.requiredExecutionCount}/${reliability.qualifiedExecutionCount}/${reliability.passingExecutionCount}`);
  lines.push(`  execution pass rate: ${reliability.passingExecutionCount}/${reliability.qualifiedExecutionCount} (${rateLabel(reliability.resiliencePassRate)})`);
  lines.push(`  recovery seconds p50/p95/sample: ${reliability.recoverySecondsP50 ?? "n/a"}/${reliability.recoverySecondsP95 ?? "n/a"}/${reliability.recoverySampleCount}`);
  lines.push(`  duplicate side effects/data inconsistencies: ${reliability.duplicateSideEffectsCount}/${reliability.dataInconsistenciesCount}`);
  const ages = Object.entries(reliability.evidenceAgeHours).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  lines.push(`  evidence age hours: ${ages.length === 0 ? "none" : ages.map(([id, age]) => `${id}=${age}`).join(", ")}`);
  lines.push(`  excluded mock tests: ${reliability.excludedMockTests.length === 0 ? "none" : reliability.excludedMockTests.map((item) => item.testId).join(", ")}`);
  lines.push(`  DQ counts: ${Object.entries(reliability.dqCountByRule).map(([code, count]) => `${code}=${count}`).join(", ")}`);
  for (const item of reliability.drillDown) {
    lines.push([
      `  selection: risk=${item.riskId}`,
      `test=${item.testId}`,
      `evidence=${item.selectedEvidenceId ?? "none"}`,
      `adapter=${item.adapter ?? "none"}`,
      `experiment=${item.experimentId ?? "none"}`,
      `attempt=${item.attempt ?? "none"}`,
      `revision=${item.targetRevision ?? "none"}`,
      `environment=${item.environmentId ?? "none"}`,
      `reason=${item.selectionReason}`,
      `exclusion=${item.exclusionReason ?? "none"}`,
      `DQs=${item.disqualificationCodes.join(",") || "none"}`,
      `blockers=${item.blockerIds.join(",") || "none"}`
    ].join(" "));
  }
}
function formatCiReportText(report) {
  const { summary } = report;
  const failingTargets = report.targets.filter(isFailureTarget);
  const baselineTargets = report.targets.filter((target) => target.status === "baseline_accepted");
  const lines = [
    "Quality Evidence Graph CI Report",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${failingTargets.length === 0 ? "PASS" : "FAIL"}`,
    "",
    "Summary",
    `- targets: ${summary.totalTargets}`,
    `- passed: ${summary.passed}`,
    `- baseline accepted: ${summary.baselineAccepted}`,
    `- gate failed: ${summary.gateFailed}`,
    `- cli errors: ${summary.cliErrors}`,
    `- blockers: ${summary.blockerCount}`,
    `- residual risks: ${summary.residualRiskCount}`,
    `- required human review: ${summary.humanReviewCount}`
  ];
  const reliabilityTargets = report.targets;
  if (reliabilityTargets.length > 0) {
    lines.push("", "Reliability");
    for (const target of reliabilityTargets) appendReliabilityTarget(lines, target);
  }
  if (summary.dqCounts.length > 0) {
    lines.push("", "Disqualification summary");
    for (const item of summary.dqCounts) {
      lines.push(`- ${item.code}: ${item.count}`);
      lines.push(`  remediation: ${item.remediation}`);
    }
  }
  if (report.diff) {
    lines.push(
      "",
      "Diff summary",
      `- previous report: ${report.diff.previousReport}`,
      `- new DQs: ${report.diff.new.length}`,
      `- resolved DQs: ${report.diff.resolved.length}`,
      `- unchanged DQs: ${report.diff.unchanged.length}`
    );
    for (const item of report.diff.new) {
      lines.push(`  new ${item.code}: ${item.target} - ${item.message}`);
    }
    for (const item of report.diff.resolved) {
      lines.push(`  resolved ${item.code}: ${item.target} - ${item.message}`);
    }
  }
  if (failingTargets.length > 0) {
    lines.push("", "Target details");
    for (const target of failingTargets) {
      appendGateFailure(lines, target);
    }
  }
  if (baselineTargets.length > 0) {
    lines.push("", "Baseline accepted targets");
    for (const target of baselineTargets) {
      appendGateFailure(lines, target);
    }
  }
  return `${lines.join("\n")}
`;
}
function formatGithubSummary(report) {
  const { summary } = report;
  const lines = [
    "## QEG CI Report",
    "",
    `- targets: ${summary.totalTargets}`,
    `- passed: ${summary.passed}`,
    `- baseline accepted: ${summary.baselineAccepted}`,
    `- gate failed: ${summary.gateFailed}`,
    `- cli errors: ${summary.cliErrors}`,
    `- blockers: ${summary.blockerCount}`,
    `- residual risks: ${summary.residualRiskCount}`,
    `- required human review: ${summary.humanReviewCount}`,
    ""
  ];
  const reliabilityTargets = report.targets;
  if (reliabilityTargets.length > 0) {
    lines.push("### Reliability", "");
    for (const target of reliabilityTargets) appendReliabilityTarget(lines, target);
    lines.push("");
  }
  if (summary.dqCounts.length > 0) {
    lines.push("### Disqualifications", "");
    for (const dq2 of summary.dqCounts) {
      lines.push(`- ${dq2.code}: ${dq2.count} - ${dq2.remediation}`);
    }
    lines.push("");
  }
  if (report.diff) {
    lines.push("### Diff", "");
    lines.push(`- previous report: ${report.diff.previousReport}`);
    lines.push(`- new DQs: ${report.diff.new.length}`);
    lines.push(`- resolved DQs: ${report.diff.resolved.length}`);
    lines.push(`- unchanged DQs: ${report.diff.unchanged.length}`);
    lines.push("");
    for (const item of report.diff.new) {
      lines.push(`- new ${item.code}: ${item.target} - ${item.message}`);
    }
    for (const item of report.diff.resolved) {
      lines.push(`- resolved ${item.code}: ${item.target} - ${item.message}`);
    }
    if (report.diff.new.length > 0 || report.diff.resolved.length > 0) {
      lines.push("");
    }
  }
  const failedTargets = report.targets.filter(isFailureTarget);
  if (failedTargets.length > 0) {
    lines.push("### Targets", "");
    for (const target of failedTargets) {
      lines.push(`- ${target.target}: ${target.status}${target.verdict ? ` / ${target.verdict}` : ""}`);
      if (target.error) {
        lines.push(`  - ${target.error}`);
      }
      for (const disqualification of target.disqualifications) {
        lines.push(`  - ${disqualification.code}: ${disqualification.message}`);
      }
    }
  }
  const baselineTargets = report.targets.filter((target) => target.status === "baseline_accepted");
  if (baselineTargets.length > 0) {
    lines.push("### Baseline accepted targets", "");
    for (const target of baselineTargets) {
      lines.push(`- ${target.target}: ${target.status}${target.verdict ? ` / ${target.verdict}` : ""}`);
      for (const disqualification of target.disqualifications) {
        lines.push(`  - ${disqualification.code}: ${disqualification.message}`);
      }
    }
  }
  return `${lines.join("\n")}
`;
}

// src/cli/report/command.ts
import { appendFile, mkdir, writeFile } from "fs/promises";
import { dirname, resolve as resolve4 } from "path";
import { exit as exit2 } from "process";
function parseReportArgs(args) {
  const targets = [];
  let format = "text";
  let outPath;
  let githubSummary = false;
  let baselinePath;
  let changedOnly = false;
  let diffPath;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      format = "json";
      continue;
    }
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "text" && value !== "json") {
        throw new CliError("Expected --format text|json");
      }
      format = value;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected output path after --out");
      }
      outPath = value;
      index += 1;
      continue;
    }
    if (arg === "--github-summary") {
      githubSummary = true;
      continue;
    }
    if (arg === "--baseline") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected baseline path after --baseline");
      }
      baselinePath = value;
      index += 1;
      continue;
    }
    if (arg === "--changed-only") {
      changedOnly = true;
      continue;
    }
    if (arg === "--diff") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected previous report path after --diff");
      }
      diffPath = value;
      index += 1;
      continue;
    }
    targets.push(arg);
  }
  if (targets.length === 0) {
    throw new CliError(
      "Usage: qeg report [--json|--format text|json] [--out <path>] [--github-summary] [--baseline <path>] [--changed-only] [--diff <previous-report.json>] <fixture-dir-or-parent> [...]"
    );
  }
  return { options: { format, outPath, githubSummary, baselinePath, changedOnly, diffPath }, targets };
}
function formatReport(report, format) {
  return format === "json" ? `${JSON.stringify(report, null, 2)}
` : formatCiReportText(report);
}
function reportExitCode(report) {
  if (report.summary.cliErrors > 0) return 1;
  if (report.summary.gateFailed > 0) return 2;
  return 0;
}
async function runReportCommand(args) {
  const { options, targets } = parseReportArgs(args);
  const report = await createCiReport(targets, {
    baselinePath: options.baselinePath,
    changedOnly: options.changedOnly,
    diffPath: options.diffPath
  });
  const output = formatReport(report, options.format);
  if (options.outPath) {
    const outputPath = resolve4(options.outPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf-8");
  }
  if (options.githubSummary) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      throw new CliError("--github-summary requires GITHUB_STEP_SUMMARY to be set");
    }
    await appendFile(summaryPath, formatGithubSummary(report), "utf-8");
  }
  console.log(output.trimEnd());
  exit2(reportExitCode(report));
}

// src/cli/baseline.ts
async function exists(path) {
  try {
    return (await stat3(path)).isDirectory() || (await stat3(path)).isFile();
  } catch {
    return false;
  }
}
async function readJson(path) {
  return JSON.parse(await readFile6(path, "utf-8"));
}
function portable3(path) {
  return path.replace(/\\/g, "/");
}
function entryLabel(entry) {
  return `${entry.target ?? "*"} ${entry.code}${entry.message ? ` ${entry.message}` : ""}`;
}
function targetMatches(entry, target) {
  if (!entry.target) return true;
  const rel = portable3(relative4(process.cwd(), target));
  const entryTarget = portable3(entry.target);
  return rel === entryTarget || rel.endsWith(entryTarget);
}
function sameNodeIds2(left, right) {
  if (!left) return true;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
}
async function baselineEntryStillApplies(entry, targets) {
  for (const target of targets) {
    if (!targetMatches(entry, target)) continue;
    const report = await createCiReport([target]);
    if (report.targets.some(
      (result) => result.disqualifications.some(
        (dq2) => dq2.code === entry.code && (!entry.message || dq2.message === entry.message) && sameNodeIds2(entry.nodeIds, dq2.nodeIds)
      )
    )) {
      return true;
    }
  }
  return false;
}
function worst(items) {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}
async function createBaselineAuditReport(baselinePath, rawTargets) {
  const baseline = await readJson(baselinePath);
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  const items = [];
  const now = Date.now();
  for (const entry of baseline.entries) {
    if (!entry.owner) {
      items.push({ severity: "fail", entry, message: "baseline entry has no owner" });
    }
    if (!entry.expiresAt) {
      items.push({ severity: "warn", entry, message: "baseline entry has no expiresAt" });
    } else if (Number.isNaN(Date.parse(entry.expiresAt))) {
      items.push({ severity: "fail", entry, message: "baseline entry expiresAt is not a valid date" });
    } else if (Date.parse(entry.expiresAt) < now) {
      items.push({ severity: "fail", entry, message: "baseline entry is expired" });
    }
    if (entry.target && !await exists(resolve5(entry.target))) {
      items.push({ severity: "fail", entry, message: "baseline target does not exist" });
    }
    if (targets.length > 0 && !await baselineEntryStillApplies(entry, targets)) {
      items.push({ severity: "warn", entry, message: "baseline entry no longer matches a current DQ" });
    }
  }
  return {
    reportVersion: "qeg-baseline-audit-v1",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: worst(items),
    baselinePath,
    items
  };
}
function formatBaselineAuditText(report) {
  const lines = [
    "QEG Baseline Audit",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    `Baseline: ${report.baselinePath}`,
    ""
  ];
  if (report.items.length === 0) {
    lines.push("No baseline audit findings.");
    return `${lines.join("\n")}
`;
  }
  for (const item of report.items) {
    lines.push(`- ${item.severity.toUpperCase()} ${entryLabel(item.entry)}: ${item.message}`);
  }
  return `${lines.join("\n")}
`;
}
async function runBaselineCommand(args) {
  const [subcommand, baselinePath, ...rest] = args;
  const json = rest.includes("--json");
  const targets = rest.filter((arg) => arg !== "--json");
  if (subcommand !== "audit" || !baselinePath) {
    throw new CliError("Usage: qeg baseline audit <baseline.json> [--json] [fixture-dir-or-parent ...]");
  }
  const report = await createBaselineAuditReport(baselinePath, targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatBaselineAuditText(report).trimEnd());
  exit3(report.status === "fail" ? 1 : 0);
}

// src/cli/check.ts
import { exit as exit10 } from "process";

// src/cli/doctor.ts
import { readFile as readFile8, stat as stat4 } from "fs/promises";
import { join as join8, resolve as resolve6 } from "path";
import { exit as exit5 } from "process";

// src/cli/schema-check.ts
import { readFile as readFile7 } from "fs/promises";
import { join as join7 } from "path";
import { exit as exit4 } from "process";
async function readJson2(path) {
  return JSON.parse(await readFile7(path, "utf-8"));
}
async function createSchemaCheckReport(rawTargets = []) {
  const registry = await loadSchemaRegistry();
  const items = [...registry.validators.keys()].sort().map((name) => ({
    name: `schema:${name}`,
    status: "pass",
    message: "compiled",
    errors: []
  }));
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  for (const target of targets) {
    try {
      const report = await validateGateInput(await readJson2(join7(target, "gate-input.json")));
      items.push({
        name: `${target}:gate-input`,
        status: report.valid ? "pass" : "fail",
        message: report.valid ? "valid" : "schema validation failed",
        errors: report.issues.map((issue) => `${issue.path} ${issue.message}`)
      });
    } catch (error) {
      items.push({
        name: `${target}:gate-input`,
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
        errors: []
      });
    }
  }
  return {
    reportVersion: "qeg-schema-check-v2",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: items.every((item) => item.status === "pass") ? "pass" : "fail",
    items
  };
}
function formatSchemaCheckText(report) {
  const lines = ["QEG Schema Check", `Generated at: ${report.generatedAt}`, `Overall: ${report.status.toUpperCase()}`, ""];
  for (const item of report.items) {
    lines.push(`- ${item.status.toUpperCase()} ${item.name}: ${item.message}`);
    for (const error of item.errors.slice(0, 8)) lines.push(`  - ${error}`);
    if (item.errors.length > 8) lines.push(`  - ${item.errors.length - 8} more error(s)`);
  }
  return `${lines.join("\n")}
`;
}
async function runSchemaCheckCommand(args) {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  const report = await createSchemaCheckReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatSchemaCheckText(report).trimEnd());
  exit4(report.status === "pass" ? 0 : 2);
}

// src/cli/doctor.ts
async function exists2(path) {
  try {
    return (await stat4(path)).isFile() || (await stat4(path)).isDirectory();
  } catch {
    return false;
  }
}
async function readJson3(path) {
  return JSON.parse(await readFile8(path, "utf-8"));
}
function nodeMajor(version = process.versions.node) {
  return Number(version.split(".")[0]);
}
function minimumNodeMajor(engine) {
  const match = engine?.match(/>=\s*(\d+)/);
  return match ? Number(match[1]) : 20;
}
function worstSeverity(checks) {
  if (checks.some((check) => check.severity === "fail")) return "fail";
  if (checks.some((check) => check.severity === "warn")) return "warn";
  return "pass";
}
async function checkNode() {
  const pkg = await readJson3("package.json");
  const actual = nodeMajor();
  const minimum = minimumNodeMajor(pkg.engines?.node);
  if (actual < minimum) {
    return {
      name: "node-version",
      severity: "fail",
      message: `Node.js ${process.versions.node} does not satisfy package engine ${pkg.engines?.node ?? `>=${minimum}`}`,
      remediation: `Use Node.js ${minimum} or newer.`
    };
  }
  return {
    name: "node-version",
    severity: "pass",
    message: `Node.js ${process.versions.node} satisfies package engine ${pkg.engines?.node ?? `>=${minimum}`}`
  };
}
async function checkDist() {
  if (await exists2("dist/cli.js")) {
    return {
      name: "dist-cli",
      severity: "pass",
      message: "dist/cli.js exists"
    };
  }
  return {
    name: "dist-cli",
    severity: "fail",
    message: "dist/cli.js is missing",
    remediation: "Run npm run build before CI report, or let the GitHub Action build first."
  };
}
async function checkSchemas() {
  const report = await createSchemaCheckReport([]);
  return {
    name: "schema-compile",
    severity: report.status === "pass" ? "pass" : "fail",
    message: report.status === "pass" ? "schemas compile with Ajv" : "one or more schemas failed to compile",
    remediation: report.status === "pass" ? void 0 : "Run qeg schema-check --json and fix the failing schema."
  };
}
async function checkWorkflow() {
  const path = ".github/workflows/ci.yml";
  if (!await exists2(path)) {
    return [{
      name: "github-actions-workflow",
      severity: "warn",
      message: ".github/workflows/ci.yml is missing",
      remediation: "Use qeg init or qeg-report-action to add a workflow that uploads qeg-ci-report."
    }];
  }
  const content = await readFile8(path, "utf-8");
  const usesQegAction = content.includes("qeg-report-action");
  const uploadsReportArtifact = usesQegAction || content.includes("actions/upload-artifact") && content.includes("qeg-ci-report");
  const writesSummary = usesQegAction || content.includes("GITHUB_STEP_SUMMARY") || content.includes("--github-summary") || content.includes("github-summary");
  return [
    {
      name: "github-actions-artifact",
      severity: uploadsReportArtifact ? "pass" : "warn",
      message: uploadsReportArtifact ? "workflow uploads qeg-ci-report artifact" : "workflow does not clearly upload qeg-ci-report artifact",
      remediation: "Add actions/upload-artifact for .qeg/qeg-ci-report.json."
    },
    {
      name: "github-actions-summary",
      severity: writesSummary ? "pass" : "warn",
      message: writesSummary ? "workflow writes QEG job summary" : "workflow does not clearly write a QEG job summary",
      remediation: "Run qeg report --github-summary or use qeg-report-action."
    }
  ];
}
async function checkTarget(rawTarget) {
  const target = resolve6(rawTarget);
  const inputPath = join8(target, "gate-input.json");
  if (!await exists2(inputPath)) {
    return [{
      name: `target:${rawTarget}:gate-input`,
      severity: "fail",
      message: "gate-input.json is missing",
      remediation: "Generate gate-input.json or run qeg init for a minimal starter."
    }];
  }
  const checks = [{
    name: `target:${rawTarget}:gate-input`,
    severity: "pass",
    message: "gate-input.json exists"
  }];
  try {
    const input = await readJson3(inputPath);
    const artifactPaths = [
      ...(input.metadata?.inputArtifacts ?? []).map((artifact) => artifact.path),
      ...(input.evidencePackage?.inputArtifactHashes ?? []).map((artifact) => artifact.path)
    ].filter((path) => Boolean(path));
    for (const artifactPath of artifactPaths) {
      const resolved = resolve6(artifactPath);
      checks.push({
        name: `target:${rawTarget}:artifact:${artifactPath}`,
        severity: await exists2(resolved) ? "pass" : "warn",
        message: await exists2(resolved) ? "artifact path exists" : "artifact path does not exist in this workspace",
        remediation: "Ensure CI checks out or generates the artifact before qeg report."
      });
    }
  } catch (error) {
    checks.push({
      name: `target:${rawTarget}:parse`,
      severity: "fail",
      message: error instanceof Error ? error.message : String(error),
      remediation: "Fix gate-input.json so it is valid JSON."
    });
  }
  return checks;
}
async function createDoctorReport(rawTargets) {
  const checks = [
    await checkNode(),
    await checkDist(),
    await checkSchemas(),
    ...await checkWorkflow()
  ];
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  for (const target of targets) {
    checks.push(...await checkTarget(target));
  }
  return {
    reportVersion: "qeg-doctor-v1",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: worstSeverity(checks),
    checks
  };
}
function formatDoctorText(report) {
  const lines = [
    "QEG Doctor",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    ""
  ];
  for (const check of report.checks) {
    lines.push(`- ${check.severity.toUpperCase()} ${check.name}: ${check.message}`);
    if (check.remediation && check.severity !== "pass") {
      lines.push(`  remediation: ${check.remediation}`);
    }
  }
  return `${lines.join("\n")}
`;
}
async function runDoctorCommand(args) {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  const report = await createDoctorReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatDoctorText(report).trimEnd());
  exit5(report.status === "fail" ? 1 : 0);
}

// src/cli/enum-check.ts
import { readFile as readFile9 } from "fs/promises";
import { exit as exit6 } from "process";
var CHECKS = [
  { typeName: "GateProfile", schemaDef: "gateProfile", typeFile: "src/types/primitives.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "GateVerdict", schemaDef: "gateVerdict", typeFile: "src/types/primitives.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "DisqualificationCode", schemaDef: "disqualificationCode", typeFile: "src/types/primitives.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "EvidenceKind", schemaDef: "evidenceKind", typeFile: "src/types/evidence.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "TestType", schemaDef: "testType", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "ResilienceAdapter", schemaDef: "resilienceAdapter", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "ResilienceFaultModel", schemaDef: "resilienceFaultModel", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "SignalPhase", schemaDef: "signalPhase", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "SignalSemanticRole", schemaDef: "signalSemanticRole", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "SignalAggregation", schemaDef: "signalAggregation", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" }
];
async function readJson4(path) {
  return JSON.parse(await readFile9(path, "utf-8"));
}
function extractStringUnion(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((value) => value[1]).sort();
}
function diff(left, right) {
  return left.filter((value) => !right.includes(value));
}
async function createEnumCheckReport() {
  const items = [];
  const sourceCache = /* @__PURE__ */ new Map();
  const schemaCache = /* @__PURE__ */ new Map();
  for (const check of CHECKS) {
    let typeSource = sourceCache.get(check.typeFile);
    if (!typeSource) {
      typeSource = await readFile9(check.typeFile, "utf-8");
      sourceCache.set(check.typeFile, typeSource);
    }
    let schema = schemaCache.get(check.schemaFile);
    if (!schema) {
      schema = await readJson4(check.schemaFile);
      schemaCache.set(check.schemaFile, schema);
    }
    const typeValues = extractStringUnion(typeSource, check.typeName);
    const schemaValues = [...schema.$defs[check.schemaDef]?.enum ?? []].sort();
    const missingInSchema = diff(typeValues, schemaValues);
    const missingInTypes = diff(schemaValues, typeValues);
    const status = missingInSchema.length === 0 && missingInTypes.length === 0 ? "pass" : "fail";
    items.push({
      name: check.typeName,
      status,
      typeValues,
      schemaValues,
      missingInSchema,
      missingInTypes
    });
  }
  return {
    reportVersion: "qeg-enum-check-v1",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: items.every((item) => item.status === "pass") ? "pass" : "fail",
    items
  };
}
function formatEnumCheckText(report) {
  const lines = [
    "QEG Type/Schema Enum Check",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    ""
  ];
  for (const item of report.items) {
    lines.push(`- ${item.status.toUpperCase()} ${item.name}`);
    if (item.missingInSchema.length > 0) {
      lines.push(`  missing in schema: ${item.missingInSchema.join(", ")}`);
    }
    if (item.missingInTypes.length > 0) {
      lines.push(`  missing in types: ${item.missingInTypes.join(", ")}`);
    }
  }
  return `${lines.join("\n")}
`;
}
async function runEnumCheckCommand(args) {
  const json = args.includes("--json");
  const report = await createEnumCheckReport();
  console.log(json ? JSON.stringify(report, null, 2) : formatEnumCheckText(report).trimEnd());
  exit6(report.status === "pass" ? 0 : 2);
}

// src/cli/snapshot.ts
import { readFile as readFile10, writeFile as writeFile2 } from "fs/promises";
import { join as join9, relative as relative5 } from "path";
import { exit as exit7 } from "process";
function parseSnapshotArgs(args) {
  const targets = [];
  let update = false;
  for (const arg of args) {
    if (arg === "--update") {
      update = true;
    } else {
      targets.push(arg);
    }
  }
  if (targets.length === 0) {
    throw new CliError("Usage: qeg snapshot [--update] <fixture-dir-or-parent> [...]");
  }
  return { update, targets };
}
function normalizeString(value) {
  const cwd = process.cwd().replace(/\\/g, "/");
  return value.replace(/\\/g, "/").replaceAll(cwd, "<repo>");
}
function normalizeValue(value) {
  if (typeof value === "string") return normalizeString(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      normalized[key] = key === "generatedAt" ? "<snapshot>" : normalizeValue(child);
    }
    return normalized;
  }
  return value;
}
function normalizeReport(report) {
  return normalizeValue(report);
}
function snapshotPath(target) {
  return join9(target, "expected-report.json");
}
async function readSnapshot(path) {
  try {
    return await readFile10(path, "utf-8");
  } catch {
    return void 0;
  }
}
async function checkTargetSnapshot(target, update) {
  const report = normalizeReport(await createCiReport([target]));
  const content = `${JSON.stringify(report, null, 2)}
`;
  const path = snapshotPath(target);
  if (update) {
    await writeFile2(path, content, "utf-8");
    return { target, status: "updated", path };
  }
  const expected = await readSnapshot(path);
  if (expected === void 0) {
    return { target, status: "missing", path };
  }
  return {
    target,
    status: expected === content ? "pass" : "mismatch",
    path
  };
}
async function createSnapshotResults(rawTargets, update = false) {
  const targets = await collectReportTargets(rawTargets);
  const results = [];
  for (const target of targets) {
    results.push(await checkTargetSnapshot(target, update));
  }
  return results;
}
async function runSnapshotCommand(args) {
  const options = parseSnapshotArgs(args);
  const results = await createSnapshotResults(options.targets, options.update);
  console.log("QEG Report Snapshots");
  for (const result of results) {
    console.log(`- ${result.status.toUpperCase()} ${relative5(process.cwd(), result.target)} -> ${relative5(process.cwd(), result.path)}`);
  }
  const failed = results.some((result) => result.status === "missing" || result.status === "mismatch");
  exit7(failed ? 2 : 0);
}

// src/cli/evidence-verify.ts
import { readFile as readFile11 } from "fs/promises";
import { join as join10 } from "path";
import { exit as exit8 } from "process";
function worst2(items) {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}
async function createEvidenceVerifyReport(rawTargets) {
  const targets = await collectReportTargets(rawTargets);
  const items = [];
  for (const target of targets) {
    try {
      const validation = await validateGateInput(JSON.parse(await readFile11(join10(target, "gate-input.json"), "utf-8")));
      if (!validation.valid || !validation.input) {
        items.push({ target, artifactId: "gate-input", severity: "fail", code: "PATH_MISSING", message: `schema invalid: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}` });
        continue;
      }
      const report = await verifyEvidenceArtifacts(validation.input, { baseDir: target });
      items.push(...report.items.map((item) => ({ ...item, target })));
    } catch (error) {
      items.push({ target, artifactId: "gate-input", severity: "fail", code: "PATH_MISSING", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { reportVersion: "qeg-evidence-verify-v2", generatedAt: (/* @__PURE__ */ new Date()).toISOString(), status: worst2(items), items };
}
function formatEvidenceVerifyText(report) {
  const lines = ["QEG Evidence Verify", `Generated at: ${report.generatedAt}`, `Overall: ${report.status.toUpperCase()}`, ""];
  for (const item of report.items) lines.push(`- ${item.severity.toUpperCase()} ${item.target} ${item.artifactId}: ${item.message}`);
  return `${lines.join("\n")}
`;
}
async function runEvidenceVerifyCommand(args) {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  if (targets.length === 0) throw new CliError("Usage: qeg evidence verify [--json] <fixture-dir-or-parent> [...]");
  const report = await createEvidenceVerifyReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatEvidenceVerifyText(report).trimEnd());
  exit8(report.status === "fail" ? 1 : 0);
}

// src/cli/policy-lint.ts
import { readFile as readFile12 } from "fs/promises";
import { join as join11 } from "path";
import { exit as exit9 } from "process";
var ALL_DQ_CODES = [
  "DQ-01",
  "DQ-02",
  "DQ-03",
  "DQ-04",
  "DQ-05",
  "DQ-06",
  "DQ-07",
  "DQ-08",
  "DQ-09",
  "DQ-10",
  "DQ-11",
  "DQ-12",
  "DQ-13",
  "DQ-14",
  "DQ-15",
  "DQ-16",
  "DQ-17",
  "DQ-18",
  "DQ-19",
  "DQ-20",
  "DQ-21"
];
async function readJson5(path) {
  return JSON.parse(await readFile12(path, "utf-8"));
}
function add(items, target, severity2, message) {
  items.push({ target, severity: severity2, message });
}
function lintPolicy(items, target, policy, label) {
  if (!policy) {
    add(items, target, "fail", `${label} is missing`);
    return;
  }
  if (!policy.policyId) add(items, target, "fail", `${label}.policyId is missing`);
  if (!policy.policyHash) {
    add(items, target, "fail", `${label}.policyHash is missing`);
  } else if (!policy.policyHash.startsWith("sha256:")) {
    add(items, target, "warn", `${label}.policyHash does not use sha256: prefix`);
  }
  if (!policy.sourceRefs || policy.sourceRefs.length === 0) {
    add(items, target, "fail", `${label}.sourceRefs is empty`);
  }
  const exit16 = policy.exitCodePolicy;
  if (!exit16) {
    add(items, target, "fail", `${label}.exitCodePolicy is missing`);
  } else {
    if (exit16.go !== 0) add(items, target, "fail", `${label}.exitCodePolicy.go must be 0`);
    for (const verdict of ["conditional_go", "no_go", "disqualified"]) {
      if (exit16[verdict] !== 2) add(items, target, "fail", `${label}.exitCodePolicy.${verdict} must be 2`);
    }
  }
  const scope = policy.dqScope ?? [];
  const duplicates = scope.filter((code, index) => scope.indexOf(code) !== index);
  for (const duplicate of [...new Set(duplicates)]) {
    add(items, target, "fail", `${label}.dqScope duplicates ${duplicate}`);
  }
  const missing = ALL_DQ_CODES.filter((code) => !scope.includes(code));
  if (missing.length > 0) {
    add(items, target, "warn", `${label}.dqScope does not include ${missing.join(", ")}`);
  }
  if (policy.reliabilityPolicy) {
    if (!/^sha256:[a-f0-9]{64}$/.test(policy.policyHash ?? "")) add(items, target, "fail", `${label}.policyHash must be SHA-256 when reliabilityPolicy is enabled`);
    const reliabilityCodes = ["DQ-18", "DQ-19", "DQ-20", "DQ-21"];
    const missingReliability = reliabilityCodes.filter((code) => !scope.includes(code));
    if (missingReliability.length > 0) add(items, target, "fail", `${label}.dqScope lacks reliability codes ${missingReliability.join(", ")}`);
  }
}
function worst3(items) {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}
async function createPolicyLintReport(rawTargets) {
  const targets = await collectReportTargets(rawTargets);
  const items = [];
  for (const target of targets) {
    try {
      const input = await readJson5(join11(target, "gate-input.json"));
      lintPolicy(items, target, input.policy, "policy");
      if (input.evidencePackage?.gatePolicy) {
        lintPolicy(items, target, input.evidencePackage.gatePolicy, "evidencePackage.gatePolicy");
        if (input.policy?.policyId && input.evidencePackage.gatePolicy.policyId && input.policy.policyId !== input.evidencePackage.gatePolicy.policyId) {
          add(items, target, "fail", "policy.policyId does not match evidencePackage.gatePolicy.policyId");
        }
        if (input.policy?.policyHash && input.evidencePackage.gatePolicy.policyHash && input.policy.policyHash !== input.evidencePackage.gatePolicy.policyHash) {
          add(items, target, "fail", "policy.policyHash does not match evidencePackage.gatePolicy.policyHash");
        }
      }
      if (input.metadata?.profile && input.policy?.profile && input.metadata.profile !== input.policy.profile) {
        add(items, target, "fail", "metadata.profile does not match policy.profile");
      }
      if (input.metadata?.policyHash && input.policy?.policyHash && input.metadata.policyHash !== input.policy.policyHash) {
        add(items, target, "fail", "metadata.policyHash does not match policy.policyHash");
      }
      if (!items.some((item) => item.target === target)) {
        add(items, target, "pass", "policy lint passed");
      }
    } catch (error) {
      add(items, target, "fail", error instanceof Error ? error.message : String(error));
    }
  }
  return {
    reportVersion: "qeg-policy-lint-v1",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: worst3(items),
    items
  };
}
function formatPolicyLintText(report) {
  const lines = [
    "QEG Policy Lint",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    ""
  ];
  for (const item of report.items) {
    lines.push(`- ${item.severity.toUpperCase()} ${item.target}: ${item.message}`);
  }
  return `${lines.join("\n")}
`;
}
async function runPolicyLintCommand(args) {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  if (targets.length === 0) {
    throw new CliError("Usage: qeg policy lint [--json] <fixture-dir-or-parent> [...]");
  }
  const report = await createPolicyLintReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatPolicyLintText(report).trimEnd());
  exit9(report.status === "fail" ? 1 : 0);
}

// src/cli/check.ts
function worst4(items) {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "warn")) return "warn";
  return "pass";
}
async function createCheckReport(rawTargets) {
  const items = [];
  const schema = await createSchemaCheckReport(rawTargets);
  items.push({ name: "schema-check", status: schema.status === "pass" ? "pass" : "fail", message: `${schema.items.filter((item) => item.status === "fail").length} failing schema item(s)` });
  const enums = await createEnumCheckReport();
  items.push({ name: "enum-check", status: enums.status === "pass" ? "pass" : "fail", message: `${enums.items.filter((item) => item.status === "fail").length} enum drift item(s)` });
  const doctor = await createDoctorReport(rawTargets);
  items.push({ name: "doctor", status: doctor.status, message: `${doctor.checks.filter((check) => check.severity !== "pass").length} doctor finding(s)` });
  if (rawTargets.length === 0) {
    for (const name of ["evidence-verify", "policy-lint", "snapshot", "report"]) items.push({ name, status: "warn", message: "skipped because no targets were provided" });
  } else {
    const evidence = await createEvidenceVerifyReport(rawTargets);
    items.push({ name: "evidence-verify", status: evidence.status, message: `${evidence.items.filter((item) => item.severity === "fail").length} evidence failure(s)` });
    const policy = await createPolicyLintReport(rawTargets);
    items.push({ name: "policy-lint", status: policy.status, message: `${policy.items.filter((item) => item.severity === "fail").length} policy failure(s)` });
    const snapshots = await createSnapshotResults(rawTargets);
    const snapshotFailures = snapshots.filter((result) => result.status === "missing" || result.status === "mismatch");
    items.push({ name: "snapshot", status: snapshotFailures.length === 0 ? "pass" : "fail", message: `${snapshotFailures.length} snapshot failure(s)` });
    const report = await createCiReport(rawTargets);
    items.push({ name: "report", status: report.summary.cliErrors > 0 || report.summary.gateFailed > 0 ? "fail" : "pass", message: `${report.summary.gateFailed} gate failure(s), ${report.summary.cliErrors} CLI error(s)` });
  }
  return { reportVersion: "qeg-check-v2", generatedAt: (/* @__PURE__ */ new Date()).toISOString(), status: worst4(items), items };
}
function formatCheckText(report) {
  const lines = ["QEG Check", `Generated at: ${report.generatedAt}`, `Overall: ${report.status.toUpperCase()}`, ""];
  for (const item of report.items) lines.push(`- ${item.status.toUpperCase()} ${item.name}: ${item.message}`);
  return `${lines.join("\n")}
`;
}
async function runCheckCommand(args) {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  const report = await createCheckReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatCheckText(report).trimEnd());
  exit10(report.status === "fail" ? 1 : 0);
}

// src/cli/evidence-normalize.ts
import { createHash as createHash3, randomUUID } from "crypto";
import { readFile as readFile13, realpath as realpath2, rename, stat as stat5, unlink, writeFile as writeFile3 } from "fs/promises";
import { basename as basename2, dirname as dirname2, isAbsolute as isAbsolute2, relative as relative6, resolve as resolve7 } from "path";
import { exit as exit11 } from "process";
var SUPPORTED_ADAPTERS = /* @__PURE__ */ new Set(["lakda", "toxiproxy", "shell", "ci"]);
function isObject4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function jsonEqual(left, right) {
  return canonicalJson2(left) === canonicalJson2(right);
}
function lexicalCompare2(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function canonicalJson2(value) {
  if (value === void 0) return "undefined";
  if (Array.isArray(value)) return `[${value.map(canonicalJson2).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => lexicalCompare2(left, right)).map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson2(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function conflict(label, raw, context) {
  void raw;
  void context;
  throw new CliError(`Raw input conflicts with context for ${label}`);
}
function choose(label, raw, context, required = true) {
  if (raw !== void 0 && context !== void 0 && !jsonEqual(raw, context)) conflict(label, raw, context);
  const value = raw ?? context;
  if (required && value === void 0) throw new CliError(`Normalization requires ${label} in raw input or context`);
  return value;
}
function rawValue(raw, ...keys) {
  for (const key of keys) if (raw[key] !== void 0) return raw[key];
  return void 0;
}
function normalizeStatus(value) {
  if (typeof value === "boolean") return value ? "pass" : "fail";
  if (typeof value !== "string") return void 0;
  const map = {
    pass: "pass",
    success: "pass",
    passed: "pass",
    failure: "fail",
    failed: "fail",
    fail: "fail",
    cancelled: "aborted",
    canceled: "aborted",
    aborted: "aborted",
    error: "error",
    timeout: "timeout",
    skipped: "skipped"
  };
  return map[value.toLowerCase()];
}
function asObject(value, label) {
  if (!isObject4(value)) throw new CliError(`${label} must be a JSON object`);
  return value;
}
function containedPath(baseDir, rawPath, label) {
  const resolved = resolve7(baseDir, rawPath);
  const offset = relative6(baseDir, resolved);
  if (isAbsolute2(rawPath) || isOutsideBase2(offset)) {
    throw new CliError(`${label} must be contained within --base-dir`);
  }
  return resolved;
}
function isOutsideBase2(offset) {
  return offset === "" || offset === ".." || offset.startsWith("../") || offset.startsWith("..\\") || isAbsolute2(offset);
}
async function assertRealContained(realBaseDir, path, label) {
  let actual;
  try {
    actual = await realpath2(path);
  } catch (error) {
    throw new CliError(`Cannot resolve ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const offset = relative6(realBaseDir, actual);
  if (offset !== "" && isOutsideBase2(offset)) throw new CliError(`${label} resolves outside --base-dir`);
  return actual;
}
async function assertOutputParentContained(realBaseDir, outPath) {
  let actualParent;
  try {
    actualParent = await realpath2(dirname2(outPath));
  } catch (error) {
    throw new CliError(`Cannot resolve --out parent directory: ${error instanceof Error ? error.message : String(error)}`);
  }
  const offset = relative6(realBaseDir, actualParent);
  if (offset !== "" && isOutsideBase2(offset)) throw new CliError("--out parent resolves outside --base-dir");
  return actualParent;
}
function sameFilesystemPath(left, right) {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function parseJson(bytes, label) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString());
  } catch {
    throw new CliError(`Cannot read ${label}: invalid JSON`);
  }
  return asObject(parsed, label);
}
async function readBytes(path, label) {
  try {
    return await readFile13(path);
  } catch (error) {
    throw new CliError(`Cannot read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function sha256(bytes) {
  return `sha256:${createHash3("sha256").update(bytes).digest("hex")}`;
}
function parseArgs(args) {
  let adapter;
  let input;
  let context;
  let out;
  let baseDir = process.cwd();
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--adapter" || arg === "--input" || arg === "--context" || arg === "--out" || arg === "--base-dir") {
      const value = args[index + 1];
      if (!value) throw new CliError(`Expected value after ${arg}`);
      if (arg === "--adapter") adapter = value;
      if (arg === "--input") input = value;
      if (arg === "--context") context = value;
      if (arg === "--out") out = value;
      if (arg === "--base-dir") baseDir = value;
      index += 1;
      continue;
    }
    throw new CliError(`Unknown normalize argument: ${arg}`);
  }
  if (!adapter || !input || !context || !out) {
    throw new CliError("Usage: qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json> [--base-dir <dir>] [--force]");
  }
  return { adapter, input, context, out, baseDir: resolve7(baseDir), force };
}
function adapterFields(adapter, raw) {
  if (adapter === "lakda") {
    const contract = rawValue(raw, "contractVersion", "schema", "version");
    if (contract !== "HATE/v1") throw new CliError("Lakda normalize accepts only HATE/v1 artifacts");
    return {
      experimentId: rawValue(raw, "runId", "run_id"),
      attempt: rawValue(raw, "attempt"),
      targetRevision: rawValue(raw, "commit", "headSha", "head_sha"),
      startedAt: rawValue(raw, "startedAt", "started_at"),
      endedAt: rawValue(raw, "endedAt", "ended_at"),
      status: normalizeStatus(rawValue(raw, "status", "conclusion", "passed")),
      adapterVersion: rawValue(raw, "adapterVersion"),
      fault: raw.fault,
      observed: raw.observed,
      lifecycle: isObject4(raw.lifecycle) ? raw.lifecycle : void 0
    };
  }
  if (adapter === "toxiproxy") {
    const toxic = Array.isArray(raw.toxics) ? raw.toxics[0] : raw.toxic;
    const toxicObject = isObject4(toxic) ? toxic : void 0;
    const toxicType = toxicObject?.type;
    const mappedFaultType = rawValue(raw, "faultModel") ?? (toxicType === "timeout" ? "dependency_timeout" : toxicType === "latency" ? "network_latency" : toxicType === void 0 ? void 0 : "custom");
    const faultStartedAt = rawValue(raw, "faultStartedAt");
    const faultEndedAt = rawValue(raw, "faultEndedAt");
    const proxyName = rawValue(raw, "proxyName", "proxy");
    const actualTargetIds = rawValue(raw, "targetIds") ?? (typeof proxyName === "string" ? [proxyName] : void 0);
    const explicitDuration = rawValue(raw, "appliedDurationMs", "durationMs");
    const measuredDuration = typeof faultStartedAt === "string" && typeof faultEndedAt === "string" ? Date.parse(faultEndedAt) - Date.parse(faultStartedAt) : void 0;
    const appliedDurationMs = explicitDuration ?? (Number.isFinite(measuredDuration) ? measuredDuration : void 0);
    const fault = toxicObject !== void 0 && mappedFaultType !== void 0 && faultStartedAt !== void 0 && faultEndedAt !== void 0 && actualTargetIds !== void 0 && appliedDurationMs !== void 0 ? { type: mappedFaultType, parameters: toxicObject, faultStartedAt, faultEndedAt, actualTargetIds, appliedDurationMs } : void 0;
    if (toxicObject !== void 0 && fault === void 0) {
      throw new CliError(
        "Toxiproxy input requires measured fault timestamps, targets, and duration"
      );
    }
    return {
      experimentId: rawValue(raw, "runId", "experimentId", "name"),
      attempt: rawValue(raw, "attempt"),
      targetRevision: rawValue(raw, "commit", "headSha", "revision"),
      startedAt: rawValue(raw, "startedAt"),
      endedAt: rawValue(raw, "endedAt"),
      status: normalizeStatus(rawValue(raw, "status", "passed")),
      adapterVersion: rawValue(raw, "adapterVersion"),
      fault,
      observed: raw.observed,
      lifecycle: isObject4(raw.lifecycle) ? raw.lifecycle : void 0
    };
  }
  if (adapter === "shell") {
    if (rawValue(raw, "schema", "contractVersion") !== "qeg-resilience-shell-v1") throw new CliError("Shell normalize requires qeg-resilience-shell-v1 input");
    return {
      experimentId: rawValue(raw, "runId"),
      attempt: rawValue(raw, "attempt"),
      targetRevision: rawValue(raw, "commit", "headSha"),
      startedAt: rawValue(raw, "startedAt"),
      endedAt: rawValue(raw, "endedAt"),
      status: normalizeStatus(rawValue(raw, "status")) ?? (typeof raw.exitCode === "number" ? raw.exitCode === 0 ? "pass" : "fail" : void 0),
      adapterVersion: rawValue(raw, "adapterVersion"),
      fault: raw.fault,
      observed: raw.observed,
      lifecycle: isObject4(raw.lifecycle) ? raw.lifecycle : void 0
    };
  }
  if (rawValue(raw, "schema", "contractVersion") !== "qeg-resilience-ci-v1") throw new CliError("CI normalize requires qeg-resilience-ci-v1 input");
  return {
    experimentId: rawValue(raw, "providerRunId", "runId"),
    attempt: rawValue(raw, "attempt", "runAttempt"),
    targetRevision: rawValue(raw, "headSha", "commit"),
    startedAt: rawValue(raw, "startedAt"),
    endedAt: rawValue(raw, "endedAt"),
    status: normalizeStatus(rawValue(raw, "conclusion", "status")),
    adapterVersion: rawValue(raw, "adapterVersion"),
    fault: raw.fault,
    observed: raw.observed,
    lifecycle: isObject4(raw.lifecycle) ? raw.lifecycle : void 0
  };
}
async function validateContext(raw) {
  const registry = await loadSchemaRegistry();
  const validator = registry.validators.get("resilience-normalize-context.schema.json");
  if (!validator) throw new CliError("resilience normalization context schema is unavailable");
  if (!validator(raw)) throw new CliError(`Normalization context schema invalid: ${(validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
  return raw;
}
async function validateEvidence(evidence) {
  const registry = await loadSchemaRegistry();
  const validator = registry.ajv.getSchema("https://quality-harness.dev/schemas/qeg/reliability.schema.json#/$defs/resilienceExecutionEvidenceNode");
  if (!validator) throw new CliError("resilience evidence schema is unavailable");
  if (!validator(evidence)) throw new CliError(`Normalized evidence schema invalid: ${(validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
}
async function normalizeResilienceEvidence(options) {
  if (!SUPPORTED_ADAPTERS.has(options.adapter)) {
    throw new CliError(`Adapter ${options.adapter} is unsupported for MVP normalization; provide canonical resilience evidence directly`);
  }
  const inputPath = containedPath(options.baseDir, options.input, "--input");
  const contextPath = containedPath(options.baseDir, options.context, "--context");
  const outPath = containedPath(options.baseDir, options.out, "--out");
  let realBaseDir;
  try {
    realBaseDir = await realpath2(options.baseDir);
  } catch (error) {
    throw new CliError(`Cannot resolve --base-dir: ${error instanceof Error ? error.message : String(error)}`);
  }
  const [realInputPath, realContextPath, realOutputParent] = await Promise.all([
    assertRealContained(realBaseDir, inputPath, "--input"),
    assertRealContained(realBaseDir, contextPath, "--context"),
    assertOutputParentContained(realBaseDir, outPath)
  ]);
  const realOutputPath = resolve7(realOutputParent, basename2(outPath));
  if (sameFilesystemPath(realOutputPath, realInputPath) || sameFilesystemPath(realOutputPath, realContextPath)) {
    throw new CliError("--out must not overwrite --input or --context");
  }
  const [rawBytes, contextBytes] = await Promise.all([
    readBytes(inputPath, "raw input"),
    readBytes(contextPath, "context")
  ]);
  const raw = parseJson(rawBytes, "raw input");
  const context = await validateContext(parseJson(contextBytes, "context"));
  const fields = adapterFields(options.adapter, raw);
  const lifecycle = context.lifecycle ?? {};
  const rawStartedAt = choose("raw startedAt", fields.startedAt, fields.lifecycle?.startedAt, false);
  const rawEndedAt = choose("raw endedAt", fields.endedAt, fields.lifecycle?.endedAt, false);
  const rawStatus = choose("raw status", fields.status, normalizeStatus(fields.lifecycle?.status), false);
  const startedAt = choose("startedAt", rawStartedAt, lifecycle.startedAt);
  const endedAt = choose("endedAt", rawEndedAt, lifecycle.endedAt);
  const status = choose("status", rawStatus, lifecycle.status);
  const targetRevision = choose("targetRevision", fields.targetRevision, context.targetRevision);
  const experimentId = choose("experimentId", fields.experimentId, context.experimentId);
  const attempt = choose("attempt", fields.attempt, context.attempt);
  const adapterVersion = choose("adapterVersion", fields.adapterVersion, context.adapterVersion);
  const observed = choose("observed", fields.observed, context.observed);
  const rawFault = choose("raw fault", fields.fault, fields.lifecycle?.fault, false);
  const fault = choose("fault", rawFault, lifecycle.fault, false);
  const steadyStateConfirmed = choose("steadyStateConfirmed", fields.lifecycle?.steadyStateConfirmed, lifecycle.steadyStateConfirmed, false);
  const recovered = choose("recovered", fields.lifecycle?.recovered, lifecycle.recovered, false);
  const recoveryConfirmedAt = choose("recoveryConfirmedAt", fields.lifecycle?.recoveryConfirmedAt, lifecycle.recoveryConfirmedAt, false);
  const recoveryDurationMs = choose("recoveryDurationMs", fields.lifecycle?.recoveryDurationMs, lifecycle.recoveryDurationMs, false);
  const abortRecord = choose("abortRecord", fields.lifecycle?.abortRecord, lifecycle.abortRecord, false);
  const node = choose("node", isObject4(raw.node) ? raw.node : void 0, context.node);
  const testId = choose("testId", rawValue(raw, "testId"), context.testId);
  const environment = choose("environment", rawValue(raw, "environment"), context.environment);
  const environmentId = choose("environmentId", rawValue(raw, "environmentId"), context.environmentId);
  const evidenceRefs = choose("evidenceRefs", Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : void 0, context.evidenceRefs);
  const signalManifest = choose("signalManifest", isObject4(raw.signalManifest) ? raw.signalManifest : void 0, context.signalManifest);
  const evidence = {
    id: node.id,
    kind: "execution_evidence",
    title: node.title,
    traceability: node.traceability,
    sourceArtifactIds: node.sourceArtifactIds,
    evidenceRefs,
    evidenceType: "resilience",
    testId,
    adapter: options.adapter,
    adapterVersion,
    normalizationVersion: "qeg-resilience-evidence-v1",
    experimentId,
    attempt,
    rawArtifactRef: {
      id: `${node.id}:raw`,
      path: relative6(options.baseDir, inputPath).replaceAll("\\", "/"),
      contentHash: sha256(rawBytes),
      revision: targetRevision
    },
    targetRevision,
    environment,
    environmentId,
    startedAt,
    endedAt,
    status,
    passed: status === "pass",
    ...steadyStateConfirmed === void 0 ? {} : { steadyStateConfirmed },
    ...fault === void 0 ? {} : { fault },
    ...abortRecord === void 0 ? {} : { abortRecord },
    ...recovered === void 0 ? {} : { recovered },
    ...recoveryConfirmedAt === void 0 ? {} : { recoveryConfirmedAt },
    ...recoveryDurationMs === void 0 ? {} : { recoveryDurationMs },
    ...observed === void 0 ? {} : { observed },
    signalManifest
  };
  await validateEvidence(evidence);
  let outputExists = false;
  try {
    await stat5(outPath);
    outputExists = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new CliError("Cannot inspect --out destination");
    }
  }
  if (outputExists && !options.force) {
    throw new CliError(
      `Output already exists: ${options.out} (use --force to replace it)`
    );
  }
  const tempPath = resolve7(
    dirname2(outPath),
    `.${basename2(outPath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await writeFile3(tempPath, `${JSON.stringify(evidence, null, 2)}
`, { encoding: "utf-8", flag: "wx" });
    await rename(tempPath, outPath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {
    }
    throw error;
  }
  return evidence;
}
async function runEvidenceNormalizeCommand(args) {
  const evidence = await normalizeResilienceEvidence(parseArgs(args));
  console.log(JSON.stringify(evidence, null, 2));
  exit11(0);
}

// src/cli/init.ts
import { mkdir as mkdir2, stat as stat6, writeFile as writeFile4 } from "fs/promises";
import { join as join12, resolve as resolve8 } from "path";
import { exit as exit12 } from "process";
async function exists3(path) {
  try {
    await stat6(path);
    return true;
  } catch {
    return false;
  }
}
function minimalGateInput() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return `${JSON.stringify({
    metadata: {
      qegVersion: "0.2",
      runId: "qeg:run-local-init",
      createdAt: now,
      profile: "standard",
      inputArtifacts: []
    },
    graph: {
      metadata: {
        qegVersion: "0.2",
        runId: "qeg:run-local-init",
        createdAt: now,
        profile: "standard",
        inputArtifacts: []
      },
      nodes: [],
      edges: [],
      completeness: {
        score: 1,
        partial: false,
        parserFailures: [],
        unsupportedClaims: []
      }
    },
    policy: {
      policyId: "qeg:policy-local-init",
      policyHash: "sha256:replace-me",
      profile: "standard",
      effectiveDate: now,
      approver: "replace-me",
      sourceRefs: [
        {
          id: "qeg:sr-policy-local-init",
          path: "docs/policy.md"
        }
      ],
      dqScope: [
        "DQ-01",
        "DQ-02",
        "DQ-03",
        "DQ-04",
        "DQ-05",
        "DQ-06",
        "DQ-07",
        "DQ-08",
        "DQ-09",
        "DQ-10",
        "DQ-11",
        "DQ-12",
        "DQ-13",
        "DQ-14",
        "DQ-15",
        "DQ-16",
        "DQ-17",
        "DQ-18",
        "DQ-19",
        "DQ-20",
        "DQ-21"
      ],
      exitCodePolicy: {
        go: 0,
        conditional_go: 2,
        no_go: 2,
        disqualified: 2
      }
    },
    waivers: []
  }, null, 2)}
`;
}
function baselineTemplate() {
  return `${JSON.stringify({
    entries: []
  }, null, 2)}
`;
}
function workflowTemplate() {
  return `name: QEG

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  qeg:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: RNA4219/quality-evidence-graph/qeg-report-action@v0.3.1
        with:
          targets: .qeg
          output-path: .qeg/qeg-ci-report.json
`;
}
function parseInitArgs(args) {
  let root = ".";
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) throw new CliError("Expected path after --root");
      root = value;
      index += 1;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    throw new CliError("Usage: qeg init [--root <dir>] [--force]");
  }
  return { root, force };
}
async function writeNewFile(path, content, force) {
  if (await exists3(path)) {
    if (!force) return "skipped";
    await writeFile4(path, content, "utf-8");
    return "overwritten";
  }
  await writeFile4(path, content, "utf-8");
  return "created";
}
async function runInitCommand(args) {
  const options = parseInitArgs(args);
  const root = resolve8(options.root);
  const qegDir = join12(root, ".qeg");
  const workflowDir = join12(root, ".github", "workflows");
  await mkdir2(qegDir, { recursive: true });
  await mkdir2(workflowDir, { recursive: true });
  const results = [
    {
      path: join12(qegDir, "gate-input.json"),
      status: await writeNewFile(join12(qegDir, "gate-input.json"), minimalGateInput(), options.force)
    },
    {
      path: join12(qegDir, "qeg-baseline.json"),
      status: await writeNewFile(join12(qegDir, "qeg-baseline.json"), baselineTemplate(), options.force)
    },
    {
      path: join12(workflowDir, "qeg.yml"),
      status: await writeNewFile(join12(workflowDir, "qeg.yml"), workflowTemplate(), options.force)
    }
  ];
  console.log("QEG init");
  for (const result of results) {
    console.log(`- ${result.status}: ${result.path}`);
  }
  if (results.some((result) => result.status === "skipped")) {
    console.log("Use --force to overwrite skipped files.");
  }
  exit12(0);
}

// src/cli/repro-bundle.ts
import { createHash as createHash4 } from "crypto";
import { mkdir as mkdir3, readFile as readFile14, readdir as readdir3, stat as stat7, writeFile as writeFile5 } from "fs/promises";
import { basename as basename3, join as join13, resolve as resolve9 } from "path";
import { exit as exit13 } from "process";
async function readJson6(path) {
  return JSON.parse(await readFile14(path, "utf-8"));
}
async function safeRead(path) {
  try {
    return await readFile14(path, "utf-8");
  } catch {
    return void 0;
  }
}
function sha2562(content) {
  return createHash4("sha256").update(content).digest("hex");
}
function redact(value) {
  if (typeof value === "string") {
    if (/token|secret|password|api[_-]?key|credential/i.test(value)) return "[REDACTED]";
    return value.replace(/(ghp_|github_pat_|sk-)[A-Za-z0-9_\-]+/g, "[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = /token|secret|password|api[_-]?key|credential/i.test(key) ? "[REDACTED]" : redact(child);
    }
    return out;
  }
  return value;
}
async function writeJson(outDir, name, data) {
  const path = join13(outDir, name);
  const content = `${JSON.stringify(redact(data), null, 2)}
`;
  await writeFile5(path, content, "utf-8");
  return { path, sha256: sha2562(content) };
}
async function schemaInventory() {
  const schemas = await readdir3("schemas");
  const rows = [];
  for (const file of schemas.filter((name) => name.endsWith(".schema.json")).sort()) {
    const path = join13("schemas", file);
    const content = await readFile14(path, "utf-8");
    rows.push({ file, sha256: sha2562(content), bytes: content.length });
  }
  return rows;
}
function parseArgs2(args) {
  const targets = [];
  let reportPath;
  let outDir = ".qeg/repro-bundle";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--report") {
      reportPath = args[index + 1];
      if (!reportPath) throw new CliError("Expected path after --report");
      index += 1;
      continue;
    }
    if (arg === "--out") {
      outDir = args[index + 1] ?? outDir;
      index += 1;
      continue;
    }
    targets.push(arg);
  }
  return { reportPath, outDir, targets };
}
async function runReproBundleCommand(args) {
  const options = parseArgs2(args);
  const outDir = resolve9(options.outDir);
  await mkdir3(outDir, { recursive: true });
  const pkg = await readJson6("package.json");
  const targets = options.targets.length > 0 ? await collectReportTargets(options.targets) : [];
  const files = [];
  if (options.reportPath) {
    const report = await readJson6(options.reportPath);
    files.push(await writeJson(outDir, "qeg-ci-report.json", report));
  }
  files.push(await writeJson(outDir, "doctor.json", await createDoctorReport(targets)));
  files.push(await writeJson(outDir, "schemas.json", await schemaInventory()));
  const workflow = await safeRead(".github/workflows/ci.yml");
  if (workflow !== void 0) {
    files.push(await writeJson(outDir, "workflow.json", { path: ".github/workflows/ci.yml", content: workflow }));
  }
  for (const target of targets) {
    const inputPath = join13(target, "gate-input.json");
    try {
      if ((await stat7(inputPath)).isFile()) {
        files.push(await writeJson(outDir, `gate-input-${basename3(target)}.json`, await readJson6(inputPath)));
      }
    } catch {
    }
  }
  const manifest = {
    reportVersion: "qeg-repro-bundle-v1",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    package: { name: pkg.name, version: pkg.version },
    reportPath: options.reportPath,
    files
  };
  const manifestPath = join13(outDir, "manifest.json");
  await writeFile5(manifestPath, `${JSON.stringify(manifest, null, 2)}
`, "utf-8");
  console.log(`QEG repro bundle written to: ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
  exit13(0);
}

// src/cli/record.ts
import { writeFile as writeFile6 } from "fs/promises";
import { join as join14 } from "path";

// src/gate-efficacy.ts
var DEFAULT_TRACEABILITY = {
  sourceRefs: [],
  assumptions: [],
  confidence: "medium"
};
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function collectEvidenceUsed(evaluated, defect) {
  if (defect.evidenceRefs && defect.evidenceRefs.length > 0) {
    return unique(defect.evidenceRefs);
  }
  const evidencePackage = evaluated.evidencePackage;
  if (!evidencePackage) return [];
  return unique([
    ...evidencePackage.inputArtifactHashes.map((artifact) => artifact.id),
    ...evidencePackage.approvalEvidence.map((approval) => approval.id),
    ...evidencePackage.manualEvidence.flatMap((item) => item.evidenceRefs.map((ref) => ref.id)),
    ...evidencePackage.sourceRefs.map((ref) => ref.id)
  ]);
}
function resolveVerdictRef(evaluated, defect) {
  return defect.verdictRef ?? evaluated.evidencePackage?.qegOutputs.gateVerdict.id ?? `${evaluated.metadata.runId}:gate-verdict`;
}
function resolvePlacementPlanRef(evaluated, defect) {
  return defect.placementPlanRef ?? evaluated.evidencePackage?.qegOutputs.testPlacementPlan.id ?? `${evaluated.metadata.runId}:placement-plan`;
}
function buildBacklink(evaluated, defect) {
  return {
    id: defect.id,
    title: defect.title,
    severity: defect.severity,
    discoveredAt: defect.discoveredAt,
    linkedVerdictRef: resolveVerdictRef(evaluated, defect),
    linkedPlacementPlanRef: resolvePlacementPlanRef(evaluated, defect),
    linkedEvidenceRefs: collectEvidenceUsed(evaluated, defect),
    sourceRefs: defect.sourceRefs
  };
}
function buildAnalysisNotes(evaluated, defect) {
  return defect.analysisNotes ?? `Escaped defect ${defect.id} was reported after verdict ${resolveVerdictRef(evaluated, defect)}.`;
}
function proposalId(scope, targetRef) {
  return `qeg:recalibration-proposal:${scope}:${targetRef.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
function buildRecalibrationProposals(defects) {
  const proposals = [];
  const sourceRefsByTarget = /* @__PURE__ */ new Map();
  const defectRefsByTarget = /* @__PURE__ */ new Map();
  for (const defect of defects) {
    for (const targetRef of defect.affectedPolicyRefs ?? []) {
      const key = `policy:${targetRef}`;
      sourceRefsByTarget.set(key, [...sourceRefsByTarget.get(key) ?? [], ...defect.sourceRefs]);
      defectRefsByTarget.set(key, [...defectRefsByTarget.get(key) ?? [], defect.id]);
    }
    for (const targetRef of defect.affectedPlacementRefs ?? []) {
      const key = `placement:${targetRef}`;
      sourceRefsByTarget.set(key, [...sourceRefsByTarget.get(key) ?? [], ...defect.sourceRefs]);
      defectRefsByTarget.set(key, [...defectRefsByTarget.get(key) ?? [], defect.id]);
    }
  }
  for (const [key, escapedDefectRefs] of defectRefsByTarget.entries()) {
    const [scope, ...targetParts] = key.split(":");
    const targetRef = targetParts.join(":");
    const proposalScope = scope;
    proposals.push({
      id: proposalId(proposalScope, targetRef),
      scope: proposalScope,
      targetRef,
      reason: `Escaped defects indicate degraded ${proposalScope} efficacy. Human approval is required before mutation.`,
      escapedDefectRefs: unique(escapedDefectRefs),
      status: "proposed",
      sourceRefs: sourceRefsByTarget.get(key) ?? []
    });
  }
  return proposals.sort((a, b) => a.id.localeCompare(b.id));
}
function buildGateEfficacyRecords(evaluated) {
  const escapedDefects = evaluated.optionalEvidence?.escapedDefects ?? [];
  return escapedDefects.map((defect) => ({
    verdict_ref: resolveVerdictRef(evaluated, defect),
    escaped_defects: [buildBacklink(evaluated, defect)],
    evidence_used: collectEvidenceUsed(evaluated, defect),
    policy_hash_at_verdict: evaluated.policy.policyHash,
    analysis_notes: buildAnalysisNotes(evaluated, defect)
  }));
}
function buildRecalibrationProposalsForFixture(evaluated) {
  return buildRecalibrationProposals(evaluated.optionalEvidence?.escapedDefects ?? []);
}
function appendEscapedDefectNodes(graph, evaluated, placementPlan) {
  const escapedDefects = evaluated.optionalEvidence?.escapedDefects ?? [];
  if (escapedDefects.length === 0) return graph;
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  for (const defect of escapedDefects) {
    const backlink = buildBacklink(evaluated, defect);
    nodes.push({
      id: defect.id,
      kind: "escaped_defect",
      title: defect.title,
      severity: defect.severity,
      discoveredAt: defect.discoveredAt,
      linkedVerdictRef: backlink.linkedVerdictRef,
      linkedPlacementPlanRef: backlink.linkedPlacementPlanRef,
      linkedEvidenceRefs: backlink.linkedEvidenceRefs,
      traceability: {
        ...DEFAULT_TRACEABILITY,
        sourceRefs: defect.sourceRefs,
        assumptions: ["Escaped defect is optional evidence and does not mutate historical verdicts."]
      },
      sourceArtifactIds: defect.sourceRefs.map((ref) => ref.id)
    });
    edges.push({
      id: `${defect.id}:contradicts-verdict`,
      kind: "contradicts",
      from: defect.id,
      to: backlink.linkedVerdictRef,
      traceability: {
        ...DEFAULT_TRACEABILITY,
        sourceRefs: defect.sourceRefs
      }
    });
    edges.push({
      id: `${defect.id}:contradicts-placement`,
      kind: "contradicts",
      from: defect.id,
      to: backlink.linkedPlacementPlanRef || placementPlan.metadata.runId,
      traceability: {
        ...DEFAULT_TRACEABILITY,
        sourceRefs: defect.sourceRefs
      }
    });
    for (const evidenceRef of backlink.linkedEvidenceRefs) {
      edges.push({
        id: `${defect.id}:evidenced-by:${evidenceRef.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
        kind: "evidenced_by",
        from: defect.id,
        to: evidenceRef,
        traceability: {
          ...DEFAULT_TRACEABILITY,
          sourceRefs: defect.sourceRefs
        }
      });
    }
  }
  return {
    ...graph,
    nodes,
    edges
  };
}

// src/cli/record.ts
function buildAuditTrail(evidencePackage, policy) {
  if (!evidencePackage) {
    return void 0;
  }
  return {
    evidencePackageHash: evidencePackage.evidencePackageHash,
    approvalEvidenceSummary: evidencePackage.approvalEvidence.map((approval) => ({
      id: approval.id,
      approver: approval.approver,
      approvedAt: approval.approvedAt,
      policyId: approval.policyId,
      policyHash: approval.policyHash,
      evidencePackageHash: approval.evidencePackageHash
    })),
    gatePolicyHash: policy.policyHash,
    gatePolicyId: policy.policyId
  };
}
async function writeOutputRecord(evaluated) {
  const placementPlan = evaluated.placementPlan ?? {
    metadata: evaluated.metadata,
    obligations: [],
    placements: []
  };
  const gateEfficacyRecords = buildGateEfficacyRecords(evaluated);
  const recalibrationProposals = buildRecalibrationProposalsForFixture(evaluated);
  const record = {
    metadata: evaluated.metadata,
    graph: appendEscapedDefectNodes(evaluated.graph, evaluated, placementPlan),
    placementPlan,
    gate: evaluated.gateResult,
    exports: [
      { kind: "json", path: "output-record.json" }
    ],
    auditTrail: buildAuditTrail(evaluated.evidencePackage, evaluated.policy),
    ...gateEfficacyRecords.length > 0 ? { gateEfficacyRecords } : {},
    ...recalibrationProposals.length > 0 ? { recalibrationProposals } : {}
  };
  const recordJson = JSON.stringify(record, null, 2);
  try {
    JSON.parse(recordJson);
    console.log("Own-output validation: PASS (record can be serialized and parsed)");
  } catch (error) {
    throw new CliError(
      `Own-output validation: FAIL - ${error}`,
      error instanceof Error ? error : void 0
    );
  }
  const outputPath = join14(evaluated.fixtureDir, "output-record.json");
  await writeFile6(outputPath, recordJson, "utf-8");
  console.log(`Record written to: ${outputPath}`);
}

// src/cli/commands.ts
async function runValidateCommand(fixtureDir) {
  try {
    const expected = await readExpectedVerdict(fixtureDir);
    const evaluated = await evaluateFixture(fixtureDir);
    validateEvaluatedFixture(expected, evaluated);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      exit14(1);
    }
    throw error;
  }
}
async function runGateCommand(fixtureDir) {
  try {
    const evaluated = await evaluateFixture(fixtureDir);
    console.log(JSON.stringify(evaluated.gateResult, null, 2));
    exit14(getExitCode(evaluated.gateResult.verdict, evaluated.policy));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      exit14(1);
    }
    throw error;
  }
}
async function runRecordCommand(fixtureDir) {
  try {
    const evaluated = await evaluateFixture(fixtureDir);
    await writeOutputRecord(evaluated);
    exit14(getExitCode(evaluated.gateResult.verdict, evaluated.policy));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      exit14(1);
    }
    throw error;
  }
}

// src/cli.ts
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: qeg <command> [options] <fixture-dir-or-parent>");
    console.log("Commands: validate, gate, record, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot");
    exit15(0);
  }
  if (args[0] === "--version" || args[0] === "-v") {
    console.log("0.3.1");
    exit15(0);
  }
  if (args.length < 1) {
    console.error("Usage: qeg <command> <fixture-dir>");
    console.error("Commands: validate, gate, record, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot");
    exit15(1);
  }
  const [command, ...commandArgs] = args;
  const fixtureDir = commandArgs[0];
  switch (command) {
    case "validate":
      if (!fixtureDir) {
        console.error("Usage: qeg validate <fixture-dir>");
        exit15(1);
      }
      await runValidateCommand(fixtureDir);
      break;
    case "gate":
      if (!fixtureDir) {
        console.error("Usage: qeg gate <fixture-dir>");
        exit15(1);
      }
      await runGateCommand(fixtureDir);
      break;
    case "record":
      if (!fixtureDir) {
        console.error("Usage: qeg record <fixture-dir>");
        exit15(1);
      }
      await runRecordCommand(fixtureDir);
      break;
    case "report":
      await runReportCommand(commandArgs);
      break;
    case "baseline":
      await runBaselineCommand(commandArgs);
      break;
    case "doctor":
      await runDoctorCommand(commandArgs);
      break;
    case "explain":
      await runExplainCommand(commandArgs);
      break;
    case "schema-check":
      await runSchemaCheckCommand(commandArgs);
      break;
    case "enum-check":
      await runEnumCheckCommand(commandArgs);
      break;
    case "evidence":
      if (commandArgs[0] === "normalize") {
        await runEvidenceNormalizeCommand(commandArgs.slice(1));
        break;
      }
      if (commandArgs[0] !== "verify") {
        console.error("Usage: qeg evidence verify <fixture-dir-or-parent> [...] | qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json>");
        exit15(1);
      }
      await runEvidenceVerifyCommand(commandArgs.slice(1));
      break;
    case "policy":
      if (commandArgs[0] !== "lint") {
        console.error("Usage: qeg policy lint <fixture-dir-or-parent> [...]");
        exit15(1);
      }
      await runPolicyLintCommand(commandArgs.slice(1));
      break;
    case "repro-bundle":
      await runReproBundleCommand(commandArgs);
      break;
    case "check":
      await runCheckCommand(commandArgs);
      break;
    case "init":
      await runInitCommand(commandArgs);
      break;
    case "snapshot":
      await runSnapshotCommand(commandArgs);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      exit15(1);
  }
}
main().catch((error) => {
  console.error(`Command failure: ${error}`);
  exit15(1);
});
