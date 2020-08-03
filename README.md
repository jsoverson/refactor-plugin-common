## Shift Refactor Plugin: Common methods

These are common utility methods. This is a plugin for `shift-refactor`.

## Installation

```
$ npm install refactor-plugin-common
```

## Usage

```js
const {refactor} = require('shift-refactor');
const commonMethods = require('refactor-plugin-common');

const src = `/* js source */`;

const $script = refactor(src, commonMethods);
```

## API

### Methods

- [`debug()`](#debug)
- [`compressConditonalExpressions()`](#compressConditonalExpressions)
- [`compressCommaOperators()`](#compressCommaOperators)
- [`convertComputedToStatic()`](#convertComputedToStatic)
- [`unshorten()`](#unshorten)
- [`expandBoolean()`](#expandBoolean)
- [`normalizeIdentifiers()`](#normalizeIdentifiers)

#### `.debug()`

Insert a debugger statement into a function.

#### Example

```js
$script(fnSelector).debug();
```

#### `.compressConditonalExpressions()`

Transform conditional expressions that have been reduced to testing only a literal value into the appropriate branch, e.g. `var a = true ? 1 : 2;` into `var a = 1;`

#### Example

```js
$script.compressConditonalExpressions();
```

#### `.compressCommaOperators()`

For comma operator expressions that include literal values, eliminate all but the rightmost expression, e.g. `var a = true, false, 1, 2, "hello";` into `var a = "hello";`

#### Example

```js
$script.compressCommaOperators();
```

#### `.convertComputedToStatic()`

Turn computed member expressions into static member expressions, e.g. `window["document"]` into `window.document`

#### Example

```js
$script.convertComputedToStatic();
```

#### `.unshorten()`

Remove declaration statements like `var r = require;` and transform all references to the shortened identifier into the original.

#### Example

```js
$script(targetDeclaration).unshorten();
```

#### `.expandBoolean()`

Expands `!1` and `!0` into `false` and `true`

#### Example

```js
$script.expandBoolean();
```

#### `.normalizeIdentifiers()`

Transform all identifiers into consistent, memorable identifiers like `$$abruptBrother`

#### Example

```js
$script.normalizeIdentifiers();
```
