import type { ZrNodeFlag } from "./enum";
import { ZrNodeKind } from "./enum";
import { getKindName, getNodeKindName } from "./functions";
import type {
	ArrayIndexExpression,
	ArrayLiteralExpression,
	BinaryExpression,
	BooleanLiteral,
	CallExpression,
	ExportKeyword,
	ExpressionStatement,
	ForInStatement,
	FunctionDeclaration,
	FunctionExpression,
	Identifier,
	InterpolatedStringExpression,
	InvalidNode,
	Node,
	NodeTypes,
	NumberLiteral,
	ObjectLiteral,
	OperatorToken,
	Option,
	OptionExpression,
	ParameterDeclaration,
	ParenthesizedExpression,
	PrefixToken,
	PropertyAccessExpression,
	PropertyAssignment,
	ReturnStatement,
	SimpleCallExpression,
	SourceBlock,
	SourceFile,
	StringLiteral,
	UnaryExpression,
	UndefinedKeyword,
	VariableDeclaration,
	VariableStatement,
} from "./node-types";
import { VALID_PREFIX_CHARS } from "./node-types";

export function isNode<K extends keyof NodeTypes>(node: Node, typeName: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === typeName;
}

export function hasNodeFlag<F extends ZrNodeFlag>(node: Node, flag: F): boolean {
	return node.flags !== undefined && (node.flags & flag) !== 0;
}

export function assertIsNode<K extends keyof NodeTypes>(
	node: Node,
	typeName: K,
): asserts node is NodeTypes[K] {
	if (!isNode(node, typeName)) {
		error(`Expected ${getKindName(typeName)}, got ${getNodeKindName(node)}`);
	}
}

export function getNodesOfType<K extends keyof NodeTypes>(
	nodes: Array<Node>,
	typeName: K,
): Array<NodeTypes[K]> {
	return nodes.filter((node): node is NodeTypes[K] => isNode(node, typeName));
}

export function getSiblingNode(nodes: Array<Node>, kind: ZrNodeKind): Node | undefined {
	return nodes.find(node => node.kind === kind);
}

export function isNodeIn<K extends keyof NodeTypes>(
	node: Node,
	typeName: ReadonlyArray<K>,
): node is NodeTypes[K] {
	return node !== undefined && (typeName as ReadonlyArray<ZrNodeKind>).includes(node.kind);
}

export function isValidPrefixCharacter(
	input: string,
): input is (typeof VALID_PREFIX_CHARS)[number] {
	return VALID_PREFIX_CHARS.includes(input as (typeof VALID_PREFIX_CHARS)[number]);
}

/** @internal */
// matches $A, $a, $a0, $_a, $A_, $A_a, etc.
export const VALID_VARIABLE_NAME = "^[A-Za-z_][A-Za-z0-9_]*$";
/** @internal */
export const VALID_COMMAND_NAME = "^[A-Za-z][A-Z0-9a-z_%-]*$";

/** @internal */
const PREFIXABLE = [
	ZrNodeKind.String,
	ZrNodeKind.InterpolatedString,
	ZrNodeKind.Number,
	ZrNodeKind.Boolean,
] as const;

/**
 * Can this expression be prefixed?
 *
 * @param node - The node to check.
 * @returns A boolean saying if this is expression can be prefixed or not.
 */
export function isPrefixableExpression(node: Node): node is NodeTypes[(typeof PREFIXABLE)[number]] {
	return isNodeIn(node, PREFIXABLE);
}

/** @internal */
export const ASSIGNABLE = [
	ZrNodeKind.String,
	ZrNodeKind.InterpolatedString,
	ZrNodeKind.Identifier,
	ZrNodeKind.Number,
	ZrNodeKind.Boolean,
	ZrNodeKind.InnerExpression,
	ZrNodeKind.ArrayLiteralExpression,
	ZrNodeKind.PropertyAccessExpression,
	ZrNodeKind.ArrayIndexExpression,
	ZrNodeKind.ObjectLiteralExpression,
	ZrNodeKind.BinaryExpression,
	ZrNodeKind.UnaryExpression,
	ZrNodeKind.CallExpression,
	ZrNodeKind.SimpleCallExpression,
	ZrNodeKind.UndefinedKeyword,
	ZrNodeKind.FunctionExpression,
	ZrNodeKind.ParenthesizedExpression,
] as const;
export type AssignableExpression = NodeTypes[(typeof ASSIGNABLE)[number]];

/**
 * Can this expression be prefixed?
 *
 * @param node - The node to check.
 * @returns A boolean saying if this is an assignable expression or not.
 */
export function isAssignableExpression(node: Node): node is AssignableExpression {
	return isNodeIn(node, ASSIGNABLE);
}

/** @internal */
const LIT = [
	ZrNodeKind.String,
	ZrNodeKind.InterpolatedString,
	ZrNodeKind.Identifier,
	ZrNodeKind.Number,
	ZrNodeKind.Boolean,
] as const;
export type LiteralExpression = NodeTypes[(typeof LIT)[number]];

const EXPRESSIONABLE = [ZrNodeKind.VariableStatement, ZrNodeKind.BinaryExpression] as const;

export function isSourceFile(node: Node): node is SourceFile {
	return node !== undefined && node.kind === ZrNodeKind.Source;
}

/** @deprecated */
export const isSource = isSourceFile;

export function isParameterDeclaration(node: Node): node is ParameterDeclaration {
	return node !== undefined && node.kind === ZrNodeKind.Parameter;
}

// REGION Expressions

/**
 * Returns if this is a valid expression.
 *
 * @deprecated
 * @param node - The node to check.
 * @returns A boolean saying if this node is valid.
 */
export function isValidExpression(node: Node): node is NodeTypes[(typeof EXPRESSIONABLE)[number]] {
	return isNodeIn(node, EXPRESSIONABLE);
}

/**
 * Is this expression considered a primitive type?
 *
 * @param node - The node to check.
 * @returns A boolean saying if this is a primitive expression or not.
 */
export function isPrimitiveExpression(node: Node): node is LiteralExpression {
	return isNodeIn(node, ASSIGNABLE);
}

export function isSimpleCallExpression(node: Node): node is SimpleCallExpression {
	return node !== undefined && node.kind === ZrNodeKind.SimpleCallExpression;
}

export function isCallExpression(node: Node): node is CallExpression {
	return node !== undefined && node.kind === ZrNodeKind.CallExpression;
}

export function isCallableExpression(node: Node): node is CallExpression | SimpleCallExpression {
	return isSimpleCallExpression(node) || isCallExpression(node);
}

export function isOptionExpression(node: Node): node is OptionExpression {
	return node !== undefined && node.kind === ZrNodeKind.OptionExpression;
}

export function isExpressionStatement(node: Node): node is ExpressionStatement {
	return node !== undefined && node.kind === ZrNodeKind.ExpressionStatement;
}

export function isUnaryExpression(node: Node): node is UnaryExpression {
	return node !== undefined && node.kind === ZrNodeKind.UnaryExpression;
}

export function isParenthesizedExpression(node: Node): node is ParenthesizedExpression {
	return node !== undefined && node.kind === ZrNodeKind.ParenthesizedExpression;
}

// REGION Statements

export function isReturnStatement(node: Node): node is ReturnStatement {
	return node !== undefined && node.kind === ZrNodeKind.ReturnStatement;
}

export function isBlock(node: Node): node is SourceBlock {
	return node !== undefined && node.kind === ZrNodeKind.Block;
}

// REGION indexing

export function isArrayIndexExpression(node: Node): node is ArrayIndexExpression {
	return node !== undefined && node.kind === ZrNodeKind.ArrayIndexExpression;
}

export function isPropertyAccessExpression(node: Node): node is PropertyAccessExpression {
	return node !== undefined && node.kind === ZrNodeKind.PropertyAccessExpression;
}

export function isPropertyAssignment(node: Node): node is PropertyAssignment {
	return node !== undefined && node.kind === ZrNodeKind.PropertyAssignment;
}

// REGION variables

export function isVariableStatement(node: Node): node is VariableStatement {
	return node !== undefined && node.kind === ZrNodeKind.VariableStatement;
}

export function isVariableDeclaration(node: Node): node is VariableDeclaration {
	return node !== undefined && node.kind === ZrNodeKind.VariableDeclaration;
}

// REGION Iterable

export function isForInStatement(node: Node): node is ForInStatement {
	return node !== undefined && node.kind === ZrNodeKind.ForInStatement;
}

export function isStringExpression(
	node: Node,
): node is InterpolatedStringExpression | StringLiteral {
	return (
		node !== undefined &&
		(node.kind === ZrNodeKind.String || node.kind === ZrNodeKind.InterpolatedString)
	);
}

// REGION function checks

export function isFunctionDeclaration(node: Node): node is FunctionDeclaration {
	return node !== undefined && node.kind === ZrNodeKind.FunctionDeclaration;
}

export function isFunctionExpression(node: Node): node is FunctionExpression {
	return node !== undefined && node.kind === ZrNodeKind.FunctionExpression;
}

/// REGION Literal Checks

export function isIdentifier(node: Node): node is Identifier {
	return node !== undefined && node.kind === ZrNodeKind.Identifier;
}

export function isObjectLiteralExpression(node: Node): node is ObjectLiteral {
	return node !== undefined && node.kind === ZrNodeKind.ObjectLiteralExpression;
}

export function isArrayLiteralExpression(node: Node): node is ArrayLiteralExpression {
	return node !== undefined && node.kind === ZrNodeKind.ArrayLiteralExpression;
}

export function isBooleanLiteral(node: Node): node is BooleanLiteral {
	return node !== undefined && node.kind === ZrNodeKind.Boolean;
}

export function isNumberLiteral(node: Node): node is NumberLiteral {
	return node !== undefined && node.kind === ZrNodeKind.Number;
}

export function isStringLiteral(node: Node): node is StringLiteral {
	return node !== undefined && node.kind === ZrNodeKind.String;
}

/**
 * Returns true if the node is a prefix node kind.
 *
 * @deprecated
 * @param node - Node to check.
 * @returns A boolean if this is a prefix or not.
 */
export function isPrefixToken(node: Node): node is PrefixToken {
	return node !== undefined && node.kind === ZrNodeKind.PrefixToken;
}

export function isOperatorToken(node: Node): node is OperatorToken {
	return node !== undefined && node.kind === ZrNodeKind.OperatorToken;
}

export function isBinaryExpression(node: Node): node is BinaryExpression {
	return node !== undefined && node.kind === ZrNodeKind.BinaryExpression;
}

export function isOptionKey(node: Node): node is Option {
	return node !== undefined && node.kind === ZrNodeKind.OptionKey;
}

/**
 * Returns true if the node is an invalid node kind.
 *
 * @deprecated
 * @param node - Node to check.
 * @returns A boolean if this is invalid or not.
 */
export function isInvalid(node: Node): node is InvalidNode {
	return node !== undefined && node.kind === ZrNodeKind.Invalid;
}

// REGION Keywords

export function isExportKeyword(node: Node): node is ExportKeyword {
	return node !== undefined && node.kind === ZrNodeKind.ExportKeyword;
}

export function isUndefinedKeyword(node: Node): node is UndefinedKeyword {
	return node !== undefined && node.kind === ZrNodeKind.UndefinedKeyword;
}
