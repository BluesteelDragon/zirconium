/* eslint-disable max-lines -- FIXME: Try to split this up a bit. */
import { $print } from "rbxts-transform-debug";

import { types } from "../ast";
import { isNode, ZrNodeKind } from "../ast/nodes";
import { ZrNodeFlag } from "../ast/nodes/enum";
import { getFriendlyName } from "../ast/nodes/functions";
import type {
	ArrayIndexExpression,
	ArrayLiteralExpression,
	BinaryExpression,
	CallExpression,
	EnumDeclarationStatement,
	ForInStatement,
	FunctionDeclaration,
	FunctionExpression,
	Identifier,
	IfStatement,
	Node,
	ObjectLiteral,
	OptionExpression,
	PropertyAccessExpression,
	SimpleCallExpression,
	SourceBlock,
	SourceFile,
	VariableDeclaration,
} from "../ast/nodes/node-types";
import ZrContext from "../data/context";
import { ZrEnum } from "../data/enum";
import { ZrEnumItem } from "../data/enum-item";
import type { ZrValue } from "../data/locals";
import ZrLocalStack, { StackValueAssignmentError } from "../data/locals";
import ZrLuauFunction from "../data/luau-function";
import ZrObject from "../data/object";
import ZrRange from "../data/range";
import { ZrInputStream, ZrOutputStream } from "../data/stream";
import ZrUndefined from "../data/undefined";
import ZrUserFunction from "../data/user-function";
import type { InferUserdataKeys } from "../data/userdata";
import { ZrInstanceUserdata, ZrUserdata } from "../data/userdata";
import { isArray, isMap } from "../util";

export enum ZrRuntimeErrorCode {
	NodeValueError,
	EvaluationError,
	StackOverflow,
	InvalidForInExpression,
	IndexingUndefined,
	InvalidArrayIndex,
	InvalidType,
	NotCallable,
	InvalidPropertyAccess,
	PipeError,
	InstanceSetViolation,
	InstanceGetViolation,
	InvalidIterator,
	ReassignConstant,
	InvalidRangeError,
	InvalidEnumItem,
	OutOfRange,
	UnassignedVariable,
}
export interface ZrRuntimeError {
	code: ZrRuntimeErrorCode;
	message: string;
	node?: Node;
}

function getTypeName(
	value: ZrUndefined | ZrValue,
): "Array" | "Object" | "undefined" | keyof CheckableTypes {
	if (isArray(value)) {
		return "Array";
	} else if (value instanceof ZrObject) {
		return "Object";
	} else if (value === ZrUndefined) {
		return "undefined";
	}

	return typeOf(value);
}

/** Handles a block. */
export default class ZrRuntime {
	private readonly context: ZrContext;
	private readonly errors = new Array<ZrRuntimeError>();
	private readonly functions = new Map<string, ZrLuauFunction>();
	private level = 0;

	constructor(
		private readonly source: SourceBlock | SourceFile,
		private readonly locals = new ZrLocalStack(),
		private readonly executingPlayer?: Player,
	) {
		this.context = new ZrContext(this);
	}

	private runtimeError(message: string, code: ZrRuntimeErrorCode, node?: Node): never {
		const err = identity<ZrRuntimeError>({
			code,
			message,
			node,
		});
		this.errors.push(err);
		throw `[RuntimeError] ${err.message}`;
	}

	private runtimeAssert(
		condition: unknown,
		message: string,
		code: ZrRuntimeErrorCode,
		node?: Node,
	): asserts condition {
		if (condition === false) {
			this.runtimeError(message, code, node);
		}
	}

	private runtimeAssertNotUndefined(
		condition: unknown,
		message: string,
		code: ZrRuntimeErrorCode,
		node?: Node,
	): asserts condition is defined {
		if (condition === undefined) {
			this.runtimeError(message, code, node);
		}
	}

	public registerFunction(name: string, func: ZrLuauFunction): void {
		this.functions.set(name, func);
		this.locals.setGlobal(name, func);
	}

	public getLocals(): ZrLocalStack {
		return this.locals;
	}

	public getErrors(): Array<ZrRuntimeError> {
		return this.errors;
	}

	/** Pushes a new stack onto the executor. */
	private push(): void {
		this.level++;
		this.locals.push();

		// eslint-disable-next-line ts/no-magic-numbers -- FIXME: Move to a constant Stack size?
		if (this.level > 256) {
			this.runtimeError("Stack overflow", ZrRuntimeErrorCode.StackOverflow);
		}
	}

	/**
	 * Pops the last stack from the executor.
	 *
	 * @returns Something..
	 */
	// eslint-disable-next-line ts/explicit-function-return-type -- FIXME: Investigate type, and refactor me!
	private pop() {
		this.level--;
		return this.locals.pop();
	}

	// eslint-disable-next-line sonar/cognitive-complexity, max-lines-per-function -- FIXME: Refactor me pls.
	private executeSetVariable(node: VariableDeclaration): undefined {
		const { expression, flags, identifier } = node;
		const value = this.evaluateNode(expression);
		if (types.isIdentifier(identifier)) {
			const isConstant = (flags & ZrNodeFlag.Const) !== 0;
			const isLocalAssignment = isConstant || (flags & ZrNodeFlag.Let) !== 0;

			if (isLocalAssignment) {
				this.getLocals().setLocal(
					identifier.name,
					value === ZrUndefined ? undefined : value,
					isConstant,
				);
			} else {
				const result = this.getLocals().setUpValueOrLocal(
					identifier.name,
					value === ZrUndefined ? undefined : value,
					isConstant,
				);
				if (result.isErr()) {
					const errValue = result.unwrapErr();
					if (errValue === StackValueAssignmentError.ReassignConstant) {
						this.runtimeError(
							`Unable to reassign constant or readonly '${identifier.name}'`,
							ZrRuntimeErrorCode.ReassignConstant,
							node,
						);
					}
				}
			}
		} else {
			// TODO: implement
			this.runtimeError("Not yet implemented", ZrRuntimeErrorCode.EvaluationError);
		}

		return undefined;
	}

	private evaluateObjectNode(node: ObjectLiteral): ZrObject {
		const object = new ZrObject();
		for (const property of node.values) {
			const value = this.evaluateNode(property.initializer);
			this.runtimeAssertNotUndefined(
				value,
				"No value",
				ZrRuntimeErrorCode.NodeValueError,
				property.initializer,
			);
			object.set(property.name.name, value);
		}

		return object;
	}

	private evaluateFunctionDeclaration(node: FunctionDeclaration): ZrUserFunction {
		const declaration = new ZrUserFunction(node);
		this.locals.setLocal(node.name.name, declaration, true);
		return declaration;
	}

	private evaluateEnumDeclaration(node: EnumDeclarationStatement): ZrEnum {
		const { name } = node.name;

		const declaration = ZrEnum.fromArray(
			name,
			node.values.map(value => value.name.name),
		);

		$print(declaration.getItems(), "declaration");
		this.locals.setLocal(name, declaration, true);
		return declaration;
	}

	private evaluateFunctionExpression(node: FunctionExpression): ZrUserFunction {
		return new ZrUserFunction(node);
	}

	private evaluateArrayNode(node: ArrayLiteralExpression): Array<ZrValue> {
		const values = new Array<ZrValue>();
		let index = 0;
		for (const subNode of node.values) {
			const value = this.evaluateNode(subNode);
			this.runtimeAssertNotUndefined(
				value,
				"Array value is NONE at index " + index,
				ZrRuntimeErrorCode.NodeValueError,
				subNode,
			);
			if (value === ZrUndefined) {
				break;
			}

			values.push(value);
			index++;
		}

		return values;
	}

	private evaluateIfStatement(node: IfStatement): void {
		const { condition, elseStatement, thenStatement } = node;
		assert(condition);
		const resultOfCondition = this.evaluateNode(condition);
		this.runtimeAssertNotUndefined(
			condition,
			"Condition not valid?",
			ZrRuntimeErrorCode.EvaluationError,
			condition,
		);

		const isTruthy =
			resultOfCondition !== undefined &&
			resultOfCondition !== false &&
			resultOfCondition !== ZrUndefined;

		if (isTruthy && thenStatement !== undefined) {
			this.evaluateNode(thenStatement);
		} else if (elseStatement !== undefined) {
			this.evaluateNode(elseStatement);
		}
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private evaluateForInStatement(node: ForInStatement): void {
		const { initializer, statement } = node;
		let { expression } = node;

		// Shortcut a parenthesized expression
		if (isNode(expression, ZrNodeKind.ParenthesizedExpression)) {
			expression = expression.expression;
		}

		let value: undefined | ZrUndefined | ZrValue;

		if (isNode(expression, ZrNodeKind.Identifier)) {
			value = this.locals.getLocalOrUpValue(expression.name)?.[0] ?? ZrUndefined;
		} else if (
			types.isCallableExpression(expression) ||
			isNode(expression, ZrNodeKind.ArrayLiteralExpression) ||
			isNode(expression, ZrNodeKind.ObjectLiteralExpression) ||
			isNode(expression, ZrNodeKind.BinaryExpression)
		) {
			value = this.evaluateNode(expression);
		} else {
			this.runtimeError(
				"Invalid expression to ForIn statement - expects Array or Object",
				ZrRuntimeErrorCode.InvalidForInExpression,
				expression,
			);
		}

		if (value === ZrUndefined) {
			this.runtimeError(
				"Cannot iterate undefined value",
				ZrRuntimeErrorCode.InvalidIterator,
				expression,
			);
		}

		this.runtimeAssertNotUndefined(
			value,
			"Expression expected",
			ZrRuntimeErrorCode.InvalidForInExpression,
			expression,
		);
		this.runtimeAssert(
			isArray(value) || value instanceof ZrObject || value instanceof ZrRange,
			"Array, Map or Object expected",
			ZrRuntimeErrorCode.InvalidType,
			expression,
		);
		if (value instanceof ZrObject) {
			for (const [k, v] of value.toMap()) {
				this.push();
				this.locals.setLocal(initializer.name, [k, v]);
				this.evaluateNode(statement);
				this.pop();
			}
		} else if (value instanceof ZrRange) {
			for (const item of value.Iterator()) {
				this.push();
				this.locals.setLocal(initializer.name, item);
				this.evaluateNode(statement);
				this.pop();
			}
		} else {
			for (const [, v] of pairs(value)) {
				this.push();
				this.locals.setLocal(initializer.name, v);
				this.evaluateNode(statement);
				this.pop();
			}
		}
	}

	private evaluateArrayIndexExpression(node: ArrayIndexExpression): undefined | ZrValue {
		const { expression, index } = node;
		const value = this.evaluateNode(expression);

		if (value instanceof ZrEnum) {
			const enumValue = value.getItemByIndex(index.value);
			if (!enumValue) {
				this.runtimeAssertNotUndefined(
					value,
					"Index out of range for enum " + index.value,
					ZrRuntimeErrorCode.OutOfRange,
					expression,
				);
			}

			return enumValue;
		}

		this.runtimeAssertNotUndefined(
			value,
			"Attempted to index nil value",
			ZrRuntimeErrorCode.IndexingUndefined,
			expression,
		);
		this.runtimeAssert(
			isArray<ZrValue>(value),
			"Attempt to index " + getTypeName(value) + " with a number",
			ZrRuntimeErrorCode.InvalidArrayIndex,
			index,
		);

		return value[index.value];
	}

	private setUserdata(
		expression: PropertyAccessExpression["expression"],
		userdata: ZrUserdata<defined>,
		key: string,
		value: ZrValue,
	): void {
		if (userdata instanceof ZrInstanceUserdata) {
			this.runtimeError(
				"Runtime Violation: Instance properties are read-only via Zirconium",
				ZrRuntimeErrorCode.InstanceSetViolation,
				expression,
			);
		} else {
			const object = userdata.value() as Record<string, unknown>;
			try {
				object[key] = value;
			} catch (err) {
				this.runtimeError(
					tostring(err),
					ZrRuntimeErrorCode.InstanceSetViolation,
					expression,
				);
			}
		}
	}

	private getUserdata<T extends ZrUserdata<defined>>(
		expression: PropertyAccessExpression["expression"],
		userdata: T,
		key: string,
	): Instance[InferUserdataKeys<T>] | ZrValue {
		if (userdata instanceof ZrInstanceUserdata) {
			try {
				// FIXME: Potential sign of a larger issue?
				return userdata.get(key as InferUserdataKeys<T>) as
					| Instance[InferUserdataKeys<T>]
					| ZrValue;
			} catch (err) {
				this.runtimeError(
					tostring(err),
					ZrRuntimeErrorCode.InstanceGetViolation,
					expression,
				);
			}
		} else {
			const object = userdata.value() as Record<string, ZrValue>;
			return object[key];
		}
	}

	// eslint-disable-next-line max-lines-per-function, id-length -- FIXME: Refactor me pls.
	private evaluatePropertyAccessExpression(
		node: PropertyAccessExpression,
	): typeof ZrUndefined | undefined | ZrValue {
		const { name, expression } = node;
		const value = this.evaluateNode(expression);
		const id = name.name;
		this.runtimeAssertNotUndefined(id, "", ZrRuntimeErrorCode.NodeValueError, name);
		this.runtimeAssertNotUndefined(
			value,
			"Attempted to index nil with " + id,
			ZrRuntimeErrorCode.IndexingUndefined,
			expression,
		);
		if (value instanceof ZrObject) {
			return value.get(id);
		} else if (value instanceof ZrUserdata) {
			return this.getUserdata(expression, value, id);
		} else if (value instanceof ZrEnum) {
			return (
				value.getItemByName(id) ??
				this.runtimeError(
					`${id} is not a valid enum item`,
					ZrRuntimeErrorCode.InvalidEnumItem,
					name,
				)
			);
		} else if (value instanceof ZrEnumItem) {
			if (id === "name") {
				return value.getName();
			} else if (id === "value") {
				return value.getValue();
			}

			this.runtimeError(
				`Attempted to index EnumItem with ${id}`,
				ZrRuntimeErrorCode.InvalidPropertyAccess,
				name,
			);
		} else if (isMap<ZrValue>(value)) {
			return value.get(id);
		} else if (value instanceof ZrRange) {
			const property = ZrRange.properties[id];
			if (property !== undefined) {
				return property(value);
			}

			this.runtimeError(
				`${id} is not a valid member of Range`,
				ZrRuntimeErrorCode.InvalidPropertyAccess,
				name,
			);
		} else {
			this.runtimeError(
				`Attempt to index ${getTypeName(value)} with '${id}'`,
				ZrRuntimeErrorCode.InvalidPropertyAccess,
				name,
			);
		}
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private evaluateFunctionCall(
		node: CallExpression | SimpleCallExpression,
		context: ZrContext,
	): typeof ZrUndefined | undefined | ZrValue {
		const { arguments: callArgs, expression } = node;

		let options = new Array<OptionExpression>();
		if (types.isCallExpression(node)) {
			({ options } = node);
		}

		let matching: undefined | ZrUndefined | ZrValue;
		if (types.isArrayIndexExpression(expression)) {
			throw `Not supported yet`;
		} else if (types.isPropertyAccessExpression(expression)) {
			matching = this.evaluateNode(expression);
		} else {
			matching = this.locals.getLocalOrUpValue(expression.name)?.[0];
		}

		// const matching = this.locals.getLocalOrUpValue(name)?.[0];
		if (matching instanceof ZrUserFunction) {
			this.push();
			const parameters = matching.getParameters();
			for (let index = 0; index < parameters.size(); index++) {
				const parameter = parameters[index];
				const value = callArgs[index];
				if (value !== undefined) {
					const nodeValue = this.evaluateNode(value);
					this.runtimeAssertNotUndefined(
						nodeValue,
						"Huh?",
						ZrRuntimeErrorCode.EvaluationError,
						node,
					);

					if (nodeValue !== ZrUndefined) {
						this.locals.setLocal(parameter.name.name, nodeValue);
					}
				}
			}

			for (const option of options) {
				const value = this.evaluateNode(option.expression);
				if (value !== undefined && value !== ZrUndefined) {
					this.locals.setLocal(option.option.flag, value);
				}
			}

			this.evaluateNode(matching.getBody());
			this.pop();
		} else if (matching instanceof ZrLuauFunction) {
			const args = new Array<ZrUndefined | ZrValue>();
			let index = 0;
			for (const child of callArgs) {
				const value = this.evaluateNode(child);
				if (value !== undefined) {
					args[index] = value;
				}

				index++;
			}

			const result = matching.call(context, ...args);
			if (result !== undefined) {
				return result;
			}
		} else {
			this.runtimeError(
				this.getFullName(expression) + " is not a function",
				ZrRuntimeErrorCode.NotCallable,
				node,
			);
		}
	}

	public getLeafName(id: ArrayIndexExpression | Identifier | PropertyAccessExpression): string {
		if (types.isIdentifier(id)) {
			return id.name;
		} else if (types.isPropertyAccessExpression(id)) {
			return id.name.name;
		}

		return tostring(id.index.value);
	}

	public getFullName(id: ArrayIndexExpression | Identifier | PropertyAccessExpression): string {
		if (types.isIdentifier(id)) {
			return id.name;
		} else if (types.isArrayIndexExpression(id)) {
			return `${this.getFullName(id.expression)}[${id.index.value}]`;
		} else if (types.isPropertyAccessExpression(id)) {
			return `${this.getFullName(id.expression)}.${this.getFullName(id.name)}`;
		}

		return "?";
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	public evaluateBinaryExpression(
		node: BinaryExpression,
		input = ZrInputStream.empty(),
	): typeof ZrUndefined | undefined | ZrValue {
		const { left, operator, right } = node;
		switch (operator) {
			case "|": {
				this.runtimeAssert(
					types.isCallableExpression(left) &&
						(types.isCallableExpression(right) ||
							isNode(right, ZrNodeKind.BinaryExpression)),
					"Pipe expression only works with two command statements",
					ZrRuntimeErrorCode.PipeError,
				);
				const output = new ZrOutputStream();
				const context = ZrContext.createPipedContext(this, input, output);
				const result = this.evaluateFunctionCall(left, context);

				if (result !== undefined && result !== ZrUndefined) {
					output.write(result);
				}

				if (types.isCallableExpression(right)) {
					this.evaluateFunctionCall(
						right,
						ZrContext.createPipedContext(
							this,
							output._toInputStream(),
							this.context.getOutput(),
						),
					);
				} else {
					this.evaluateBinaryExpression(right, output._toInputStream());
				}

				break;
			}
			case "&&": {
				if (types.isCallableExpression(left)) {
					const result = this.evaluateFunctionCall(left, this.context);
					if (result === undefined || (result !== undefined && result !== ZrUndefined)) {
						return this.evaluateNode(right);
					}
				} else {
					const result = this.evaluateNode(left);
					if (result !== undefined && result !== ZrUndefined) {
						return this.evaluateNode(right);
					}
				}

				break;
			}
			case "||": {
				if (types.isCallableExpression(left)) {
					const result = this.evaluateFunctionCall(left, this.context);
					if (result !== undefined || result === ZrUndefined) {
						return this.evaluateNode(right);
					}
				} else {
					this.runtimeError("Binary OR not handled", ZrRuntimeErrorCode.EvaluationError);
				}

				break;
			}
			case "..": {
				const leftValue = this.evaluateNode(left);
				const rightValue = this.evaluateNode(right);
				if (typeIs(leftValue, "number") && typeIs(rightValue, "number")) {
					return new ZrRange(new NumberRange(leftValue, rightValue));
				}

				this.runtimeError(
					"Range operator expects two numbers",
					ZrRuntimeErrorCode.InvalidRangeError,
					node,
				);

				break;
			}
			default: {
				if (operator === "=" && types.isIdentifier(left)) {
					const assignment = this.getLocals().setUpValueOrLocalIfDefined(
						left.name,
						this.evaluateNode(right),
					);
					if (assignment.isErr()) {
						const err = assignment.unwrapErr();
						// eslint-disable-next-line sonar/no-nested-switch -- FIXME: Refactor me pls. Move me to a new function maybe?
						switch (err) {
							case StackValueAssignmentError.ReassignConstant: {
								this.runtimeError(
									`Cannot reassign constant '${left.name}'`,
									ZrRuntimeErrorCode.ReassignConstant,
									left,
								);
							}
							case StackValueAssignmentError.VariableNotDeclared: {
								this.runtimeError(
									`Unable to assign to undeclared '${left.name}' - use 'let' or 'const'`,
									ZrRuntimeErrorCode.UnassignedVariable,
									left,
								);
							}
						}
					} else {
						return assignment.unwrap();
					}
				} else {
					this.runtimeError(
						`Unhandled expression '${operator}'`,
						ZrRuntimeErrorCode.EvaluationError,
					);
				}
			}
		}

		return undefined;
	}

	/**
	 * Evaluates a node and throws if it errors, or something, idk I'm tired.
	 *
	 * @param node - The AST node by which to eval.
	 * @returns The resolved node value or undefined.
	 * @internal
	 */
	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	public evaluateNode(node: Node): undefined | ZrUndefined | ZrValue {
		if (isNode(node, ZrNodeKind.Source)) {
			for (const subNode of node.children) {
				this.evaluateNode(subNode);
			}

			return undefined;
		} else if (isNode(node, ZrNodeKind.String)) {
			return node.text;
		} else if (isNode(node, ZrNodeKind.Identifier)) {
			return this.getLocals().getLocalOrUpValue(node.name)?.[0] ?? ZrUndefined;
		} else if (isNode(node, ZrNodeKind.ArrayIndexExpression)) {
			return this.evaluateArrayIndexExpression(node);
		} else if (isNode(node, ZrNodeKind.PropertyAccessExpression)) {
			return this.evaluatePropertyAccessExpression(node) ?? ZrUndefined;
		} else if (isNode(node, ZrNodeKind.FunctionDeclaration)) {
			return this.evaluateFunctionDeclaration(node);
		} else if (isNode(node, ZrNodeKind.EnumDeclaration)) {
			return this.evaluateEnumDeclaration(node);
		} else if (isNode(node, ZrNodeKind.ParenthesizedExpression)) {
			return this.evaluateNode(node.expression);
		} else if (isNode(node, ZrNodeKind.BinaryExpression)) {
			return this.evaluateBinaryExpression(node);
		} else if (isNode(node, ZrNodeKind.UnaryExpression)) {
			if (node.operator === "!") {
				const result = this.evaluateNode(node.expression);
				return result === false || result === undefined || result === ZrUndefined;
			}
		} else if (isNode(node, ZrNodeKind.UndefinedKeyword)) {
			return ZrUndefined;
		} else if (isNode(node, ZrNodeKind.ExpressionStatement)) {
			const value = this.evaluateNode(node.expression);
			if (value !== undefined) {
				this.context.getOutput().write(value);
			}
		} else if (isNode(node, ZrNodeKind.ForInStatement)) {
			this.evaluateForInStatement(node);
		} else if (isNode(node, ZrNodeKind.IfStatement)) {
			this.evaluateIfStatement(node);
		} else if (isNode(node, ZrNodeKind.ObjectLiteralExpression)) {
			return this.evaluateObjectNode(node);
		} else if (isNode(node, ZrNodeKind.ArrayLiteralExpression)) {
			return this.evaluateArrayNode(node);
		} else if (isNode(node, ZrNodeKind.Number) || isNode(node, ZrNodeKind.Boolean)) {
			return node.value;
		} else if (isNode(node, ZrNodeKind.InterpolatedString)) {
			return this.getLocals().evaluateInterpolatedString(node);
		} else if (isNode(node, ZrNodeKind.VariableStatement)) {
			// eslint-disable-next-line ts/no-confusing-void-expression -- FIXME: May not always be void, this could be a type error?
			return this.executeSetVariable(node.declaration);
		} else if (isNode(node, ZrNodeKind.FunctionExpression)) {
			return this.evaluateFunctionExpression(node);
		} else if (isNode(node, ZrNodeKind.Block)) {
			this.push();
			for (const statement of node.statements) {
				this.evaluateNode(statement);
			}

			this.pop();
		} else if (types.isCallableExpression(node)) {
			return this.evaluateFunctionCall(node, this.context);
		} else {
			this.runtimeError(
				`Failed to evaluate ${getFriendlyName(node)}`,
				ZrRuntimeErrorCode.EvaluationError,
				node,
			);
		}
	}

	public getExecutingPlayer(): Player | undefined {
		return this.executingPlayer;
	}

	public execute(): ZrOutputStream {
		this.evaluateNode(this.source);
		return this.context.getOutput();
	}
}
