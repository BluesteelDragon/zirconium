/* eslint-disable max-lines -- FIXME: Refactor me pls. Split me up! */
import type { ZrTypeKeyword } from "./enum";
import { ZrNodeFlag, ZrNodeKind } from "./enum";
import { isNode } from "./guards";
import type {
	ArrayIndexExpression,
	ArrayLiteralExpression,
	BinaryExpression,
	BooleanLiteral,
	CallExpression,
	EndOfStatement,
	EnumDeclarationStatement,
	EnumItemExpression,
	ExportKeyword,
	Expression,
	ExpressionStatement,
	ForInStatement,
	FunctionDeclaration,
	FunctionExpression,
	Identifier,
	IfStatement,
	InnerExpression,
	InterpolatedStringExpression,
	InvalidNode,
	Node,
	NodeError,
	NodeTypes,
	NumberLiteral,
	ObjectLiteral,
	OperatorToken,
	Option as OptionKey,
	OptionExpression,
	ParameterDeclaration,
	ParenthesizedExpression,
	PrefixExpression,
	PrefixToken,
	PropertyAccessExpression,
	PropertyAssignment,
	RangeExpression,
	ReturnStatement,
	SimpleCallExpression,
	SourceBlock,
	SourceFile,
	Statement,
	StringLiteral,
	TypeReference,
	UnaryExpression,
	UndefinedKeyword,
	VariableDeclaration,
	VariableStatement,
} from "./node-types";

function createNode<T extends keyof NodeTypes>(kind: T): Writable<NodeTypes[T & ZrNodeKind]> {
	return {
		flags: 0,
		kind,
	} as Writable<NodeTypes[T & ZrNodeKind]>;
}

/**
 * @param node
 * @param props
 * @internal
 */
export function updateNodeInternal<TNode extends Node>(node: TNode, props: Partial<TNode>): TNode {
	for (const [key, property] of pairs(props)) {
		/** @ts-ignore -- Seems to be acceptable. */
		node[key] = property;
	}

	return node;
}

export function createInterpolatedString(
	...values: InterpolatedStringExpression["values"]
): InterpolatedStringExpression {
	const node = createNode(ZrNodeKind.InterpolatedString);
	node.values = values;
	node.children = values;
	return node;
}

export function createReturnStatement(expression: Expression): Writable<ReturnStatement> {
	const node = createNode(ZrNodeKind.ReturnStatement);
	node.expression = expression;
	node.children = [expression];
	return node;
}

export function createArrayLiteral(
	values: ArrayLiteralExpression["values"],
): Writable<ArrayLiteralExpression> {
	const node = createNode(ZrNodeKind.ArrayLiteralExpression);
	node.values = values;
	node.children = values;
	return node;
}

export function createEnumDeclaration(
	name: Identifier,
	values: EnumDeclarationStatement["values"],
): Writable<EnumDeclarationStatement> {
	const node = createNode(ZrNodeKind.EnumDeclaration);
	node.name = name;
	node.values = values;
	node.children = values;
	return node;
}

export function createEnumItemExpression(name: Identifier): Writable<EnumItemExpression> {
	const node = createNode(ZrNodeKind.EnumItemExpression);
	node.name = name;
	return node;
}

export function withError<T extends Node>(node: T): T {
	node.flags |= ZrNodeFlag.NodeHasError;
	return node;
}

export function createExportKeyword(): ExportKeyword {
	return createNode(ZrNodeKind.ExportKeyword);
}

export function createUndefined(): UndefinedKeyword {
	return createNode(ZrNodeKind.UndefinedKeyword);
}

export function createPropertyAssignment(
	name: PropertyAssignment["name"],
	initializer: PropertyAssignment["initializer"],
): Writable<PropertyAssignment> {
	const node = createNode(ZrNodeKind.PropertyAssignment);
	node.name = name;
	node.initializer = initializer;
	node.children = [name, initializer];
	return node;
}

export function createObjectLiteral(values: ObjectLiteral["values"]): Writable<ObjectLiteral> {
	const node = createNode(ZrNodeKind.ObjectLiteralExpression);
	node.values = values;
	node.children = values;
	return node;
}

export function createArrayIndexExpression(
	expression: ArrayIndexExpression["expression"],
	index: ArrayIndexExpression["index"],
): Writable<ArrayIndexExpression> {
	const node = createNode(ZrNodeKind.ArrayIndexExpression);
	node.expression = expression;
	node.index = index;
	node.children = [expression, index];
	return node;
}

export function createPropertyAccessExpression(
	expression: PropertyAccessExpression["expression"],
	name: PropertyAccessExpression["name"],
): Writable<PropertyAccessExpression> {
	const node = createNode(ZrNodeKind.PropertyAccessExpression);
	node.expression = expression;
	node.name = name;
	node.children = [expression, name];
	return node;
}

export function createNodeError(message: string, node: Node): NodeError {
	return {
		message,
		node,
	};
}

export function createIfStatement(
	condition: IfStatement["condition"],
	thenStatement: IfStatement["thenStatement"],
	elseStatement: IfStatement["elseStatement"],
): IfStatement {
	const node = createNode(ZrNodeKind.IfStatement);
	node.condition = condition;
	node.thenStatement = thenStatement;
	node.elseStatement = elseStatement;
	node.children = [];
	if (condition) {
		node.children.push(condition);
	}

	if (thenStatement) {
		node.children.push(thenStatement);
	}

	if (elseStatement) {
		node.children.push(elseStatement);
	}

	return node;
}

export function createExpressionStatement(expression: Expression): Writable<ExpressionStatement> {
	const node = createNode(ZrNodeKind.ExpressionStatement);
	node.expression = expression;
	node.children = [expression];
	return node;
}

export function createRangeExpression(
	left: Expression,
	right: Expression,
): Writable<RangeExpression> {
	const node = createNode(ZrNodeKind.RangeExpression);
	node.left = left;
	node.right = right;
	return node;
}

export function createForInStatement(
	initializer: ForInStatement["initializer"],
	expression: ForInStatement["expression"] | undefined,
	statement: ForInStatement["statement"] | undefined,
): Writable<ForInStatement> {
	const node = createNode(ZrNodeKind.ForInStatement);
	node.initializer = initializer;
	node.children = [initializer];

	if (expression) {
		node.expression = expression;
		node.children.push(expression);
	}

	if (statement) {
		node.statement = statement;
		node.children.push(statement);
	}

	return node;
}

/**
 * Flattens an interpolated string into a regular string.
 *
 * @param expression - The interpolated string expression to flatten.
 * @param variables - The variables for identifiers etc to flatten with.
 * @returns A string literal node with the flattened interpolated string.
 */
export function flattenInterpolatedString(
	expression: InterpolatedStringExpression,
	variables: Record<string, defined>,
): StringLiteral {
	let text = "";
	for (const value of expression.values) {
		text += isNode(value, ZrNodeKind.Identifier) ? tostring(variables[value.name]) : value.text;
	}

	const node = createNode(ZrNodeKind.String);
	node.text = text;
	return node;
}

export function createBlock(statements: Array<Statement>): Writable<SourceBlock> {
	const node = createNode(ZrNodeKind.Block);
	node.statements = statements;
	node.children = statements;
	return node;
}

export function createTypeReference(typeName: TypeReference["typeName"]): TypeReference {
	return identity<TypeReference>({
		flags: 0,
		kind: ZrNodeKind.TypeReference,
		typeName,
		children: [],
	});
}

export function createKeywordTypeNode(keyword: ZrTypeKeyword): TypeReference {
	return createTypeReference(createIdentifier(keyword));
}

export function createParameter(
	name: ParameterDeclaration["name"],
	typeName?: ParameterDeclaration["type"],
): Writable<ParameterDeclaration> {
	const node = createNode(ZrNodeKind.Parameter);
	node.name = name;
	node.type = typeName;
	node.children = [name];
	return node;
}

export function createFunctionExpression(
	parameters: FunctionDeclaration["parameters"],
	body: FunctionDeclaration["body"] | undefined,
): Writable<FunctionExpression> {
	const node = createNode(ZrNodeKind.FunctionExpression);
	node.parameters = parameters;
	node.children = [...parameters];

	if (body) {
		node.body = body;
		node.children.push(body);
	}

	return node;
}

export function createFunctionDeclaration(
	name: FunctionDeclaration["name"],
	parameters: FunctionDeclaration["parameters"],
	body: FunctionDeclaration["body"] | undefined,
): Writable<FunctionDeclaration> {
	const node = createNode(ZrNodeKind.FunctionDeclaration);
	node.name = name;
	node.children = [name];

	node.parameters = parameters;
	if (body) {
		node.body = body;
		node.children.push(body);
	}

	return node;
}

export function createParenthesizedExpression(
	expression: ParenthesizedExpression["expression"],
): Writable<ParenthesizedExpression> {
	const node = createNode(ZrNodeKind.ParenthesizedExpression);
	node.expression = expression;
	node.children = [expression];
	return node;
}

// /** @deprecated Use createCallExpression */
// export function createCommandStatement(command: CommandName, children: Node[], startPos?: number, endPos?: number) {
// 	const statement: CommandStatement = {
// 		kind: ZrNodeKind.CommandStatement,
// 		command,
// 		children,
// 		flags: 0,
// 		startPos: startPos,
// 		endPos,
// 	};
// 	for (const child of statement.children) {
// 		child.parent = statement;
// 	}

// 	return statement;
// }

export function createSimpleCallExpression(
	expression: SimpleCallExpression["expression"],
	args: SimpleCallExpression["arguments"],
	startPosition?: number,
	endPosition?: number,
): Writable<SimpleCallExpression> {
	const node = createNode(ZrNodeKind.SimpleCallExpression);
	node.expression = expression;
	node.arguments = args;
	node.startPos = startPosition;
	node.endPos = endPosition;
	node.children = [expression, ...args];
	return node;
}

// eslint-disable-next-line ts/max-params -- FIXME: Possibly simplify it?
export function createCallExpression(
	expression: CallExpression["expression"],
	args: CallExpression["arguments"],
	options?: CallExpression["options"],
	startPosition?: number,
	endPosition?: number,
): Writable<CallExpression> {
	const result = createNode(ZrNodeKind.CallExpression);
	result.expression = expression;
	result.arguments = args;
	result.startPos = startPosition;
	result.endPos = endPosition;
	result.options = options ?? [];
	return result;
}

export function createInnerExpression(
	expression: InnerExpression["expression"],
	startPosition?: number,
	endPosition?: number,
): Writable<InnerExpression> {
	const node = createNode(ZrNodeKind.InnerExpression);
	node.expression = expression;
	node.startPos = startPosition;
	node.endPos = endPosition;
	node.children = [expression];
	return node;
}

export function createPrefixToken(value: PrefixToken["value"]): PrefixToken {
	return { flags: 0, kind: ZrNodeKind.PrefixToken, value, children: [] };
}

export function createPrefixExpression(
	prefix: PrefixExpression["prefix"],
	expression: PrefixExpression["expression"],
): PrefixExpression {
	const node = createNode(ZrNodeKind.PrefixExpression);
	node.prefix = prefix;
	node.expression = expression;
	node.children = [prefix, expression];
	return node;
}

export function createSourceFile(children: SourceFile["children"]): SourceFile {
	const statement: SourceFile = { flags: 0, kind: ZrNodeKind.Source, children };
	for (const child of statement.children) {
		child.parent = statement;
	}

	return statement;
}

export function createStringNode(text: string, quotes?: string): StringLiteral {
	// return { kind: ZrNodeKind.String, text, quotes, flags: 0 };
	const node = createNode(ZrNodeKind.String);
	node.text = text;
	node.quotes = quotes;
	return node;
}

export function createNumberNode(value: number): NumberLiteral {
	const node = createNode(ZrNodeKind.Number);
	node.value = value;
	return node;
}

export function createIdentifier(name: string, prefix = "$"): Identifier {
	const node = createNode(ZrNodeKind.Identifier);
	node.name = name;
	node.prefix = prefix;
	return node;
}

export function createOptionKey(flag: string, endPosition?: number): OptionKey {
	// return { kind: ZrNodeKind.OptionKey, flag, flags: 0, startPos: endPos ? endPos - flag.size() : 0, endPos };
	const node = createNode(ZrNodeKind.OptionKey);
	node.flag = flag;
	node.startPos = endPosition ? endPosition - flag.size() : 0;
	node.endPos = endPosition;
	return node;
}

export function createOptionExpression(
	option: OptionKey,
	expression: OptionExpression["expression"],
): OptionExpression {
	const node = createNode(ZrNodeKind.OptionExpression);
	node.startPos = option.startPos;
	node.endPos = expression.endPos;
	node.option = option;
	node.expression = expression;
	return node;
}

export function createOperator(
	operator: OperatorToken["operator"],
	startPosition?: number,
): OperatorToken {
	return {
		endPos: (startPosition ?? 0) + operator.size() - 1,
		flags: 0,
		kind: ZrNodeKind.OperatorToken,
		operator,
		startPos: startPosition,
		children: [],
	};
}

export function createVariableDeclaration(
	identifier: ArrayIndexExpression | Identifier | PropertyAccessExpression,
	expression: VariableDeclaration["expression"],
): VariableDeclaration {
	const node = createNode(ZrNodeKind.VariableDeclaration);
	node.flags = ZrNodeFlag.Let;
	node.identifier = identifier;
	node.expression = expression;
	node.children = [identifier, expression];
	node.startPos = identifier.startPos;
	node.endPos = expression.endPos;
	return node;
}

export function createVariableStatement(
	declaration: VariableDeclaration,
	modifiers?: VariableStatement["modifiers"],
): VariableStatement {
	const node = createNode(ZrNodeKind.VariableStatement);
	node.declaration = declaration;
	node.modifiers = modifiers;
	node.children = [declaration];
	return node;
}

export function createBooleanNode(value: boolean): BooleanLiteral {
	const node = createNode(ZrNodeKind.Boolean);
	node.value = value;
	return node;
}

export function createEndOfStatementNode(): EndOfStatement {
	return { flags: 0, kind: ZrNodeKind.EndOfStatement, children: [] };
}

export function createInvalidNode(
	message: InvalidNode["message"],
	expression: Node,
	startPosition?: number,
	endPosition?: number,
): InvalidNode {
	return {
		endPos: endPosition ?? expression.endPos,
		expression,
		flags: ZrNodeFlag.NodeHasError,
		kind: ZrNodeKind.Invalid,
		message,
		startPos: startPosition ?? expression.startPos,
		children: [],
	};
}

// eslint-disable-next-line ts/max-params -- FIXME: Possibly simplify it?
export function createBinaryExpression(
	left: Expression,
	op: string,
	right: Expression,
	startPosition?: number,
	endPosition?: number,
): BinaryExpression {
	const node = createNode(ZrNodeKind.BinaryExpression);
	node.left = left;
	node.operator = op;
	node.right = right;
	node.startPos = startPosition;
	node.endPos = endPosition;

	left.parent = node;
	right.parent = node;
	node.children = [left, right];
	return node;
}

export function createUnaryExpression(
	op: string,
	expression: Node,
	startPosition?: number,
	endPosition?: number,
): Writable<UnaryExpression> {
	const node = createNode(ZrNodeKind.UnaryExpression);
	node.expression = expression;
	node.operator = op;
	node.startPos = startPosition;
	node.endPos = endPosition;
	node.parent = expression;
	node.children = [expression];
	return node;
}
