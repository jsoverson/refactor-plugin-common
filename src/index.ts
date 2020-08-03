import DEBUG from 'debug';
import {
  BindingIdentifier,
  DebuggerStatement,
  FormalParameters,
  FunctionBody,
  IdentifierExpression,
  LiteralBooleanExpression,
  Node,
  ReturnStatement,
  StaticMemberAssignmentTarget,
  StaticMemberExpression,
  StaticPropertyName,
} from 'shift-ast';
import {isLiteral, RefactorSessionChainable} from 'shift-refactor';
import {Declaration, Reference, Scope} from 'shift-scope';
import {default as isValid} from 'shift-validator';
import {BaseIdGenerator, MemorableIdGenerator} from './id-generator/id-generator';

declare module 'shift-refactor' {
  interface RefactorSessionChainable extends ReturnType<typeof commonMethods> {}
}

const debug = DEBUG('shift-refactor:plugin:common');

export default function commonMethods() {
  return {
    debug(this: RefactorSessionChainable) {
      const injectIntoBody = (body: FunctionBody) => {
        if (body.statements.length > 0) {
          this.session.prepend(body.statements[0], new DebuggerStatement());
        } else {
          this.session.replace(
            body,
            new FunctionBody({
              directives: [],
              statements: [new DebuggerStatement()],
            }),
          );
        }
      };
      this.nodes.forEach(node => {
        switch (node.type) {
          case 'FunctionExpression':
          case 'FunctionDeclaration':
          case 'Method':
            injectIntoBody(node.body);
            break;
          case 'ArrowExpression':
            if (node.body.type !== 'FunctionBody') {
              this.session.replace(
                node.body,
                new FunctionBody({
                  directives: [],
                  statements: [new DebuggerStatement(), new ReturnStatement({expression: node.body})],
                }),
              );
            } else {
              injectIntoBody(node.body);
            }
          default:
            debug('can not call inject debugger statement on %o node', node.type);
          // nothing;
        }
      });
      return this;
    },

    compressConditonalExpressions(this: RefactorSessionChainable) {
      this.session.replaceRecursive('ConditionalExpression', (node: Node) => {
        if (node.type === 'ConditionalExpression' && isLiteral(node.test))
          return node.test ? node.consequent : node.alternate;
        else return node;
      });
      return this;
    },

    compressCommaOperators(this: RefactorSessionChainable) {
      this.session.replaceRecursive('BinaryExpression[operator=","]', (node: Node) => {
        if (node.type === 'BinaryExpression' && isLiteral(node.left)) return node.right;
        else return node;
      });
      return this;
    },

    convertComputedToStatic(this: RefactorSessionChainable) {
      this.session.replaceRecursive(
        `ComputedMemberExpression[expression.type="LiteralStringExpression"]`,
        (node: Node) => {
          if (node.type === 'ComputedMemberExpression' && node.expression.type === 'LiteralStringExpression') {
            const replacement = new StaticMemberExpression({
              object: node.object,
              property: node.expression.value,
            });
            return isValid(replacement) ? replacement : node;
          } else {
            return node;
          }
        },
      );

      this.session.replaceRecursive(
        `ComputedMemberAssignmentTarget[expression.type="LiteralStringExpression"]`,
        (node: Node) => {
          if (node.type === 'ComputedMemberAssignmentTarget' && node.expression.type === 'LiteralStringExpression') {
            const replacement = new StaticMemberAssignmentTarget({
              object: node.object,
              property: node.expression.value,
            });
            return isValid(replacement) ? replacement : node;
          } else {
            return node;
          }
        },
      );

      this.session.replaceRecursive(`ComputedPropertyName[expression.type="LiteralStringExpression"]`, (node: Node) => {
        if (node.type === 'ComputedPropertyName' && node.expression.type === 'LiteralStringExpression') {
          const replacement = new StaticPropertyName({
            value: node.expression.value,
          });
          return isValid(replacement) ? replacement : node;
        } else {
          return node;
        }
      });

      return this;
    },

    unshorten(this: RefactorSessionChainable) {
      const lookupTable = this.session.globalSession.getLookupTable();

      this.nodes.forEach((node: Node) => {
        if (node.type !== 'VariableDeclarator') {
          debug('Non-VariableDeclarator passed to unshorten(). Skipping.');
          return;
        }
        const from = node.binding;
        const to = node.init as IdentifierExpression;
        if (to.type !== 'IdentifierExpression') {
          debug('Tried to unshorten() Declarator with a non-IdentifierExpression. Skipping.');
          return;
        }
        const lookup = lookupTable.variableMap.get(from);
        lookup[0].declarations.forEach((decl: Declaration) => (decl.node.name = to.name));
        lookup[0].references.forEach((ref: Reference) => (ref.node.name = to.name));
        this.session.globalSession._queueDeletion(node);
      });
      return this.session.globalSession.conditionalCleanup();
    },

    expandBoolean(this: RefactorSessionChainable) {
      this.session.replace(
        `UnaryExpression[operator="!"][operand.value=0]`,
        () => new LiteralBooleanExpression({value: true}),
      );
      this.session.replace(
        `UnaryExpression[operator="!"][operand.value=1]`,
        () => new LiteralBooleanExpression({value: false}),
      );
      return this.session.globalSession.conditionalCleanup();
    },

    normalizeIdentifiers(this: RefactorSessionChainable, seed = 1) {
      const lookupTable = this.session.globalSession.getLookupTable();
      const idGenerator = new MemorableIdGenerator(seed);
      renameScope(lookupTable.scope, idGenerator, this.session.globalSession.parentMap);
      return this.session.globalSession.conditionalCleanup();
    },
  };
}

function renameScope(scope: Scope, idGenerator: BaseIdGenerator, parentMap: WeakMap<Node, Node>) {
  if (scope.type.name !== 'Global' && scope.type.name !== 'Script') {
    scope.variableList.forEach(variable => {
      if (variable.declarations.length === 0) return;
      const nextId = idGenerator.next().value;
      const isParam = variable.declarations.find(_ => _.type.name === 'Parameter');
      let newName = `$$${nextId}`;
      if (isParam) {
        const parent = parentMap.get(isParam.node) as FormalParameters;
        const position = parent.items.indexOf(isParam.node as BindingIdentifier);
        newName = `$arg${position}_${nextId}`;
      }
      variable.declarations.forEach(_ => (_.node.name = newName));
      variable.references.forEach(_ => (_.node.name = newName));
    });
  }
  scope.children.forEach(_ => renameScope(_, idGenerator, parentMap));
}
