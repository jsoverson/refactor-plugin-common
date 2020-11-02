import {expect} from 'chai';
import {parseScript as parse} from 'shift-parser';
import {refactor} from 'shift-refactor';
import {MemorableIdGenerator} from '../src/id-generator/id-generator';
import {commonMethods} from '../src';

describe('plugin-common', () => {
  describe('normalizeIdentifiers', () => {
    it('should replace id names with memorable names', () => {
      let ast = parse(`const arst=1; var aiai; function foie(rses){const arst=2;arst++;};foie();`);
      const gen = new MemorableIdGenerator(10);
      const first = gen.next().value,
        second = gen.next().value;
      const $script = refactor(ast, commonMethods);
      $script.normalizeIdentifiers(10);
      expect($script.raw()).to.deep.equal(
        parse(`const arst=1; var aiai; function foie($arg0_${second}){const $$${first}=2;$$${first}++};foie();`),
      );
    });
    it('should not throw an Error on any types of parameters', () => {
      let ast=parse(`(function (w,x=1,{y},[z]) {})`);
      const gen=new MemorableIdGenerator(10);
      const paramNames=[gen.next().value,gen.next().value,gen.next().value,gen.next().value];
      const $script = refactor(ast, commonMethods);
      $script.normalizeIdentifiers(10);
      expect($script.raw()).to.deep.equal(
        parse(`(function ($arg0_${paramNames[0]},$arg1_${paramNames[1]}=1,{$arg2_${paramNames[2]}},[$arg3_${paramNames[3]}]) {})`),
      );
    });
    it('should not change global vars', () => {
      let ast = parse(`(function(){const zzzz=1; console.log(zzzz)})`);
      const gen = new MemorableIdGenerator(10);
      const first = gen.next().value;
      const $script = refactor(ast, commonMethods);
      $script.normalizeIdentifiers(10);
      expect($script.raw()).to.deep.equal(parse(`(function () {const $$${first}=1; console.log($$${first})})`));
    });
  });

  describe('debug', () => {
    it('should insert debugger statements into functions', () => {
      const $script = refactor(`b = _ => foo(); c = _ => {bar()}; a.x = function(){b();c();}`, commonMethods);
      $script(`FunctionExpression, ArrowExpression`).debug();
      expect($script.raw()).to.deep.equal(
        parse('b = _ => {debugger; return foo()}; c = _ => {debugger; bar()}; a.x = function(){debugger;b();c();}'),
      );
    });
  });

  describe('expandBoolean', () => {
    it('should expand !0 and !1', () => {
      let ast = parse(`if (!0 || !1) true`);
      const $script = refactor(ast, commonMethods);
      $script.expandBoolean();
      expect($script.raw()).to.deep.equal(parse('if (true || false) true'));
    });
  });

  describe('unshorten', function () {
    it('should unshorten variable declarations', () => {
      let ast = parse(`let a=2,r=require;r()`);
      const $script = refactor(ast, commonMethods);
      $script(`VariableDeclarator[init.name="require"]`).unshorten();
      expect($script.raw()).to.deep.equal(parse('let a=2;require()'));
    });
  });

  describe('compressCommaOperator', function () {
    it('should eliminate literals in a comma expression', () => {
      let ast = parse(`let a=(1,2,3,4)`);
      const $script = refactor(ast, commonMethods);
      $script.compressCommaOperators();
      expect($script.raw()).to.deep.equal(parse('let a=4;'));
    });
  });

  describe('compressConditonalExpressions', function () {
    it('should do simple evaluation of conditionals with literals', () => {
      let ast = parse(`let a=true ? 1 : 2;`);
      const $script = refactor(ast, commonMethods);
      $script.compressConditonalExpressions();
      expect($script.raw()).to.deep.equal(parse('let a=1;'));
    });
  });

  describe('computedToStatic', () => {
    it('should replace all ComputedMemberProperties', () => {
      let ast = parse(`a["b"]["c"];a["b"]["c"]=2`);
      const $script = refactor(ast, commonMethods);
      $script.convertComputedToStatic();
      expect($script.raw()).to.deep.equal(parse('a.b.c;a.b.c=2'));
    });
    it('should not replace what would make an invalid StaticMemberProperty', () => {
      let ast = parse(`a["2b"] = 2`);
      const $script = refactor(ast, commonMethods);
      $script.convertComputedToStatic();
      expect($script.raw()).to.deep.equal(parse('a["2b"] = 2'));
    });
    it('should replace all ComputedPropertyNames', () => {
      let ast = parse(`a = {["b"]:2}`);
      const $script = refactor(ast, commonMethods);
      $script.convertComputedToStatic();
      expect($script.raw()).to.deep.equal(parse('a = {b:2}'));
    });
  });
});
