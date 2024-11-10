import { Result } from "@rbxts/rust-classes";

import { ZrLexer, ZrTextStream } from "../ast";
import type { SourceFile } from "../ast/nodes/node-types";
import type { ZrParserError } from "../ast/parser";
import ZrParser, { ZrScriptMode, ZrScriptVersion } from "../ast/parser";
import type ZrContext from "../data/context";
import type { ZrValue } from "../data/locals";
import type { ZrLuauArgument } from "../data/luau-function";
import ZrLuauFunction from "../data/luau-function";
import ZrScript from "./script";

export enum ZrScriptCreateResult {
	ParserError = 0,
	Ok,
}

interface ZrCreateScriptSuccess {
	current: ZrScript;
	result: ZrScriptCreateResult.Ok;
}
interface ZrCreateScriptError {
	errors: ReadonlyArray<ZrParserError>;
	message: string;
	result: ZrScriptCreateResult.ParserError;
}
type ZrCreateScriptResult = ZrCreateScriptError | ZrCreateScriptSuccess;

export default class ZrScriptContext {
	private globals = identity<Record<string, ZrValue>>({});

	/**
	 * Register a global against this execution context to be exposed to the
	 * script.
	 *
	 * @param name - The identifier of the global.
	 * @param value - The actual Zirconium-compatible object that this
	 *   identifier refers to.
	 */
	public registerGlobal(name: string, value: ZrValue): void {
		this.globals[name] = value;
	}

	public importGlobals(context: ZrScriptContext): void {
		for (const [name, global] of pairs(context.globals)) {
			this.globals[name] = global;
		}
	}

	public registerLuauFunction(
		name: string,
		func: (context: ZrContext, ...args: Array<ZrLuauArgument>) => undefined | ZrValue,
	): void {
		this.registerGlobal(name, new ZrLuauFunction(func));
	}

	protected getGlobals(): Map<string, ZrValue> {
		const localMap = new Map<string, ZrValue>();
		for (const [key, value] of pairs(this.globals)) {
			localMap.set(key, value);
		}

		return localMap;
	}

	/**
	 * Creates a script from the specified source.
	 *
	 * @param nodes - The source nodes.
	 * @returns The generated script object.
	 */
	public createScript(nodes: SourceFile): ZrScript {
		return new ZrScript(nodes, this.getGlobals());
	}

	/**
	 * Creates a source file, and returns a `Result<T, E>` of the result of
	 * parsing the file.
	 *
	 * @param source - The script source itself.
	 * @param version - The version of the Zirconium AST to run against.
	 * @param mode - The execution mode of this script.
	 * @returns A result object containing the parse result of the script. If it
	 *   parses correctly, it may be unwrapped to execute the script, if not it
	 *   can be unwrapped for error details.
	 */
	public parseSource(
		source: string,
		version = ZrScriptVersion.Zr2020,
		mode = ZrScriptMode.CommandLike,
	): Result<SourceFile, ZrCreateScriptError> {
		const stream = new ZrTextStream(source);
		const lexer = new ZrLexer(stream);
		const parser = new ZrParser(lexer, { mode, version });

		try {
			const nodes = parser.parseOrThrow();
			return Result.ok(nodes);
		} catch (err) {
			warn(err);
			return Result.err(
				identity<ZrCreateScriptError>({
					errors: parser.getErrors(),
					message: tostring(err),
					result: ZrScriptCreateResult.ParserError,
				}),
			);
		}
	}
}
