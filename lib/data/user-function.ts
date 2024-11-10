import { isNode } from "../ast";
import { ZrNodeKind } from "../ast/nodes";
import type {
	FunctionDeclaration,
	FunctionExpression,
	ParameterDeclaration,
	SourceBlock,
} from "../ast/nodes/node-types";

/** A function declared by a user. */
export default class ZrUserFunction {
	private readonly body: SourceBlock;
	private readonly name?: string;
	private readonly parameters: Array<ParameterDeclaration>;

	constructor(declaration: FunctionDeclaration | FunctionExpression) {
		this.parameters = declaration.parameters;
		this.body = declaration.body;
		if (isNode(declaration, ZrNodeKind.FunctionDeclaration)) {
			this.name = declaration.name.name;
		}
	}

	public getParameters(): ReadonlyArray<ParameterDeclaration> {
		return this.parameters;
	}

	public getBody(): SourceBlock {
		return this.body;
	}

	public toString(): string {
		return `function ${this.name ?? ""}(${this.parameters.map(parameter => parameter.name.name).join(", ")}) {...}`;
	}
}
