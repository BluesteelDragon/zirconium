// eslint-disable-next-line max-classes-per-file -- FIXME: Refactor into multiple files.
import { isNode, ZrNodeKind } from "../ast/nodes";
import type { Node, SourceFile } from "../ast/nodes/node-types";

export interface ZrBinder {
	// TODO
	bind(): void;
}

export enum ZrSymbolKind {
	Source,
	Function,
	Variable,
}

export interface ZrSymbol {
	kind: ZrSymbolKind;
	name: string;
}

interface FileSymbol extends ZrSymbol {
	kind: ZrSymbolKind.Source;
}

interface FunctionSymbol extends ZrSymbol {
	kind: ZrSymbolKind.Function;
}

interface VariableSymbol extends ZrSymbol {
	kind: ZrSymbolKind.Variable;
}

interface ZrSymbolMap {
	[ZrSymbolKind.Function]: FunctionSymbol;
	[ZrSymbolKind.Source]: FileSymbol;
	[ZrSymbolKind.Variable]: VariableSymbol;
}

type ZrSymbols = ZrSymbolMap[keyof ZrSymbolMap];

export class ZrSymbolTable {
	public symbols = new Array<ZrSymbols>();
	public hasSymbolById(symbolId: string): undefined | ZrSymbols {
		return this.symbols.find(symbol => symbol.name === symbolId);
	}

	public addSymbol(symbol: ZrSymbols): void {
		throw "no impl";
	}
}

/** @internal */
export class ZrBinder implements ZrBinder {
	private readonly currentSymbol: ZrSymbols;
	private readonly symbolMap = new Array<ZrSymbols>();
	private readonly symbolStack = new Array<ZrSymbols>();

	constructor(private readonly source: SourceFile) {
		this.currentSymbol = {
			name: "<source>",
			kind: ZrSymbolKind.Source,
		};
		this.symbolStack.push(this.currentSymbol);
	}

	private getSymbolNameFor(node: Node): string | undefined {
		if (isNode(node, ZrNodeKind.Identifier)) {
			return "id:" + node.name;
		}
	}

	public bindNode(node: Node, _parentSymbol?: ZrSymbols): void {
		if (isNode(node, ZrNodeKind.Source)) {
			for (const child of node.children) {
				this.bindNode(child);
			}
		} else if (isNode(node, ZrNodeKind.VariableDeclaration)) {
			const _id = this.getSymbolNameFor(node);
		}
	}

	public bind(): void {
		throw "no impl";
	}
}
