import { Result } from "@rbxts/rust-classes";

import { isNode, ZrNodeKind } from "../ast/nodes";
import type { InterpolatedStringExpression } from "../ast/nodes/node-types";
import type { ZrEnum } from "./enum";
import type { ZrEnumItem } from "./enum-item";
import ZrLuauFunction from "./luau-function";
import type ZrObject from "./object";
import type ZrRange from "./range";
import ZrUndefined from "./undefined";
import type ZrUserFunction from "./user-function";
import type { ZrUserdata } from "./userdata";

export type ZrValue =
	| Array<ZrValue>
	| boolean
	| Map<string, ZrValue>
	| number
	| string
	| ZrEnum
	| ZrEnumItem
	| ZrLuauFunction
	| ZrObject
	| ZrRange
	| ZrUserdata<defined>
	| ZrUserFunction;

export const enum StackValueType {
	Constant,
	Function,
}

type StackValue = [value: ZrUndefined | ZrValue, constant?: boolean, exports?: StackValueType];

export const enum StackValueAssignmentError {
	ReassignConstant,
	VariableNotDeclared,
}

export default class ZrLocalStack {
	private readonly locals = new Array<Map<string, StackValue>>();

	constructor(inject?: ReadonlyMap<string, ZrValue>) {
		if (inject === undefined) {
			return;
		}

		const newLocals = new Map<string, StackValue>();
		for (const [name, value] of pairs(inject)) {
			newLocals.set(name, [value, value instanceof ZrLuauFunction]);
		}

		this.locals.push(newLocals);
	}

	public print(): void {
		print("=== stack ===");
		for (const [index, localStack] of ipairs(this.locals)) {
			for (const [key, value] of localStack) {
				print("░".rep(index - 1), key, value);
			}
		}

		print("=== end stack ===");
	}

	private current(): Map<string, StackValue> {
		return this.locals[this.locals.size() - 1];
	}

	/**
	 * Will set the value on the first stack.
	 *
	 * @param name
	 * @param value
	 * @param constant
	 * @internal
	 */
	public setGlobal(name: string, value: ZrValue, constant?: boolean): void {
		const first = this.locals[0];
		first.set(name, [value, constant]);
	}

	/**
	 * Gets the specified global.
	 *
	 * @param name
	 * @returns
	 */
	public getGlobal(name: string): StackValue | undefined {
		const first = this.locals[0];
		return first.get(name);
	}

	/**
	 * Will set the value at the stack it was first declared.
	 *
	 * @param name
	 * @param value
	 * @param constant
	 * @returns
	 * @internal
	 */
	public setUpValueOrLocal(
		name: string,
		value: undefined | ZrUndefined | ZrValue,
		constant?: boolean,
	): Result<ZrUndefined | ZrValue, StackValueAssignmentError> {
		const stack = this.getUpValueStack(name) ?? this.current();
		const stackValue = stack.get(name);
		if (stackValue) {
			const [, constant] = stackValue;
			if (constant) {
				return Result.err(StackValueAssignmentError.ReassignConstant);
			}
		}

		if (value !== undefined && value !== ZrUndefined) {
			stack.set(name, [value, constant]);
			return Result.ok(value);
		}

		stack.delete(name);
		return Result.ok(ZrUndefined);
	}

	public setUpValueOrLocalIfDefined(
		name: string,
		value: undefined | ZrUndefined | ZrValue,
	): Result<ZrUndefined | ZrValue, StackValueAssignmentError> {
		const stack = this.getUpValueStack(name) ?? this.current();
		const existingValue = stack.get(name);
		if (existingValue !== undefined) {
			if (value === ZrUndefined || value === undefined) {
				return this.setUpValueOrLocal(name, ZrUndefined);
			}

			return this.setUpValueOrLocal(name, value);
		}

		return Result.err(StackValueAssignmentError.VariableNotDeclared);
	}

	/**
	 * Will set the value on the last stack.
	 *
	 * @param name
	 * @param value
	 * @param constant
	 * @internal
	 */
	public setLocal(name: string, value: undefined | ZrValue, constant?: boolean): void {
		const last = this.current();
		if (value === undefined) {
			last.set(name, [ZrUndefined, constant]);
		} else {
			last.set(name, [value, constant]);
		}
	}

	/**
	 * Gets the stack (if any) the local is declared at.
	 *
	 * @param name
	 * @returns
	 * @internal
	 */
	private getUpValueStack(name: string): Map<string, StackValue> | undefined {
		for (const currentLocals of this.locals) {
			if (currentLocals.has(name)) {
				return currentLocals;
			}
		}
	}

	/**
	 * Gets the value of a local (or the upvalue if it's not local to this
	 * stack).
	 *
	 * @param name
	 * @returns
	 * @internal
	 */
	public getLocalOrUpValue(name: string): StackValue | undefined {
		for (let index = this.locals.size() - 1; index >= 0; index--) {
			const stack = this.locals[index];
			if (stack.has(name)) {
				return stack.get(name);
			}
		}

		return;
	}

	/**
	 * Pops a value from the stack.
	 *
	 * @returns
	 * @internal
	 */
	public pop(): Map<string, StackValue> | undefined {
		return this.locals.pop();
	}

	/**
	 * Pushes a value into the stack.
	 *
	 * @internal
	 */
	public push(): void {
		this.locals.push(new Map<string, StackValue>());
	}

	public toMap(): ReadonlyMap<string, ZrValue> {
		const map = new Map<string, ZrUndefined | ZrValue>();
		for (const currentLocals of this.locals) {
			currentLocals.forEach((value, key) => map.set(key, value[0]));
		}

		return map as ReadonlyMap<string, ZrValue>;
	}

	/**
	 * Evaluates an interpolated string expression and returns the interpolated
	 * value.
	 *
	 * @param expression
	 * @returns
	 * @internal
	 */
	public evaluateInterpolatedString(expression: InterpolatedStringExpression): string {
		let text = "";
		for (const value of expression.values) {
			text += isNode(value, ZrNodeKind.Identifier)
				? tostring(this.getLocalOrUpValue(value.name) ?? "")
				: value.text;
		}

		return text;
	}
}
