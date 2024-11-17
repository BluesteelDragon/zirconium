import { $print } from "rbxts-transform-debug";

import type { SourceFile } from "../ast/nodes/node-types";
import type { ZrValue } from "../data/locals";
import ZrLocalStack from "../data/locals";
import type ZrLuauFunction from "../data/luau-function";
import type { ZrRuntimeError } from "./runtime";
import ZrRuntime from "./runtime";

export default class ZrScript {
	private readonly runtime: ZrRuntime;

	constructor(source: SourceFile, globalVariables: Map<string, ZrValue>, player?: Player) {
		const globals = new ZrLocalStack(globalVariables);
		this.runtime = new ZrRuntime(source, globals, player);
	}

	/**
	 * Registers a function in the script.
	 *
	 * @param name - The identifier of this function.
	 * @param func - The ZrLuauFunction itself.
	 */
	public registerFunction(name: string, func: ZrLuauFunction): void {
		// ?
		this.runtime.getLocals().setGlobal(name, func, true);
	}

	/**
	 * Executes the parsed script using the ZrRuntime and will resolve with an
	 * array of the results of the execution. If the runtime encounters errors,
	 * it will reject with an array of these errors.
	 *
	 * @returns Execution results or execution errors.
	 */
	public async execute(): Promise<ReadonlyArray<string>> {
		return Promise.defer<ReadonlyArray<string>>(
			(
				resolve: (value: ReadonlyArray<string>) => void,
				reject: (err: Array<ZrRuntimeError>) => void,
			) => {
				try {
					resolve(this.runtime.execute()._toStringArray());
				} catch {
					reject(this.runtime.getErrors());
				}
			},
		);
	}

	/**
	 * Runs the same as `execute`, however does not return a result and instead:
	 *
	 * - Will throw on rejection.
	 * - Will dump results to stdout.
	 *
	 * This seems to just be for debugging.
	 */
	public executeOrThrow(): void {
		const results = this.runtime.execute().toArray();
		for (const result of results) {
			$print(">", result);
		}
	}

	/**
	 * Testing function.
	 *
	 * @internal
	 */
	public _printScriptGlobals(): void {
		for (const [name, value] of this.runtime.getLocals().toMap()) {
			print(name, value);
		}
	}
}
