/* eslint-disable max-lines -- FIXME: Refactor me pls. Split me into multiple files! */
import { $print } from "rbxts-transform-debug";

import ErrorStrings from "./error-strings.json";
import ZrLexer from "./lexer";
import { isNode, ZrNodeKind } from "./nodes";
import {
	createArrayIndexExpression,
	createArrayLiteral,
	createBinaryExpression,
	createBlock,
	createBooleanNode,
	createCallExpression,
	createEnumDeclaration,
	createEnumItemExpression,
	createExportKeyword,
	createExpressionStatement,
	createForInStatement,
	createFunctionDeclaration,
	createFunctionExpression,
	createIdentifier,
	createIfStatement,
	createInterpolatedString,
	createKeywordTypeNode,
	createNumberNode,
	createObjectLiteral,
	createOptionExpression,
	createOptionKey,
	createParameter,
	createParenthesizedExpression,
	createPropertyAccessExpression,
	createPropertyAssignment,
	createReturnStatement,
	createSimpleCallExpression,
	createSourceFile,
	createStringNode,
	createTypeReference,
	createUnaryExpression,
	createUndefined,
	createVariableDeclaration,
	createVariableStatement,
	updateNodeInternal,
	withError,
} from "./nodes/create";
import { ZrNodeFlag, ZrTypeKeyword } from "./nodes/enum";
import { getFriendlyName, getVariableName } from "./nodes/functions";
import { isAssignableExpression, isOptionExpression } from "./nodes/guards";
import type {
	ArrayIndexExpression,
	ArrayLiteralExpression,
	CallExpression,
	EnumDeclarationStatement,
	Expression,
	ForInStatement,
	FunctionDeclaration,
	FunctionExpression,
	Identifier,
	IfStatement,
	InterpolatedStringExpression,
	Node,
	ObjectLiteral,
	OptionExpression,
	ParameterDeclaration,
	PropertyAccessExpression,
	PropertyAssignment,
	SimpleCallExpression,
	SourceBlock,
	SourceFile,
	Statement,
	StringLiteral,
	UndefinedKeyword,
	VariableStatement,
} from "./nodes/node-types";
import type { UnaryOperatorsTokens } from "./tokens/grammar";
import Grammar, { Keywords } from "./tokens/grammar";
import type {
	ArrayIndexToken,
	IdentifierToken,
	InterpolatedStringToken,
	KeywordToken,
	PropertyAccessToken,
	StringToken,
	Token,
	TokenTypes,
} from "./tokens/tokens";
import { isToken, ZrTokenFlag, ZrTokenKind } from "./tokens/tokens";

export const enum ZrParserErrorCode {
	Unexpected = 1001,
	UnexpectedWord,
	InvalidVariableAssignment,
	IdentifierExpected,
	ExpectedToken,
	NotImplemented,
	ExpressionExpected,
	UnterminatedStringLiteral,
	FunctionIdentifierExpected,
	KeywordReserved,
	InvalidIdentifier,
	InvalidPropertyAccess,
	InvalidReturnStatement,
	ExpectedBlock,
	ExpectedKeyword,
}

interface FunctionCallContext {
	strict: boolean;
}

export const enum ZrParserWarningCode {
	/** Function names do not require $ prefix. */
	FunctionIdWithPrefix = 1,
}

export interface ZrParserError {
	code: ZrParserErrorCode;
	message: string;
	node?: Node;
	range?: [number, number];
	token?: Token;
}

export interface ZrParserWarning {
	code: ZrParserWarningCode;
	message: string;
	node?: Node;
	token?: Token;
}

export const enum ZrScriptMode {
	CommandLike = "command",
	Strict = "strict",
}

export const enum ZrScriptVersion {
	Zr2020 = 0,

	/** Enables `let`, `const`. */
	Zr2021 = 1000,

	/** Enables `enum`, `export`. */
	Zr2022 = 1001,
}

export interface ZrParserOptions {
	enableExport: boolean;
	mode: ZrScriptMode;
	version: number;
}

export default class ZrParser {
	private readonly callContext = new Array<FunctionCallContext>();
	private readonly enableExportKeyword: boolean = false;
	private readonly enableUserEnum: boolean = false;
	private readonly errors = new Array<ZrParserError>();
	private readonly experimentalFeaturesEnabled: boolean = false;
	private readonly functionContext = new Array<string>();
	private readonly options: ZrParserOptions;
	private readonly warnings = new Array<ZrParserWarning>();
	private functionCallScope = 0;
	private preventCommandParsing = false;

	private strict = false;

	private getCurrentCallContext(): FunctionCallContext | undefined {
		return this.callContext[this.callContext.size() - 1];
	}

	private parserErrorNode<TNode extends Node>(
		message: string,
		code: ZrParserErrorCode,
		node: TNode,
		range?: [number, number],
	): TNode {
		this.errors.push(
			identity<ZrParserError>({
				code,
				message,
				node,
				range,
			}),
		);
		return withError(node);
	}

	private throwParserError(message: string, code: ZrParserErrorCode, token?: Token): never {
		this.errors.push(
			identity<ZrParserError>({
				code,
				message,
				range: token ? [token.startPos, token.endPos] : undefined,
				token,
			}),
		);
		this._throwParserError(message);
	}

	private throwParserNodeError(message: string, code: ZrParserErrorCode, node?: Node): never {
		this.errors.push(
			identity<ZrParserError>({
				code,
				message,
				node,
				range: node?.startPos ? [node.startPos, node.endPos ?? node.startPos] : undefined,
			}),
		);
		this._throwParserError(message);
	}

	private _throwParserError(message: string): never {
		throw `[ZParser] Parsing Error: ${message} \n` + debug.traceback("", 2);
	}

	/**
	 * Checks whether or not the specified token kind is the current.
	 *
	 * @param kind
	 * @param value
	 */
	private is(kind: ZrTokenKind, value?: boolean | number | string): boolean {
		const token = this.lexer.peek();
		return value !== undefined
			? token !== undefined && token.kind === kind && token.value === value
			: token !== undefined && token.kind === kind;
	}

	/**
	 * Gets the token of the specified kind, if it's the next token.
	 *
	 * @param kind
	 * @param value
	 */
	public get<K extends keyof TokenTypes>(
		kind: K,
		value?: TokenTypes[K]["value"],
	): TokenTypes[K] | undefined {
		return this.is(kind, value) ? (this.lexer.peek()! as TokenTypes[K]) : undefined;
	}

	private tokenToString(token: Token | undefined): string {
		if (token === undefined) {
			return "<EOF>";
		} else if (token.value === "\n") {
			return "<newline>";
		}

		return `'${token.value}'`;
	}

	/**
	 * Skips a token of a specified kind if it's the next.
	 *
	 * @param kind
	 * @param value
	 * @param message
	 */
	private skip(kind: ZrTokenKind, value?: boolean | number | string, message?: string): Token {
		if (this.is(kind, value)) {
			return this.lexer.next()!;
		}

		const node = this.lexer.peek();
		this.throwParserError(
			message ??
				`ZrParser.skip("${kind}", ${value ? `'${value}'` : "undefined"}): Expected '` +
					value +
					"' got " +
					this.tokenToString(node),
			ZrParserErrorCode.Unexpected,
			node,
		);
	}

	/**
	 * Skips token if it exists.
	 *
	 * @param kind
	 * @param value
	 */
	private skipIf(kind: ZrTokenKind, value: boolean | number | string): boolean {
		if (this.is(kind, value)) {
			this.lexer.next();
			return true;
		}

		return false;
	}

	private parseBlock(): Writable<SourceBlock> {
		const statements = new Array<Statement>();

		this.skip(ZrTokenKind.Special, "{");
		while (this.lexer.hasNext()) {
			if (this.is(ZrTokenKind.Special, "}")) {
				break;
			}

			if (this.skipIf(ZrTokenKind.EndOfStatement, "\n")) {
				continue;
			}

			statements.push(this.parseNextStatement());
		}

		this.skip(ZrTokenKind.Special, "}");
		return createBlock(statements);
	}

	/**
	 * Parses an inline statement (e.g. `if $true: <expression>`).
	 *
	 * Short-hand and only takes one expression. For multiple use `parseBlock`.
	 */
	private parseInlineStatement(): Writable<SourceBlock> {
		if (this.is(ZrTokenKind.Special, ":")) {
			this.skip(ZrTokenKind.Special, ":");
			return createBlock([this.mutateStatement(this.parseNext())]);
		}

		this.throwParserError(
			"Expected ':' got  " + this.lexer.peek()?.kind,
			ZrParserErrorCode.ExpectedToken,
		);
	}

	private parseBlockOrInlineStatement(): Writable<SourceBlock> {
		return this.is(ZrTokenKind.Special, ":") ? this.parseInlineStatement() : this.parseBlock();
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private parseParameters(): Array<ParameterDeclaration> {
		const parameters = new Array<ParameterDeclaration>();
		if (this.is(ZrTokenKind.Special, "(")) {
			this.skip(ZrTokenKind.Special, "(");

			let index = 0;
			while (this.lexer.hasNext() && !this.is(ZrTokenKind.Special, ")")) {
				if (index > 0) {
					this.skip(ZrTokenKind.Special, ",");
				}

				index++;

				// If valid parameter
				if (this.is(ZrTokenKind.Identifier)) {
					const id = this.lexer.next() as IdentifierToken;

					// Check for parameter type
					if (this.is(ZrTokenKind.Special, ":")) {
						this.skip(ZrTokenKind.Special, ":");

						// TODO: More advanced types later.
						// eslint-disable-next-line max-depth -- FIXME: Refactor me to no longer be so deep.
						if (this.is(ZrTokenKind.String)) {
							const typeName = this.lexer.next() as StringToken;
							parameters.push(
								createParameter(
									createIdentifier(id.value),
									createTypeReference(createIdentifier(typeName.value)),
								),
							);
						} else {
							this.throwParserError("Type expected", ZrParserErrorCode.Unexpected);
						}
					} else {
						parameters.push(
							createParameter(
								createIdentifier(id.value),
								createKeywordTypeNode(ZrTypeKeyword.Any),
							),
						);
					}
				} else {
					const nextItem = this.lexer.next();
					this.throwParserError(
						`Parameter item expects an identifier`,
						ZrParserErrorCode.IdentifierExpected,
						nextItem,
					);
				}
			}

			this.skip(ZrTokenKind.Special, ")");
		} else {
			this.throwParserError(
				"'(' expected got '" + (this.lexer.peek()?.value ?? "EOF") + "'",
				ZrParserErrorCode.ExpectedToken,
			);
		}

		return parameters;
	}

	// eslint-disable-next-line max-lines-per-function -- FIXME: Refactor me pls.
	private parseForIn(initializer: ForInStatement["initializer"]): ForInStatement {
		const forStatement = createForInStatement(initializer, undefined, undefined);
		this.lexer.next();

		const targetId = this.get(ZrTokenKind.Identifier);
		if (targetId !== undefined) {
			this.lexer.next();

			forStatement.expression = createIdentifier(targetId.value);
			forStatement.statement = this.parseBlockOrInlineStatement();
		} else if (!this.lexer.isNextOfKind(ZrTokenKind.EndOfStatement)) {
			const expression = this.mutateExpression(this.parseExpression());
			if (
				isNode(expression, ZrNodeKind.CallExpression) ||
				isNode(expression, ZrNodeKind.SimpleCallExpression) ||
				isNode(expression, ZrNodeKind.ArrayLiteralExpression) ||
				isNode(expression, ZrNodeKind.ObjectLiteralExpression) ||
				isNode(expression, ZrNodeKind.ArrayIndexExpression) ||
				isNode(expression, ZrNodeKind.ParenthesizedExpression) ||
				isNode(expression, ZrNodeKind.BinaryExpression)
			) {
				forStatement.expression = expression;
				forStatement.statement = this.parseBlockOrInlineStatement();
			} else {
				return this.parserErrorNode(
					"ForIn statement expects a valid expression after 'in' got " +
						ZrNodeKind[expression.kind],
					ZrParserErrorCode.IdentifierExpected,
					forStatement,
				);
			}
		} else {
			this.throwParserError(
				"ForIn statement expects expression after 'in'",
				ZrParserErrorCode.ExpressionExpected,
			);
		}

		return forStatement;
	}

	private parseFor(): ForInStatement {
		this.skip(ZrTokenKind.Keyword, Keywords.FOR);
		const initializer = this.parseExpression();

		if (isNode(initializer, ZrNodeKind.Identifier)) {
			if (this.is(ZrTokenKind.Keyword, Keywords.IN)) {
				return this.parseForIn(initializer);
			}

			return this.throwParserNodeError(
				"Expected 'in' after initializer",
				ZrParserErrorCode.ExpectedKeyword,
				initializer,
			);
		}

		this.throwParserError(
			"Identifier expected after 'for'",
			ZrParserErrorCode.IdentifierExpected,
		);
	}

	private parseFunctionExpression(): Writable<FunctionExpression> {
		const funcToken = this.skip(ZrTokenKind.Keyword, Keywords.FUNCTION);
		const parameterList = this.parseParameters();

		if (this.is(ZrTokenKind.Special, "{")) {
			this.functionContext.push("<Anonymous>");
			const body = this.parseBlock();
			this.functionContext.pop();
			return createFunctionExpression(parameterList, body);
		}

		const invalidFuncExpression = createFunctionExpression(parameterList, undefined);
		return this.parserErrorNode(
			ErrorStrings.FUNCTION_IMPLEMENTATION_MISSING.format("<Anonymous>"),
			ZrParserErrorCode.ExpectedBlock,
			invalidFuncExpression,
			funcToken ? [funcToken.startPos, funcToken.endPos] : undefined,
		);
	}

	private parseFunction(): Writable<FunctionDeclaration> {
		const funcToken = this.skip(ZrTokenKind.Keyword, Keywords.FUNCTION);

		if (this.lexer.isNextOfAnyKind(ZrTokenKind.String, ZrTokenKind.Identifier)) {
			const id = this.lexer.next() as IdentifierToken | StringToken;
			const idNode = createIdentifier(id.value);
			this.functionContext.push(idNode.name);
			const parameterList = this.parseParameters();

			if (this.is(ZrTokenKind.Special, "{")) {
				const body = this.parseBlock();
				this.functionContext.pop();
				return createFunctionDeclaration(idNode, parameterList, body);
			}

			return this.parserErrorNode(
				ErrorStrings.FUNCTION_IMPLEMENTATION_MISSING.format(idNode.name),
				ZrParserErrorCode.NotImplemented,
				createFunctionDeclaration(idNode, parameterList, undefined),
				[id.startPos, id.endPos],
			);

			// this.throwParserError(
			// 	ErrorStrings.FUNCTION_IMPLEMENTATION_MISSING.format(idNode.name),
			// 	ZrParserErrorCode.NotImplemented,
			// 	id,
			// );
		}

		this.throwParserError(
			ErrorStrings.FUNCTION_ID_EXPECTED,
			ZrParserErrorCode.FunctionIdentifierExpected,
			this.lexer.next() ?? funcToken,
		);
	}

	// eslint-disable-next-line max-lines-per-function -- FIXME: Refactor me pls.
	private parseIfStatement(): IfStatement {
		const token = this.skip(ZrTokenKind.Keyword, Keywords.IF);

		const expr = this.mutateExpression(this.parseExpression());
		const node = createIfStatement(expr, undefined, undefined);

		if (this.is(ZrTokenKind.Special, ":")) {
			node.thenStatement = this.parseInlineStatement();
			return node;
		} else if (this.is(ZrTokenKind.Special, "{")) {
			node.thenStatement = this.parseBlock();
		} else {
			return this.parserErrorNode(
				"Expected block or inline block after if statement",
				ZrParserErrorCode.ExpectedBlock,
				node,
			);
		}

		if (this.is(ZrTokenKind.Keyword, Keywords.ELSE)) {
			this.lexer.next();

			if (this.is(ZrTokenKind.Keyword, Keywords.IF)) {
				node.elseStatement = this.parseIfStatement();
			} else if (this.is(ZrTokenKind.Special, "{")) {
				node.elseStatement = this.parseBlock();
			} else if (this.is(ZrTokenKind.Special, ":")) {
				node.elseStatement = this.parseInlineStatement();
			} else {
				return this.parserErrorNode(
					"Unexpected '" +
						this.lexer.peek()?.value +
						"' after 'else' - must be block or inline statement",
					ZrParserErrorCode.ExpectedBlock,
					node,
				);
			}
		}

		return node;
	}

	private isOperatorToken(): boolean {
		return this.lexer.isNextOfKind(ZrTokenKind.Operator);
	}

	private isEndBracketOrBlockToken(): boolean {
		return (
			this.is(ZrTokenKind.Special, ")") ||
			this.is(ZrTokenKind.Special, "]") ||
			this.is(ZrTokenKind.Special, "}")
			// this.is(ZrTokenKind.Special, ":")
		);
	}

	private getFunctionCallee(
		token: ArrayIndexToken | IdentifierToken | PropertyAccessToken | StringToken,
	): ArrayIndexExpression | Identifier | PropertyAccessExpression {
		return token.kind === ZrTokenKind.PropertyAccess
			? this.parsePropertyAccess(token)
			: createIdentifier(token.value);
	}

	constructor(
		private readonly lexer: ZrLexer,
		options?: Partial<ZrParserOptions>,
	) {
		this.options = {
			enableExport: false,
			mode: ZrScriptMode.CommandLike,
			version: ZrScriptVersion.Zr2021,
			...options,
		};
		this.strict = this.options.mode === ZrScriptMode.Strict;
		this.enableExportKeyword = this.options.enableExport;

		if (this.options.version >= ZrScriptVersion.Zr2021) {
			this.experimentalFeaturesEnabled = true;
		}

		if (this.options.version >= ZrScriptVersion.Zr2022) {
			this.enableUserEnum = true;
		}
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private parseCallExpression(
		token: IdentifierToken | PropertyAccessToken | StringToken,
		isStrictFunctionCall = this.strict,
	): CallExpression | SimpleCallExpression {
		this.functionCallScope += 1;
		const { startPos } = token;
		let endPosition = startPos;

		const callee = this.getFunctionCallee(token);

		const options = new Array<OptionExpression>();
		const args = new Array<Expression>();

		// Enable 'strict' function-like calls e.g. `kill(vorlias)` vs `kill vorlias`
		if (this.is(ZrTokenKind.Special, "(") || isStrictFunctionCall) {
			this.skip(ZrTokenKind.Special, "(");
			isStrictFunctionCall = true;
			this.strict = true;
			this.callContext.push({ strict: true });
		} else {
			this.callContext.push({ strict: false });
		}

		let argumentIndex = 0;
		while (
			this.lexer.hasNext() &&
			(!this.isNextEndOfStatementOrNewline() || isStrictFunctionCall) &&
			// !this.isOperatorToken() &&
			!this.isEndBracketOrBlockToken()
		) {
			if (isStrictFunctionCall && this.is(ZrTokenKind.Special, ")")) {
				break;
			}

			const isEscaped =
				this.is(ZrTokenKind.Special, "\\") && this.skip(ZrTokenKind.Special, "\\");
			if (
				(isStrictFunctionCall || isEscaped) &&
				this.skipIf(ZrTokenKind.EndOfStatement, "\n")
			) {
				continue;
			}

			let argument: Expression;
			// Handle expression mutation only if strict
			if (isStrictFunctionCall) {
				if (argumentIndex > 0) {
					this.skip(ZrTokenKind.Special, ",");
				}

				this.skipIf(ZrTokenKind.EndOfStatement, "\n");
				argument = this.mutateExpression(this.parseExpression());
			} else {
				argument = this.parseExpression(undefined, true);
				$print("addArg", argument);
			}

			if (isOptionExpression(argument)) {
				options.push(argument);
			} else {
				args.push(argument);
			}

			argumentIndex++;
			endPosition = this.lexer.getStream().getPtr() - 1;
		}

		if (isStrictFunctionCall) {
			endPosition = this.skip(ZrTokenKind.Special, ")").endPos - 1;
			this.strict = false;
		}

		this.callContext.pop();

		let result: CallExpression | SimpleCallExpression;

		if (isStrictFunctionCall) {
			result = createCallExpression(callee, args, options);
		} else {
			result = createSimpleCallExpression(callee, args);
			$print(result, "simpleCall");
		}

		this.functionCallScope -= 1;
		result.startPos = startPos;
		result.endPos = endPosition;
		result.rawText = this.lexer.getStreamSub(startPos, endPosition);
		return result;
	}

	/**
	 * Handles the parsing of a `InterpolatedStringToken`.
	 *
	 * @param token - The `InterpolatedStringToken` to parse.
	 * @returns - The InterpolatedStringExpression.
	 */
	private parseInterpolatedString(token: InterpolatedStringToken): InterpolatedStringExpression {
		if ((token.flags & ZrTokenFlag.UnterminatedString) !== 0) {
			this.throwParserError(
				"Unterminated string literal",
				ZrParserErrorCode.UnterminatedStringLiteral,
				token,
			);
		}

		const { values, variables } = token;
		const resulting = new Array<Identifier | StringLiteral>();
		for (let key = 0; key < values.size(); key++) {
			const value = values[key];
			resulting.push(createStringNode(value));

			const matchingVariable = variables[key];
			if (matchingVariable !== undefined) {
				resulting.push(createIdentifier(matchingVariable));
			}
		}

		return createInterpolatedString(...resulting);
	}

	// eslint-disable-next-line ts/max-params -- FIXME: Refactor me pls.
	private parseListExpression<K extends Node = Node>(
		start: string,
		stop: string,
		nextItem: () => K,
		separator = ",",
		strict = this.strict,
	): Array<K> {
		const values = new Array<K>();
		let index = 0;

		this.skip(ZrTokenKind.Special, start);
		this.preventCommandParsing = false;

		const functionContext = this.getCurrentCallContext();

		while (this.lexer.hasNext()) {
			if (this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			if (this.skipIf(ZrTokenKind.EndOfStatement, "\n")) {
				continue;
			}

			if (index > 0 && (this.is(ZrTokenKind.Special, separator) || functionContext?.strict)) {
				this.skip(ZrTokenKind.Special, separator);
			}

			this.skipIf(ZrTokenKind.EndOfStatement, "\n");

			values.push(nextItem());

			index++;
		}

		this.skipIf(ZrTokenKind.EndOfStatement, "\n");
		this.skip(ZrTokenKind.Special, stop);

		return values;
	}

	private parseObjectPropertyAssignment(): PropertyAssignment {
		if (this.lexer.isNextOfAnyKind(ZrTokenKind.Identifier, ZrTokenKind.String)) {
			const id = this.lexer.next() as StringToken;
			// Expects ':'
			this.skip(ZrTokenKind.Special, ":");

			const { preventCommandParsing } = this;
			this.preventCommandParsing = false;
			const expression = this.parseExpression();
			this.preventCommandParsing = preventCommandParsing;
			return createPropertyAssignment(createIdentifier(id.value), expression);
		}

		this.throwParserError(
			"Expected Identifier",
			ZrParserErrorCode.IdentifierExpected,
			this.lexer.peek(),
		);
	}

	private parseObjectExpression(): Writable<ObjectLiteral> {
		const values = this.parseListExpression(
			"{",
			"}",
			() => this.parseObjectPropertyAssignment(),
			",",
			true,
		);
		return createObjectLiteral(values);
	}

	private parseArrayExpression(): Writable<ArrayLiteralExpression> {
		const values = this.parseListExpression(
			"[",
			"]",
			() => this.parseExpression(),
			undefined,
			true,
		);
		return createArrayLiteral(values);
	}

	private parsePropertyAccess(
		token: PropertyAccessToken,
	): ArrayIndexExpression | Identifier | PropertyAccessExpression {
		let expr: ArrayIndexExpression | Identifier | PropertyAccessExpression = createIdentifier(
			token.value,
		);
		for (const name of token.properties) {
			expr = name.match("^%d+$")[0]
				? createArrayIndexExpression(expr, createNumberNode(tonumber(name)!))
				: createPropertyAccessExpression(expr, createIdentifier(name));
		}

		return expr;
	}

	private parseStrictFunctionOption(option: string): OptionExpression {
		this.skip(ZrTokenKind.Special, ":");
		return createOptionExpression(
			createOptionKey(option),
			this.mutateExpression(this.parseExpression()),
		);
	}

	private parseUndefined(token?: Token): undefined | UndefinedKeyword {
		if (token) {
			if (isToken(token, ZrTokenKind.Keyword) && token.value === Keywords.UNDEFINED) {
				return createUndefined();
			}
		} else if (this.is(ZrTokenKind.Keyword, Keywords.UNDEFINED)) {
			this.skip(ZrTokenKind.Keyword, Keywords.UNDEFINED);
			return createUndefined();
		}
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private parseExpression(token?: Token, treatIdentifiersAsStrings = false): Expression {
		if (this.is(ZrTokenKind.Special, "{")) {
			return this.parseObjectExpression();
		}

		if (this.is(ZrTokenKind.Special, "[")) {
			return this.parseArrayExpression();
		}

		if (this.experimentalFeaturesEnabled && this.is(ZrTokenKind.Keyword, Keywords.FUNCTION)) {
			return this.parseFunctionExpression();
		}

		// Handle literals
		token ??= this.lexer.next();

		const undefinedNode = this.parseUndefined(token);
		if (undefinedNode) {
			return undefinedNode;
		}

		if (!token) {
			this.throwParserError(
				"Expression expected, got EOF after " +
					this.lexer.prev().kind +
					" - " +
					debug.traceback(),
				ZrParserErrorCode.ExpressionExpected,
			);
		}

		if (isToken(token, ZrTokenKind.String)) {
			if (this.preventCommandParsing || token.startCharacter !== undefinedNode) {
				if (this.strict && token.startCharacter === undefinedNode) {
					this.throwParserError(
						"Unexpected '" + token.value + "'",
						ZrParserErrorCode.UnexpectedWord,
					);
				}

				if (!token.closed) {
					this.throwParserError(
						"Unterminated string literal",
						ZrParserErrorCode.UnterminatedStringLiteral,
						token,
					);
				}

				return createStringNode(token.value, token.startCharacter);
			} else if (token.value !== "") {
				if (!token.value.match("[%w_.]+")[0]) {
					this.throwParserError(
						"Expression expected",
						ZrParserErrorCode.ExpressionExpected,
						token,
					);
				}

				const context = this.getCurrentCallContext();

				if (
					this.functionCallScope > 0 &&
					this.is(ZrTokenKind.Special, ":") &&
					context?.strict
				) {
					return this.parseStrictFunctionOption(token.value);
				}

				const callContext = this.getCurrentCallContext();
				// If we're inside a function
				if (callContext) {
					if (callContext.strict) {
						const isFunctionCall = this.is(ZrTokenKind.Special, "(");
						return !isFunctionCall
							? createIdentifier(token.value)
							: this.parseCallExpression(token);
					}

					return createStringNode(token.value);
				}

				return this.parseCallExpression(token);
			}
		}

		if (isToken(token, ZrTokenKind.Identifier) || isToken(token, ZrTokenKind.PropertyAccess)) {
			if (
				treatIdentifiersAsStrings &&
				(token.flags & ZrTokenFlag.VariableDollarIdentifier) === 0
			) {
				return createStringNode(token.value);
			}

			if (token.value === undefinedNode || token.value.size() === 0) {
				this.throwParserError(
					"Unexpected empty identifier",
					ZrParserErrorCode.Unexpected,
					token,
				);
			}

			const nextToken = this.lexer.peek();

			if (this.is(ZrTokenKind.Special, "(")) {
				// Handle bracketed "strict" calls e.g. `x()`
				return this.parseCallExpression(token, true);
			} else if (nextToken) {
				// Handle any `x "y"` calls as well as `x!`
				if (
					nextToken.kind === ZrTokenKind.Identifier ||
					ZrLexer.IsPrimitiveValueToken(nextToken)
				) {
					return this.parseCallExpression(token, false);
				} else if (
					nextToken.kind === ZrTokenKind.Operator &&
					nextToken.value === "!" &&
					this.experimentalFeaturesEnabled
				) {
					this.lexer.next();

					const callee = this.getFunctionCallee(token);

					return createCallExpression(callee, []);
				}
			}

			if (isToken(token, ZrTokenKind.Identifier)) {
				return updateNodeInternal(createIdentifier(token.value), {
					endPos: token.endPos,
					rawText: token.value,
					startPos: token.startPos,
				});
			} else if (isToken(token, ZrTokenKind.PropertyAccess)) {
				let expr: ArrayIndexExpression | Identifier | PropertyAccessExpression =
					createIdentifier(token.value);
				for (const name of token.properties) {
					expr = name.match("^%d+$")[0]
						? createArrayIndexExpression(expr, createNumberNode(tonumber(name)!))
						: createPropertyAccessExpression(expr, createIdentifier(name));
				}

				return expr;
			}
		} else if (isToken(token, ZrTokenKind.Number)) {
			return updateNodeInternal(createNumberNode(token.value), {
				endPos: token.endPos,
				rawText: token.rawText,
				startPos: token.startPos,
			});
		} else if (isToken(token, ZrTokenKind.Boolean)) {
			return updateNodeInternal(createBooleanNode(token.value), {
				endPos: token.endPos,
				rawText: token.rawText,
				startPos: token.startPos,
			});
		} else if (isToken(token, ZrTokenKind.InterpolatedString)) {
			return this.parseInterpolatedString(token);
		} else if (isToken(token, ZrTokenKind.EndOfStatement)) {
			this._throwParserError(
				`Invalid EndOfStatement: '${token.value}' [${token.startPos}:${token.endPos}]`,
			);
		} else if (isToken(token, ZrTokenKind.Option)) {
			return createOptionKey(token.value);
		}

		if (
			isToken(token, ZrTokenKind.Operator) &&
			Grammar.UnaryOperators.includes(token.value as UnaryOperatorsTokens)
		) {
			return createUnaryExpression(token.value, this.parseExpression());
		}

		// Handle parenthesized expression
		if (isToken(token, ZrTokenKind.Special) && token.value === "(") {
			const expr = createParenthesizedExpression(
				this.mutateExpression(this.parseExpression()),
			);
			this.skip(ZrTokenKind.Special, ")");
			return expr;
		}

		if (isToken(token, ZrTokenKind.Special) || isToken(token, ZrTokenKind.Operator)) {
			this.throwParserError(
				`ZrParser.parseExpression(${token.kind}, ${treatIdentifiersAsStrings}) - Unexpected Token "${token.kind}" with value "${token.value}"`,
				ZrParserErrorCode.Unexpected,
				token,
			);
		}

		if (token.kind === ZrTokenKind.Keyword) {
			this.throwParserError(
				`Cannot use '${token.value}' here, it is a reserved keyword.`,
				ZrParserErrorCode.KeywordReserved,
				token,
			);
		} else {
			this.throwParserError(
				`Unexpected '${token.value}' (${token.kind}) preceded by token ${this.lexer.prev().kind}`,
				ZrParserErrorCode.Unexpected,
				token,
			);
		}
	}

	private parseNewVariableDeclaration(
		keyword: string,
		exportKeyword?: boolean,
	): VariableStatement {
		this.skip(ZrTokenKind.Keyword, keyword);
		const word = this.lexer.next();
		if (word && (word.kind === ZrTokenKind.String || word.kind === ZrTokenKind.Identifier)) {
			return this.parseVariableDeclaration(
				createIdentifier(word.value),
				keyword === "const" ? ZrNodeFlag.Const : ZrNodeFlag.Let,
				exportKeyword ? [createExportKeyword()] : undefined,
			);
		}

		this.throwParserError(
			"'" + keyword + "' must be followed by a text identifier",
			ZrParserErrorCode.InvalidVariableAssignment,
			word,
		);
	}

	private isVariableDeclarationStatement(): KeywordToken | undefined {
		return (
			this.get(ZrTokenKind.Keyword, Keywords.LET) ??
			this.get(ZrTokenKind.Keyword, Keywords.CONST)
		);
	}

	private parseEnumStatement(): Writable<EnumDeclarationStatement> {
		const enumToken = this.skip(ZrTokenKind.Keyword, Keywords.ENUM);

		if (this.lexer.isNextOfKind(ZrTokenKind.Identifier)) {
			const id = this.lexer.next() as IdentifierToken;
			const idNode = createIdentifier(id.value, "");

			if (this.is(ZrTokenKind.Special, "{")) {
				const items = this.parseListExpression(
					"{",
					"}",
					() => {
						const id = this.skip(ZrTokenKind.Identifier) as IdentifierToken;
						return createEnumItemExpression(createIdentifier(id.value));
					},
					",",
					true,
				);

				return createEnumDeclaration(idNode, items);
			}

			this.throwParserError("Enum requires body", ZrParserErrorCode.ExpectedBlock, enumToken);
		}

		throw `Not Implemented`;
	}

	private parseDeclarations():
		| undefined
		| Writable<EnumDeclarationStatement>
		| Writable<FunctionDeclaration> {
		if (this.is(ZrTokenKind.Keyword, Keywords.FUNCTION)) {
			return this.parseFunction();
		}

		if (this.is(ZrTokenKind.Keyword, Keywords.ENUM) && this.enableUserEnum) {
			return this.parseEnumStatement();
		}
	}

	/** Parses the next expression statement. */
	// eslint-disable-next-line max-lines-per-function -- FIXME: Refactor me pls.
	private parseNextStatement(): Statement {
		const declaration = this.parseDeclarations();
		if (declaration) {
			return declaration;
		}

		if (this.is(ZrTokenKind.Keyword, Keywords.RETURN)) {
			this.skip(ZrTokenKind.Keyword, Keywords.RETURN);
			if (this.functionContext.size() > 0) {
				return createReturnStatement(this.parseExpression());
			}

			this.throwParserError(
				"'return' can only be used inside of functions",
				ZrParserErrorCode.InvalidReturnStatement,
				this.lexer.prev(),
			);
		}

		if (this.is(ZrTokenKind.Keyword, Keywords.FOR)) {
			return this.parseFor();
		}

		if (this.is(ZrTokenKind.Special, "{")) {
			return this.parseBlock();
		}

		if (this.is(ZrTokenKind.Keyword, Keywords.IF)) {
			return this.parseIfStatement();
		}

		if (this.experimentalFeaturesEnabled) {
			let variable: KeywordToken | undefined;
			if (this.is(ZrTokenKind.Keyword, Keywords.EXPORT) && this.enableExportKeyword) {
				this.skip(ZrTokenKind.Keyword, Keywords.EXPORT);
				if ((variable = this.isVariableDeclarationStatement())) {
					return this.parseNewVariableDeclaration(variable.value, true);
				}
			} else if ((variable = this.isVariableDeclarationStatement())) {
				return this.parseNewVariableDeclaration(variable.value);
			}
		}

		const token = this.lexer.next();
		assert(token);

		// This passes the token directly, since in this case the expressions statement is part of our statement
		// generation code anyway.
		return createExpressionStatement(this.mutateExpression(this.parseExpression(token)));
	}

	private parseVariableDeclaration(
		left: ArrayIndexExpression | Identifier | PropertyAccessExpression,
		flags: ZrNodeFlag = 0,
		modifiers?: VariableStatement["modifiers"],
	): VariableStatement {
		const previous = this.get(ZrTokenKind.Operator);
		this.skipIf(ZrTokenKind.Operator, "=");
		$print("skipIf =", previous);
		let right = this.mutateExpression(this.parseExpression());

		// Simplify the expression a bit, if it's parenthesized
		if (isNode(right, ZrNodeKind.ParenthesizedExpression)) {
			right = right.expression;
		}

		if (isAssignableExpression(right)) {
			// isAssignment
			const decl = createVariableDeclaration(left, right);
			decl.flags = flags;
			return createVariableStatement(decl, modifiers);
		}

		this.throwParserNodeError(
			`Cannot assign ${getFriendlyName(right)} to variable '${getVariableName(left)}'`,
			ZrParserErrorCode.InvalidVariableAssignment,
			right,
		);
	}

	private mutateExpression(left: Expression, precedence = 0): Expression {
		const token = this.get(ZrTokenKind.Operator);
		if (token) {
			const otherPrecedence = Grammar.OperatorPrecedence[token.value];
			assert(otherPrecedence !== undefined, `No precedence for '${token.value}'`);
			if (otherPrecedence > precedence) {
				const previous = this.lexer.prev();
				this.lexer.next();

				if (token.value === "=" && left.kind !== ZrNodeKind.Identifier) {
					this.throwParserError(
						"Unexpected '=' after " + ZrNodeKind[left.kind],
						ZrParserErrorCode.Unexpected,
						token,
					);
				}

				return createBinaryExpression(
					left,
					token.value,
					this.mutateExpression(this.parseExpression()),
				);
			}
		}

		return left;
	}

	/**
	 * Mutates expression statements if required.
	 *
	 * If the expression is a binary expression, it will mutate the expression
	 * accordingly.
	 *
	 * @param left
	 * @param precedence
	 */
	private mutateStatement(left: Statement, precedence = 0): Statement {
		const token = this.get(ZrTokenKind.Operator);
		if (token) {
			const otherPrecedence = Grammar.OperatorPrecedence[token.value];
			if (otherPrecedence > precedence) {
				this.lexer.next();

				if (token.value === "=") {
					if (
						!isNode(left, ZrNodeKind.Identifier) &&
						!isNode(left, ZrNodeKind.PropertyAccessExpression)
					) {
						this.throwParserNodeError(
							"Unexpected '=' (Assignment to " + ZrNodeKind[left.kind] + ")",
							ZrParserErrorCode.Unexpected,
							left,
						);
					}

					return this.parseVariableDeclaration(left);
				}
			}
		}

		return left;
	}

	/** Parse the next expression. */
	private parseNext(): Statement {
		const expr = this.parseNextStatement();
		return this.mutateStatement(expr);
	}

	private isNextEndOfStatement(): boolean {
		return this.is(ZrTokenKind.EndOfStatement, ";") || !this.lexer.hasNext();
	}

	private isNextEndOfStatementOrNewline(): boolean {
		return (
			this.is(ZrTokenKind.EndOfStatement, ";") ||
			this.is(ZrTokenKind.EndOfStatement, "\n") ||
			!this.lexer.hasNext()
		);
	}

	private skipNextEndOfStatementOrNewline(): void {
		if (this.isNextEndOfStatementOrNewline()) {
			this.lexer.next();
		} else {
			this.throwParserError("Expected end of statement", ZrParserErrorCode.Unexpected);
		}
	}

	private skipAllWhitespace(): void {
		while (this.lexer.hasNext() && this.isNextEndOfStatementOrNewline()) {
			this.skipNextEndOfStatementOrNewline();
		}
	}

	/**
	 * Parse source code.
	 *
	 * @param start
	 * @param stop
	 */
	private parseSource(start?: string, stop?: string): Array<Statement> {
		const source = new Array<Statement>();

		if (start) {
			this.skip(ZrTokenKind.Special, start);
		}

		// this.skipAllWhitespace();

		while (this.lexer.hasNext()) {
			if (stop && this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			const statement = this.parseNext();
			source.push(statement);

			if (stop && this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			this.skipAllWhitespace();
		}

		this.skipAllWhitespace();

		if (stop) {
			this.skip(ZrTokenKind.Special, stop);
		}

		return source;
	}

	public parseOrThrow(): SourceFile {
		const source = createSourceFile(this.parseSource());
		if (this.hasErrors()) {
			throw this.errors
				.map(err => {
					return err.range
						? `[ZR${err.code}] [${err.range[0]}:${err.range[1]}] ${err.message}`
						: `[ZR${err.code}] ${err.message}`;
				})
				.join("\n");
		} else {
			return source;
		}
	}

	public parse(): SourceFile {
		try {
			return this.parseOrThrow();
		} catch (err) {
			warn(err);
			return createSourceFile([]);
		}
	}

	public getErrors(): ReadonlyArray<ZrParserError> {
		return this.errors;
	}

	public hasErrors(): boolean {
		return this.errors.size() > 0;
	}
}
