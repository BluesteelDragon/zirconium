import type { ZrValue } from "../data/locals";
import type { ZrLuauArgument } from "../data/luau-function";
import ZrLuauFunction from "../data/luau-function";
import { isArray, isMap } from "../util";

const runService = game.GetService("RunService");

export function stringify(value: ZrLuauArgument): string {
	if (isArray(value)) {
		return "[" + (value.map(v => stringify(v)).join(", ") || " ") + "]";
	} else if (isMap<ZrValue>(value)) {
		const values = new Array<string>();
		for (const [k, v] of value) {
			values.push(`${k}: ${stringify(v)}`);
		}

		return values.join(", ");
	} else if (typeIs(value, "table")) {
		return tostring(value);
	}

	return tostring(value);
}

export const ZrPrint = ZrLuauFunction.createDynamic((context, ...parameters) => {
	const input = context.getInput();
	if (input.isEmpty()) {
		print(parameters.map(parameter => stringify(parameter)).join(" "));
	} else {
		print(
			input
				.toArray()
				.map(p => stringify(p))
				.join(" "),
		);
	}
});

export const ZrRange = ZrLuauFunction.createDynamic((context, start, stop) => {
	if (!typeIs(start, "number") || !typeIs(stop, "number")) {
		return;
	}

	const array = new Array<number>(stop - start);
	for (let index = 0; index <= stop - start; index++) {
		array.push(start + index);
	}

	return array;
});

export const ZrDebug = ZrLuauFunction.createDynamic(context => {
	assert(runService.IsStudio());
	const locals = context.getLocals();
	locals.print();
});
