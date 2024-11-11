import type { ZrNodeFlag, ZrNodeKind } from "./enum";
import type { ASSIGNABLE } from "./guards";

export interface NodeTypes {
	[ZrNodeKind.ArrayIndexExpression]: ArrayIndexExpression;
	[ZrNodeKind.ArrayLiteralExpression]: ArrayLiteralExpression;
	[ZrNodeKind.BinaryExpression]: BinaryExpression;
	[ZrNodeKind.Block]: SourceBlock;
	[ZrNodeKind.Boolean]: BooleanLiteral;
	[ZrNodeKind.CallExpression]: CallExpression;
	[ZrNodeKind.EndOfStatement]: EndOfStatement;
	[ZrNodeKind.EnumDeclaration]: EnumDeclarationStatement;
	[ZrNodeKind.EnumItemExpression]: EnumItemExpression;
	[ZrNodeKind.ExportKeyword]: ExportKeyword;
	[ZrNodeKind.ExpressionStatement]: ExpressionStatement;
	[ZrNodeKind.ForInStatement]: ForInStatement;
	[ZrNodeKind.FunctionDeclaration]: FunctionDeclaration;
	[ZrNodeKind.FunctionExpression]: FunctionExpression;
	[ZrNodeKind.Identifier]: Identifier;
	[ZrNodeKind.IfStatement]: IfStatement;
	[ZrNodeKind.InnerExpression]: InnerExpression;
	[ZrNodeKind.InterpolatedString]: InterpolatedStringExpression;
	[ZrNodeKind.Invalid]: InvalidNode;
	[ZrNodeKind.Number]: NumberLiteral;
	[ZrNodeKind.ObjectLiteralExpression]: ObjectLiteral;
	[ZrNodeKind.OperatorToken]: OperatorToken;
	[ZrNodeKind.OptionExpression]: OptionExpression;
	[ZrNodeKind.OptionKey]: Option;
	[ZrNodeKind.Parameter]: ParameterDeclaration;
	[ZrNodeKind.ParenthesizedExpression]: ParenthesizedExpression;
	[ZrNodeKind.PrefixExpression]: PrefixExpression;
	[ZrNodeKind.PrefixToken]: PrefixToken;
	[ZrNodeKind.PropertyAccessExpression]: PropertyAccessExpression;
	[ZrNodeKind.PropertyAssignment]: PropertyAssignment;
	[ZrNodeKind.RangeExpression]: RangeExpression;
	[ZrNodeKind.ReturnStatement]: ReturnStatement;
	[ZrNodeKind.SimpleCallExpression]: SimpleCallExpression;
	[ZrNodeKind.Source]: SourceFile;
	[ZrNodeKind.String]: StringLiteral;
	[ZrNodeKind.TypeReference]: TypeReference;
	[ZrNodeKind.UnaryExpression]: UnaryExpression;
	[ZrNodeKind.UndefinedKeyword]: UndefinedKeyword;
	[ZrNodeKind.VariableDeclaration]: VariableDeclaration;
	[ZrNodeKind.VariableStatement]: VariableStatement;
}

export interface Node {
	children?: Array<Node>;
	endPos?: number;
	flags: ZrNodeFlag;
	kind: ZrNodeKind;
	parent?: Node;
	rawText?: string;
	startPos?: number;
}

export interface ValuesExpression extends Expression {
	readonly values: Array<Node>;
}

export interface Statement extends Node {
	/** @deprecated */
	readonly _nominal_Statement: unique symbol;
}

export interface Declaration extends Node {
	/** @deprecated */
	readonly _nominal_Declaration: unique symbol;
}

type DeclarationName = Identifier | NumberLiteral | StringLiteral;
export interface NamedDeclaration extends Declaration {
	readonly name?: DeclarationName;
}

export interface Keyword extends Node {
	readonly _nominal_Keyword: unique symbol;
}

type PropertyName = Identifier | NumberLiteral | StringLiteral;
export interface ObjectLiteralElement extends NamedDeclaration {
	/** @deprecated */
	readonly _nominal_ObjectLiteralElement: unique symbol;
	readonly name?: PropertyName;
}

export interface LeftHandSideExpression extends Expression {
	/** @deprecated */
	readonly _nominal_LeftHandSide: unique symbol;
}

export interface Expression extends Node {
	/** @deprecated */
	readonly _nominal_Expression: unique symbol;
}
export interface LiteralExpression extends Expression {
	/** @deprecated */
	readonly _nominal_Literal: unique symbol;
}

export interface DeclarationStatement extends Statement {
	readonly name?: Identifier | NumberLiteral | StringLiteral;
}

type OP = "&&" | "=" | "|";

export interface OperatorToken extends Node {
	kind: ZrNodeKind.OperatorToken;
	operator: string;
}

export interface ExportKeyword extends Keyword {
	kind: ZrNodeKind.ExportKeyword;
}

export interface UndefinedKeyword extends Keyword, Expression {
	kind: ZrNodeKind.UndefinedKeyword;
}

export interface ParenthesizedExpression extends Expression {
	expression: Expression;
	kind: ZrNodeKind.ParenthesizedExpression;
}

export interface RangeExpression extends Expression {
	kind: ZrNodeKind.RangeExpression;
	left: Expression;
	right: Expression;
}

export interface TypeReference extends Node {
	kind: ZrNodeKind.TypeReference;
	typeName: Identifier;
}

export interface ParameterDeclaration extends NamedDeclaration {
	kind: ZrNodeKind.Parameter;
	name: Identifier;
	/** TODO: NumberKeyword, StringKeyword etc. */
	type?: TypeReference;
}

export interface ReturnStatement extends Statement {
	expression: Expression;
	kind: ZrNodeKind.ReturnStatement;
}

export interface ForInStatement extends Statement {
	expression: Expression;
	initializer: Identifier;
	kind: ZrNodeKind.ForInStatement;
	statement: SourceBlock;
}

export interface FunctionExpression extends Expression {
	body: SourceBlock;
	kind: ZrNodeKind.FunctionExpression;
	/** TODO:. */
	parameters: Array<ParameterDeclaration>;
}

export interface FunctionDeclaration extends DeclarationStatement {
	body: SourceBlock;
	kind: ZrNodeKind.FunctionDeclaration;
	name: Identifier;
	/** TODO:. */
	parameters: Array<ParameterDeclaration>;
}

export interface SourceFile extends Node {
	children: Array<Node>;
	kind: ZrNodeKind.Source;
}

export interface InterpolatedStringExpression extends ValuesExpression {
	kind: ZrNodeKind.InterpolatedString;
	values: Array<Identifier | StringLiteral>;
}

export interface UnaryExpression extends Expression {
	expression: Node;
	kind: ZrNodeKind.UnaryExpression;
	operator: string;
}

export interface BinaryExpression extends Expression, Declaration {
	children: Array<Node>;
	kind: ZrNodeKind.BinaryExpression;
	left: Expression;
	operator: string;
	right: Expression;
}

export interface EnumItemExpression extends Expression {
	kind: ZrNodeKind.EnumItemExpression;
	name: Identifier;
}

export interface EnumDeclarationStatement extends Statement {
	kind: ZrNodeKind.EnumDeclaration;
	name: Identifier;
	values: Array<EnumItemExpression>;
}

export interface ArrayLiteralExpression extends ValuesExpression {
	kind: ZrNodeKind.ArrayLiteralExpression;
	values: Array<Node>;
}

export interface PropertyAssignment extends ObjectLiteralElement {
	initializer: Expression;
	kind: ZrNodeKind.PropertyAssignment;
	name: Identifier;
}

export interface ObjectLiteral extends LiteralExpression, ValuesExpression {
	kind: ZrNodeKind.ObjectLiteralExpression;
	values: Array<PropertyAssignment>;
}

export interface InvalidNode extends Node {
	expression: Node;
	kind: ZrNodeKind.Invalid;
	message: string;
}

export interface VariableDeclaration extends Declaration {
	expression: AssignableExpression;
	identifier: ArrayIndexExpression | Identifier | PropertyAccessExpression;
	kind: ZrNodeKind.VariableDeclaration;
}

export interface VariableStatement extends Statement {
	declaration: VariableDeclaration;
	kind: ZrNodeKind.VariableStatement;
	modifiers?: Array<ExportKeyword>;
}

export interface PropertyAccessExpression extends Expression {
	expression: ArrayIndexExpression | Identifier | PropertyAccessExpression;
	kind: ZrNodeKind.PropertyAccessExpression;
	name: Identifier;
}

export interface ArrayIndexExpression extends Expression {
	expression: ArrayIndexExpression | Identifier | PropertyAccessExpression;
	index: NumberLiteral;
	kind: ZrNodeKind.ArrayIndexExpression;
}

export interface StringLiteral extends LiteralExpression {
	isUnterminated?: boolean;
	kind: ZrNodeKind.String;
	quotes?: string;
	text: string;
}

export interface SourceBlock extends Statement {
	kind: ZrNodeKind.Block;
	statements: Array<Statement>;
}

export type AssignableExpression = NodeTypes[(typeof ASSIGNABLE)[number]];

export interface IfStatement extends Statement {
	condition: Expression | undefined;
	elseStatement: IfStatement | SourceBlock | Statement | undefined;
	kind: ZrNodeKind.IfStatement;
	thenStatement: SourceBlock | Statement | undefined;
}

export interface ExpressionStatement extends Statement {
	expression: Expression;
	kind: ZrNodeKind.ExpressionStatement;
}

export interface BooleanLiteral extends LiteralExpression {
	kind: ZrNodeKind.Boolean;
	value: boolean;
}

export interface NumberLiteral extends LiteralExpression {
	kind: ZrNodeKind.Number;
	value: number;
}

/** An expression like `func(...)`. */
export interface CallExpression extends Expression {
	readonly arguments: Array<Node>;
	readonly expression: ArrayIndexExpression | Identifier | PropertyAccessExpression;
	readonly isUnterminated?: boolean;
	readonly kind: ZrNodeKind.CallExpression;
	readonly options: Array<OptionExpression>;
}

/** An expression like `func ...`. */
export interface SimpleCallExpression extends Expression {
	arguments: Array<Node>;
	expression: ArrayIndexExpression | Identifier | PropertyAccessExpression;
	isUnterminated?: boolean;
	kind: ZrNodeKind.SimpleCallExpression;
}

export interface InnerExpression extends Expression {
	expression: BinaryExpression | Statement;
	kind: ZrNodeKind.InnerExpression;
}

export interface NodeError {
	message: string;
	node: Node;
}

export interface Option extends LeftHandSideExpression {
	flag: string;
	right?: Node;
}

export interface OptionExpression extends Expression {
	expression: Expression;
	option: Option;
}

export const VALID_PREFIX_CHARS = ["~", "@", "%", "^", "*", "!"] as const;
export interface PrefixToken extends Node {
	value: (typeof VALID_PREFIX_CHARS)[number];
}

export interface PrefixExpression extends Expression {
	expression: BooleanLiteral | InterpolatedStringExpression | NumberLiteral | StringLiteral;
	prefix: PrefixToken;
}

export interface Identifier extends Declaration, LeftHandSideExpression {
	name: string;
	prefix: string;
}

export interface EndOfStatement extends Node {
	kind: ZrNodeKind.EndOfStatement;
}

type NonParentNode<T> = T extends { children: Array<Node> } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type NodeKind = keyof NodeTypes;
