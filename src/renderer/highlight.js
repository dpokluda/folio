// Folio code-fence highlighting.
//
// Typora renders every fenced block with CodeMirror, so its themes colour code
// through `.cm-*` classes fed by the `--color-cm-*` palette. Folio used to
// highlight with highlight.js, whose `.hljs-*` tokens classify code quite
// differently — most visibly, highlight.js emits no token at all for bare
// identifiers, so type and variable names fell back to plain body colour where
// Typora paints them.
//
// The modes below are the *same* CodeMirror 5 modes Typora runs, published as
// @codemirror/legacy-modes. Their tokenizer is driven directly here rather than
// through CodeMirror 6's Lezer bridge: the bridge maps CM5 token names onto
// Lezer tags, which is lossy in both directions, whereas reading the mode
// output straight gives the original CM5 names and therefore markup that is
// class-for-class identical to Typora's.

import { StringStream } from '@codemirror/language';

import {
  c, cpp, csharp, dart, java, kotlin, objectiveC, objectiveCpp, scala, shader,
} from '@codemirror/legacy-modes/mode/clike';
import { javascript, json, jsonld, typescript } from '@codemirror/legacy-modes/mode/javascript';
import { cython, python } from '@codemirror/legacy-modes/mode/python';
import { css, less, sCSS } from '@codemirror/legacy-modes/mode/css';
import { html, xml } from '@codemirror/legacy-modes/mode/xml';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import {
  msSQL, mySQL, pgSQL, plSQL, sqlite, standardSQL,
} from '@codemirror/legacy-modes/mode/sql';
import { go } from '@codemirror/legacy-modes/mode/go';
import { rust } from '@codemirror/legacy-modes/mode/rust';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { r } from '@codemirror/legacy-modes/mode/r';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { elm } from '@codemirror/legacy-modes/mode/elm';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { scheme } from '@codemirror/legacy-modes/mode/scheme';
import { tcl } from '@codemirror/legacy-modes/mode/tcl';
import { vb } from '@codemirror/legacy-modes/mode/vb';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { vhdl } from '@codemirror/legacy-modes/mode/vhdl';
import { fortran } from '@codemirror/legacy-modes/mode/fortran';
import { pascal } from '@codemirror/legacy-modes/mode/pascal';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { crystal } from '@codemirror/legacy-modes/mode/crystal';
import { coffeeScript } from '@codemirror/legacy-modes/mode/coffeescript';
import { http } from '@codemirror/legacy-modes/mode/http';
import { sass } from '@codemirror/legacy-modes/mode/sass';
import { stylus } from '@codemirror/legacy-modes/mode/stylus';
import { pug } from '@codemirror/legacy-modes/mode/pug';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { wast } from '@codemirror/legacy-modes/mode/wast';
import { fSharp, oCaml, sml } from '@codemirror/legacy-modes/mode/mllike';
import { haxe } from '@codemirror/legacy-modes/mode/haxe';
import { gherkin } from '@codemirror/legacy-modes/mode/gherkin';
import { jinja2 } from '@codemirror/legacy-modes/mode/jinja2';
import { webIDL } from '@codemirror/legacy-modes/mode/webidl';
import { turtle } from '@codemirror/legacy-modes/mode/turtle';
import { sparql } from '@codemirror/legacy-modes/mode/sparql';
import { smalltalk } from '@codemirror/legacy-modes/mode/smalltalk';
import { cobol } from '@codemirror/legacy-modes/mode/cobol';
import { octave } from '@codemirror/legacy-modes/mode/octave';
import { commonLisp } from '@codemirror/legacy-modes/mode/commonlisp';

// Fence info string -> mode. Keys are matched case-insensitively against the
// first word of the info string, so ```js, ```JS and ```js title=x all resolve.
const MODES = {
  // C family
  c: c, h: c,
  cpp, 'c++': cpp, cc: cpp, cxx: cpp, hpp: cpp, hxx: cpp,
  cs: csharp, csharp, 'c#': csharp,
  java, kotlin, kt: kotlin, scala, dart,
  objc: objectiveC, 'objective-c': objectiveC,
  objcpp: objectiveCpp, 'objective-c++': objectiveCpp,
  glsl: shader, hlsl: shader, shader,

  // Web
  js: javascript, javascript, mjs: javascript, cjs: javascript,
  node: javascript, jsx: javascript,
  ts: typescript, typescript, tsx: typescript,
  json, json5: json, jsonc: json, jsonld,
  css, scss: sCSS, less, sass, stylus, styl: stylus,
  html, htm: html, xhtml: html, vue: html, svelte: html,
  xml, xsl: xml, xsd: xml, svg: xml, rss: xml, plist: xml,
  pug, jade: pug,

  // Scripting
  py: python, python, python3: python, cython, pyx: cython,
  rb: ruby, ruby, perl, pl: perl, lua,
  php: null, // no legacy mode ships for PHP; falls through to plain text
  coffee: coffeeScript, coffeescript: coffeeScript,
  ps1: powerShell, powershell: powerShell, pwsh: powerShell,
  sh: shell, bash: shell, zsh: shell, shell, console: shell, terminal: shell,

  // Systems / compiled
  go, golang: go, rust, rs: rust, swift, haxe, hx: haxe,
  fortran, f90: fortran, pascal, delphi: pascal, pas: pascal,
  vb, vbnet: vb, verilog, sv: verilog, systemverilog: verilog, vhdl,
  wast, wat: wast, wasm: wast, cobol,

  // Functional
  haskell, hs: haskell, erlang, erl: erlang, elm,
  clojure, clj: clojure, cljs: clojure, edn: clojure,
  scheme, scm: scheme, lisp: commonLisp, commonlisp: commonLisp, cl: commonLisp,
  fsharp: fSharp, fs: fSharp, 'f#': fSharp,
  ocaml: oCaml, ml: oCaml, sml, smalltalk, st: smalltalk,

  // Data / config / query
  yaml, yml: yaml, toml,
  ini: properties, properties, cfg: properties, conf: properties,
  sql: standardSQL, mysql: mySQL, postgres: pgSQL, postgresql: pgSQL,
  pgsql: pgSQL, mssql: msSQL, tsql: msSQL, sqlite, plsql: plSQL,
  sparql, turtle, ttl: turtle,
  proto: protobuf, protobuf, webidl: webIDL, idl: webIDL,

  // Tooling / misc
  dockerfile: dockerFile, docker: dockerFile,
  diff, patch: diff, http, nginx, cmake, groovy, gradle: groovy,
  r, julia, jl: julia, octave, matlab: octave, crystal, cr: crystal,
  tcl, gherkin, feature: gherkin, cucumber: gherkin,
  jinja2, jinja: jinja2, j2: jinja2,
  latex: stex, tex: stex, stex,
};

// CodeMirror's own defaults; modes only use these for indentation decisions,
// which do not affect tokenization, but they must be sane numbers.
const TAB_SIZE = 4;
const INDENT_UNIT = 2;

// Runaway guard: a malformed mode that neither advances the stream nor throws
// would otherwise spin forever on one line.
const MAX_TOKENS_PER_LINE = 10000;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);
}

/** Resolve a fence info string (```cs, ```JS title=x) to a CM5 mode. */
export function resolveMode(info) {
  if (!info) return null;
  const name = String(info).trim().split(/\s+/)[0].toLowerCase();
  return Object.prototype.hasOwnProperty.call(MODES, name) ? MODES[name] || null : null;
}

/** True when a fence language will actually be highlighted. */
export function hasLanguage(info) {
  return resolveMode(info) != null;
}

// CodeMirror styles a token by prefixing every space-separated part with `cm-`
// (a mode may return a compound style such as "variable callee"). Mirrored
// exactly so the emitted classes match what Typora's DOM carries.
//
// @codemirror/legacy-modes ships two generations of mode side by side: the
// original CodeMirror 5 modes, which return CM5 token names ("variable-2",
// "string-2"), and modes since modernised to return Lezer tag names
// ("variableName.local", "string.special", "angleBracket"). Typora runs CM5, so
// its themes only style the CM5 vocabulary — and emitting a Lezer name verbatim
// would also produce a class containing a dot, which no sane selector matches.
// Both vocabularies are folded onto the CM5 names here.
//
// A `null` entry means "emit no span at all", matching CM5 modes that leave
// that construct unstyled.
const TOKEN_ALIASES = {
  // keywords
  controlKeyword: 'keyword', definitionKeyword: 'keyword', moduleKeyword: 'keyword',
  operatorKeyword: 'keyword', modifier: 'keyword', self: 'keyword',
  // literals
  bool: 'atom', null: 'atom', literal: 'atom', constant: 'atom',
  integer: 'number', float: 'number', unit: 'number',
  character: 'string', docString: 'string', attributeValue: 'string',
  'string.special': 'string-2', regexp: 'string-2', escape: 'string-2',
  // names
  variableName: 'variable',
  'variableName.local': 'variable-2', 'variableName.special': 'variable-2',
  labelName: 'variable-2',
  'variableName.definition': 'def', 'propertyName.definition': 'def',
  'variableName.standard': 'builtin', standard: 'builtin',
  typeName: 'variable-3', className: 'variable-3', namespace: 'variable-3',
  propertyName: 'property', attributeName: 'attribute', tagName: 'tag',
  macroName: 'meta', annotation: 'meta', processingInstruction: 'meta',
  // punctuation / brackets
  angleBracket: 'bracket', squareBracket: 'bracket', paren: 'bracket', brace: 'bracket',
  punctuation: null, separator: null, contentSeparator: null,
  // comments
  lineComment: 'comment', blockComment: 'comment', docComment: 'comment',
  // operators
  derefOperator: 'operator', arithmeticOperator: 'operator', logicOperator: 'operator',
  bitwiseOperator: 'operator', compareOperator: 'operator', updateOperator: 'operator',
  definitionOperator: 'operator', typeOperator: 'operator', controlOperator: 'operator',
  // prose / diff
  heading: 'header', emphasis: 'em', strong: 'strong', url: 'link',
  deleted: 'negative', inserted: 'positive', changed: 'meta', invalid: 'error',
};

function normalizeToken(raw) {
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(TOKEN_ALIASES, raw)) return TOKEN_ALIASES[raw];
  // Unknown Lezer name: fall back to its base tag, dropping modifiers.
  const base = raw.split('.')[0];
  if (Object.prototype.hasOwnProperty.call(TOKEN_ALIASES, base)) return TOKEN_ALIASES[base];
  // Anything left must still be a usable class name; CM5 names reach here.
  return /^[a-z][a-z0-9-]*$/i.test(base) ? base : null;
}

function cmClass(style) {
  const parts = [];
  for (const raw of String(style).trim().split(/\s+/)) {
    const name = normalizeToken(raw);
    if (name) parts.push(`cm-${name}`);
  }
  return parts.join(' ');
}

/**
 * Highlight `code` as `info`, returning HTML for the inside of a <code>.
 * Falls back to escaped plain text when the language is unknown or the mode
 * throws, which is also what Typora does for languages it has no mode for.
 */
export function highlightFence(code, info) {
  const mode = resolveMode(info);
  if (!mode) return escapeHtml(code);
  try {
    return runMode(code, mode);
  } catch (err) {
    console.error('[folio] highlight failed for language', info, err);
    return escapeHtml(code);
  }
}

function runMode(code, mode) {
  const state = mode.startState ? mode.startState(INDENT_UNIT) : {};
  const lines = code.split('\n');
  let out = '';

  for (let i = 0; i < lines.length; i++) {
    if (i) out += '\n';
    const text = lines[i];

    // Modes track block context (open comments, heredocs) across blank lines,
    // so an empty line still has to be announced.
    if (!text) {
      if (mode.blankLine) mode.blankLine(state, INDENT_UNIT);
      continue;
    }

    const stream = new StringStream(text, TAB_SIZE, INDENT_UNIT);
    let guard = 0;
    while (!stream.eol()) {
      const style = mode.token(stream, state);
      // A mode that consumed nothing has to be nudged forward, otherwise the
      // loop cannot terminate.
      if (stream.pos === stream.start) stream.pos++;
      const slice = escapeHtml(text.slice(stream.start, stream.pos));
      const cls = style ? cmClass(style) : '';
      out += cls ? `<span class="${cls}">${slice}</span>` : slice;
      stream.start = stream.pos;
      if (++guard > MAX_TOKENS_PER_LINE) {
        out += escapeHtml(text.slice(stream.pos));
        break;
      }
    }
  }

  return out;
}
