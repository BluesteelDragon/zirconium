import { describe, expect, it } from "@rbxts/jest-globals";

import Zr from "..";
import { prettyPrintNodes } from "../ast";
import { ZrScriptVersion } from "../ast/parser";
import { ZrEnum } from "../data/enum";
import type { ZrValue } from "../data/locals";
import ZrLuauFunction from "../data/luau-function";
import ZrObject from "../data/object";
import ZrUndefined from "../data/undefined";
import { ZrDebug, ZrPrint, ZrRange } from "../functions/builtin-functions";
import ZrScriptContext from "../runtime/script-context";

// eslint-disable-next-line max-lines-per-function -- Describe
describe("Zr Context utility", () => {
	it("should return a ZrScriptContext", () => {
		expect(Zr.createContext("test")).toBeInstanceOf(ZrScriptContext);
	});
	it("should disallow duplicate Context names", () => {
		expect(Zr.createContext("test")).toThrowError("Context 'test' already exists.");
	});
	// eslint-disable-next-line max-lines-per-function -- thing
	it("should execute a ZrScript", () => {
		const globals = Zr.createContext();
		globals.registerGlobal("print", ZrPrint);
		globals.registerGlobal("range", ZrRange);
		globals.registerGlobal("debug", ZrDebug);
		globals.registerGlobal("TestEnum", ZrEnum.fromArray("TestEnum", ["A", "B"]));
		globals.registerGlobal(
			"values",
			new ZrLuauFunction((context, ...args) => `[ ${args.map(tostring).join(", ")} ]`),
		);
		globals.registerGlobal("null", ZrUndefined as unknown as ZrValue);
		globals.registerGlobal(
			"test",
			ZrObject.fromRecord({
				example: new ZrLuauFunction((_, input) => {
					print("Example worked", input);
				}),
			}),
		);

		const scriptContext = Zr.createContext();
		scriptContext.importGlobals(globals);

		const source = "print(-10)";

		const sourceResult = scriptContext.parseSource(source, ZrScriptVersion.Zr2022);
		sourceResult.match(
			sourceFile => {
				prettyPrintNodes([sourceFile]);
				const sourceScript = scriptContext.createScript(sourceFile);
				sourceScript.executeOrThrow();
			},
			err => {
				const { errors, message } = err;
				warn(
					`${message} - ` +
						errors
							.map(err_ => {
								if (err_.token) {
									return `[${err_.token.startPos}:${err_.token.endPos}] ${err_.message} '${err_.token.value}'`;
								} else if (err_.node) {
									return `<${err_.node.kind}> ${err_.message}`;
								}

								return err_.message;
							})
							.join(", "),
				);
			},
		);

		expect(Zr.createContext()).toBeInstanceOf(ZrScriptContext);
	});
});

export = true;
