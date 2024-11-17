import prettyPrintNodes from "./utility/pretty-print-nodes";
import ZrLexer from "./lexer";
import ZrTextStream from "./text-stream";
import ZrParser from "./parser";
import ZrRichTextHighlighter from "./syntax/richtext-highlighter";
import * as factory from "./nodes/create";
import * as ZrVisitors from "./utility/node-visitor";
import { typeGuards as types } from "./nodes";
import { $package } from "rbxts-transform-debug";

const AST_VERSION = $package.version;

export {
	ZrVisitors,
	ZrLexer,
	ZrParser,
	ZrTextStream,
	ZrRichTextHighlighter,
	prettyPrintNodes,
	factory,
	AST_VERSION,
	types,
};

export * from "./nodes/guards";
