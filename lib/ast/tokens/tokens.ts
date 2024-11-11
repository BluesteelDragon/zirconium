export const enum ZrTokenKind {
	ArrayIndex = "ArrayIndex",
	Boolean = "Boolean",
	Comment = "Comment",
	EndOfStatement = "EndOfStatement",
	Identifier = "Id",
	InterpolatedString = "InterpolatedString",
	Keyword = "Keyword",
	Number = "Number",
	Operator = "Operator",
	Option = "Option",
	PropertyAccess = "Property",
	Special = "Special",
	String = "String",
	Whitespace = "Whitespace",
}

export const KEYWORDS = ["if", "else", "for", "in", "function", "while", "const", "let"];
export const TYPES = ["number", "string", "boolean"];

export interface TokenTypes {
	[ZrTokenKind.ArrayIndex]: ArrayIndexToken;
	[ZrTokenKind.Boolean]: BooleanToken;
	[ZrTokenKind.Comment]: CommentToken;
	[ZrTokenKind.EndOfStatement]: EndOfStatementToken;
	[ZrTokenKind.Identifier]: IdentifierToken;
	[ZrTokenKind.InterpolatedString]: InterpolatedStringToken;
	[ZrTokenKind.Keyword]: KeywordToken;
	[ZrTokenKind.Number]: NumberToken;
	[ZrTokenKind.Operator]: OperatorToken;
	[ZrTokenKind.Option]: OptionToken;
	[ZrTokenKind.PropertyAccess]: PropertyAccessToken;
	[ZrTokenKind.Special]: SpecialToken;
	[ZrTokenKind.String]: StringToken;
	[ZrTokenKind.Whitespace]: WhitespaceToken;
}

export const enum ZrTokenFlag {
	None = 0,
	UnterminatedString = 1 << 0,
	Interpolated = 1 << 1,
	FunctionName = 1 << 2,
	Label = 1 << 3,
	InvalidIdentifier = 1 << 4,
	VariableDeclaration = 1 << 5,
	VariableDollarIdentifier = 1 << 6,
	EnumName,
}

export interface TokenBase {
	endPos: number;
	flags: ZrTokenFlag;
	kind: ZrTokenKind;
	startPos: number;
}

export interface WhitespaceToken extends TokenBase {
	kind: ZrTokenKind.Whitespace;
	value: string;
}

export interface CommentToken extends TokenBase {
	kind: ZrTokenKind.Comment;
	value: string;
}

export interface OptionToken extends TokenBase {
	kind: ZrTokenKind.Option;
	prefix?: string;
	value: string;
}

export interface IdentifierToken extends TokenBase {
	kind: ZrTokenKind.Identifier;
	value: string;
}

export interface ArrayIndexToken extends TokenBase {
	kind: ZrTokenKind.ArrayIndex;
	value: string;
}

export interface PropertyAccessToken extends TokenBase {
	kind: ZrTokenKind.PropertyAccess;
	properties: Array<string>;
	value: string;
}

export interface BooleanToken extends TokenBase {
	kind: ZrTokenKind.Boolean;
	rawText: string;
	value: boolean;
}

export interface SpecialToken extends TokenBase {
	kind: ZrTokenKind.Special;
	value: string;
}

export interface EndOfStatementToken extends TokenBase {
	kind: ZrTokenKind.EndOfStatement;
	value: string;
}

export interface OperatorToken extends TokenBase {
	kind: ZrTokenKind.Operator;
	value: string;
}

export interface StringToken extends TokenBase {
	closed: boolean;
	endCharacter?: string;
	kind: ZrTokenKind.String;
	startCharacter?: string;
	value: string;
}

export function joinInterpolatedString(values: Array<string>, variables: Array<string>): string {
	const resulting = new Array<string>();
	for (let key = 0; key < values.size(); key++) {
		const value = values[key];
		resulting.push(value);

		const matchingVariable = variables[key];
		if (matchingVariable !== undefined) {
			resulting.push(`$${matchingVariable}`);
		}
	}

	return resulting.join("");
}

export interface InterpolatedStringToken extends TokenBase {
	closed?: boolean;
	kind: ZrTokenKind.InterpolatedString;
	quotes?: string;
	value: string;
	values: Array<string>;
	variables: Array<string>;
}

type Keywords = (typeof KEYWORDS)[number];

export interface KeywordToken extends TokenBase {
	kind: ZrTokenKind.Keyword;
	value: Keywords;
}

export interface NumberToken extends TokenBase {
	kind: ZrTokenKind.Number;
	rawText: string;
	value: number;
}

export type Token = TokenTypes[keyof TokenTypes];

export function isToken<K extends keyof TokenTypes>(token: Token, kind: K): token is TokenTypes[K] {
	return token !== undefined && token.kind === kind;
}
