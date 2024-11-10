import type ZrContext from "./context";
import type { ZrValue } from "./locals";
import type ZrUndefined from "./Undefined";

/**
 * A lua-side function.
 *
 * Where the real magic happens.
 */
type TypeId = "boolean" | "number" | "string";
type InferTypeName<T> = T extends "string"
	? string
	: T extends "number"
		? number
		: T extends "boolean"
			? boolean
			: never;

type ArgumentTypes<T> = { readonly [P in keyof T]: InferTypeName<T[P]> };

export type ZrLuauArgument = ZrUndefined | ZrValue;
export default class ZrLuauFunction {
	constructor(
		private readonly callback: (
			context: ZrContext,
			...args: ReadonlyArray<ZrLuauArgument>
		) => void | ZrUndefined | ZrValue,
	) {}

	/**
	 * Create a dynamic function (one that takes any value per argument).
	 *
	 * @param func - The luau-side function callback.
	 * @returns A ZrLuauFunction that can be used within the runtime.
	 */
	public static createDynamic(
		func: (context: ZrContext, ...args: ReadonlyArray<ZrLuauArgument>) => void | ZrValue,
	): ZrLuauFunction {
		return new ZrLuauFunction(func);
	}

	/**
	 * Calls the function's callback and returns the results, if any are
	 * returned.
	 *
	 * @param context - The ZrContext this was called from within.
	 * @param args - The args passed to this function at the call site.
	 * @returns Any results from the luau-side function, if any are returned in
	 *   the first place, else void.
	 * @internal
	 */
	public call(
		context: ZrContext,
		...args: Array<ZrLuauArgument>
	): typeof ZrUndefined | void | ZrValue {
		return this.callback(context, ...args);
	}

	public toString(): string {
		return "function (...) { [native] }";
	}
}
