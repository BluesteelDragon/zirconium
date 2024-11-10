import type { ZrValue } from "data/locals";
import type { ZrLuauArgument } from "data/luau-function";
import ZrPlayerScriptContext from "runtime/player-script-context";

import ZrScriptContext from "./runtime/script-context";

/** Zirconium Language Namespace. */
namespace Zr {
	const contexts = new Map<string, ZrScriptContext>();

	/**
	 * Create a new Zirconium script context to execute code against.
	 *
	 * @param name - The name by which this context is known (used to avoid
	 *   duplicates).
	 * @returns A new ZrScriptContext for execution.
	 */
	export function createContext(
		name = game.GetService("HttpService").GenerateGUID(),
	): ZrScriptContext {
		if (contexts.has(name)) {
			throw `Context '${name}' already exists.`;
		}

		const context = new ZrScriptContext();
		contexts.set(name, context);
		return context;
	}

	export function createPlayerContext(
		player: Player,
		name = game.GetService("HttpService").GenerateGUID(),
	): ZrPlayerScriptContext {
		if (contexts.has(name)) {
			throw `Context '${name}' already exists.`;
		}

		const context = new ZrPlayerScriptContext(player);
		contexts.set(name, context);
		return context;
	}

	export type Value = ZrValue;
	export type Argument = ZrLuauArgument;
}

export = Zr;
