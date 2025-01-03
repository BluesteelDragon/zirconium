import Zr from "@zirconium";
import { prettyPrintNodes, ZrLexer, ZrTextStream } from "@zirconium/ast";
import { ZrScriptVersion } from "@zirconium/ast/parser";
import { Token } from "@zirconium/ast/tokens/tokens";
import { ZrEnum } from "@zirconium/data/enum";
import ZrLuauFunction from "@zirconium/data/luau-function";
import ZrObject from "@zirconium/data/object";
import { ZrValue } from "@zirconium/data/locals";
import ZrUndefined from "@zirconium/data/undefined";
import { ZrUserdata } from "@zirconium/data/userdata";
import { ZrDebug, ZrPrint, ZrRange } from "@zirconium/functions/builtin-functions";

const globals = Zr.createContext();
globals.registerGlobal("print", ZrPrint);
globals.registerGlobal("range", ZrRange);
globals.registerGlobal("debug", ZrDebug);
globals.registerGlobal("TestEnum", ZrEnum.fromArray("TestEnum", ["A", "B"]));
globals.registerGlobal(
	"values",
	new ZrLuauFunction((context, ...args) => {
		return `[ ${args.map(tostring).join(", ")} ]`;
	}),
);
globals.registerGlobal("null", (ZrUndefined as unknown) as ZrValue);
globals.registerGlobal(
	"test",
	ZrObject.fromRecord({
		example: new ZrLuauFunction((_, input) => {
			print("Example worked", input);
		}),
	}),
);

game.GetService("Players").PlayerAdded.Connect((player) => {
	const playerContext = Zr.createPlayerContext(player);
	playerContext.registerGlobal("player", ZrUserdata.fromInstance(player));
	playerContext.importGlobals(globals);

	const source = `print( -10 )`;

	const tokenizer = new ZrLexer(new ZrTextStream(source));
	const results = new Array<Token>();
	while (tokenizer.hasNext()) {
		results.push(tokenizer.next()!);
	}
	print("tokens", results);

	const sourceResult = playerContext.parseSource(source, ZrScriptVersion.Zr2022);
	sourceResult.match(
		(sourceFile) => {
			prettyPrintNodes([sourceFile]);

			const sourceScript = playerContext.createScript(sourceFile);
			// sourceScript._printScriptGlobals();
			sourceScript.executeOrThrow();
		},
		(err) => {
			const { message, errors } = err;

			warn(
				`${message} - ` +
					errors
						.map((e) => {
							if (e.token) {
								return `[${e.token.startPos}:${e.token.endPos}] ${e.message} '${e.token.value}'`;
							} else if (e.node) {
								return `<${e.node.kind}> ${e.message}`;
							}

							return e.message;
						})
						.join(", "),
			);
		},
	);
});
