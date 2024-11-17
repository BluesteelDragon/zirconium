/* eslint-disable max-lines -- FIXME: Refactor me pls. Split me up! */
import type ZrTextStream from "./text-stream";
import type {
	BooleanLiteralTokens,
	EndOfStatementTokens,
	OperatorTokens,
	PunctuationTokens,
} from "./tokens/grammar";
import Grammar, { Keywords } from "./tokens/grammar";
import type {
	BooleanToken,
	CommentToken,
	EndOfStatementToken,
	IdentifierToken,
	InterpolatedStringToken,
	KeywordToken,
	NumberToken,
	OperatorToken,
	OptionToken,
	PropertyAccessToken,
	SpecialToken,
	StringToken,
	Token,
	WhitespaceToken,
} from "./tokens/tokens";
import { joinInterpolatedString, ZrTokenFlag, ZrTokenKind } from "./tokens/tokens";

const enum TokenCharacter {
	Bang = "!",
	Dash = "-",
	Dollar = "$",
	Dot = ".",
	DoubleQuote = '"',
	Hash = "#",
	SingleQuote = "'",
	Slash = "/",
}

export interface ZrLexerOptions {
	readonly CommandNames: Array<string>;
	readonly ExperimentalSyntaxHighlighter: boolean;
	readonly SyntaxHighlighterLexer: boolean;
}

const DEFAULTS = identity<ZrLexerOptions>({
	CommandNames: [],
	ExperimentalSyntaxHighlighter: false,
	/** Enables the lexer to add all the tokens for syntax highlighting. */
	SyntaxHighlighterLexer: false,
});

/** The lexer for Zirconium. */
export default class ZrLexer {
	private static readonly BOOLEAN = Grammar.BooleanLiterals;
	private static readonly ENDOFSTATEMENT = Grammar.EndOfStatement;
	private static readonly OPERATORS = Grammar.Operators;
	private static readonly SPECIAL = Grammar.Punctuation;

	private readonly isId = (char: string): boolean => char.match("[%w_]")[0] !== undefined;
	private readonly isKeyword = (char: string): boolean => {
		return (Grammar.Keywords as ReadonlyArray<string>).includes(char);
	};

	private readonly isNotEndOfStatement = (char: string): boolean => {
		return char !== "\n" && char !== ";";
	};

	private readonly isNotNewline = (char: string): boolean => char !== "\n";
	private readonly isNumeric = (char: string): boolean => {
		return char.match("[%d]")[0] !== undefined;
	};

	private readonly isOptionId = (char: string): boolean => {
		return char.match("[%w_-]")[0] !== undefined;
	};

	private readonly isSpecial = (char: string): boolean => {
		return ZrLexer.SPECIAL.includes(char as PunctuationTokens);
	};

	private readonly isWhitespace = (char: string): boolean => {
		return char.match("%s")[0] !== undefined && char !== "\n";
	};

	private readonly options: ZrLexerOptions = DEFAULTS;
	private readonly previousTokens = new Array<Token>();
	private currentToken: Token | undefined;

	public getStreamSub(x: number, y: number): string {
		return this.stream.sub(x, y);
	}

	/** @internal */
	public getStream(): ZrTextStream {
		return this.stream;
	}

	/** Resets the stream pointer to the beginning. */
	public reset(): void {
		this.stream.reset();
	}

	/**
	 * Reads while the specified condition is met, or the end of stream.
	 *
	 * @param condition - Predicate for continuing to read over the stream.
	 * @returns The string that was read either until the end of the stream, or
	 *   the predicate failing.
	 */
	private readWhile(condition: (str: string, nextStr: string, index: number) => boolean): string {
		let source = "";
		let index = 0;
		while (this.stream.hasNext() && condition(this.stream.peek(), this.stream.peek(1), index)) {
			source += this.stream.next();
			index++;
		}

		return source;
	}

	// eslint-disable-next-line max-lines-per-function -- FIXME: Refactor me pls.
	public parseLongString(
		character: string,
	): [source: Array<string>, vars: Array<string>, closed: boolean] {
		let str = "";
		const source = new Array<string>();
		const variables = new Array<string>();
		let escaped = false;
		let closed = false;

		// eat start character
		this.stream.next();

		while (this.stream.hasNext()) {
			const char = this.stream.next();
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === character) {
				closed = true;
				break;
			} else if (char === TokenCharacter.Dollar) {
				source.push(str);
				str = "";
				const id = this.readWhile(this.isId);
				variables.push(id);
				continue;
			}

			str += char;
		}

		if (str !== "") {
			source.push(str);
		}

		return [source, variables, closed];
	}

	/**
	 * Reads a comment.
	 *
	 * @example `# comment example`
	 *
	 * @returns The comment string.
	 */
	private readComment(): string {
		return this.readWhile(this.isNotNewline);
	}

	private readStringToken(startCharacter: string): InterpolatedStringToken | StringToken {
		// ¯\_(ツ)_/¯
		const startPosition = this.stream.getPtr();
		const [values, variables, closed] = this.parseLongString(startCharacter);
		const endPosition = this.stream.getPtr() - 1;

		if (variables.size() === 0) {
			return identity<StringToken>({
				closed,
				endCharacter: closed ? startCharacter : undefined,
				endPos: endPosition,
				flags: closed ? ZrTokenFlag.None : ZrTokenFlag.UnterminatedString,
				kind: ZrTokenKind.String,
				startCharacter,
				startPos: startPosition,
				value: values.join(" "),
			});
		}

		return identity<InterpolatedStringToken>({
			closed,
			endPos: endPosition,
			flags:
				(closed ? ZrTokenFlag.None : ZrTokenFlag.UnterminatedString) |
				ZrTokenFlag.Interpolated,
			kind: ZrTokenKind.InterpolatedString,
			quotes: startCharacter,
			startPos: startPosition,
			value: joinInterpolatedString(values, variables),
			values,
			variables,
		});
	}

	private parseBoolean(value: string): boolean {
		return value === "true";
	}

	/**
	 * @param count
	 * @internal
	 */
	public lastText(count: number): string {
		return this.stream.sub(math.max(0, this.stream.getPtr() - count), this.stream.getPtr());
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private readLiteralString():
		| BooleanToken
		| IdentifierToken
		| KeywordToken
		| PropertyAccessToken
		| StringToken {
		const startPosition = this.stream.getPtr();
		const literal = this.readWhile(char => {
			return (
				this.isNotEndOfStatement(char) &&
				!this.isWhitespace(char) &&
				!this.isSpecial(char) &&
				char !== TokenCharacter.DoubleQuote &&
				char !== TokenCharacter.SingleQuote &&
				char !== TokenCharacter.Bang &&
				char !== "\n"
			);
		});
		const endPosition = this.stream.getPtr() - 1;

		if (this.isKeyword(literal)) {
			return identity<KeywordToken>({
				endPos: endPosition,
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.Keyword,
				startPos: startPosition,
				value: literal,
			});
		}

		if (ZrLexer.BOOLEAN.includes(literal as BooleanLiteralTokens)) {
			return identity<BooleanToken>({
				endPos: endPosition,
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.Boolean,
				rawText: literal,
				startPos: startPosition,
				value: this.parseBoolean(literal),
			});
		}

		const previous = this.prev(2);

		if (previous && this.prevIs(ZrTokenKind.Keyword, 2) && previous.value === "function") {
			return identity<IdentifierToken>({
				endPos: endPosition,
				flags: ZrTokenFlag.FunctionName,
				kind: ZrTokenKind.Identifier,
				startPos: startPosition,
				value: literal,
			});
		}

		if (previous && this.prevIs(ZrTokenKind.Keyword, 1) && previous.value === "enum") {
			return identity<IdentifierToken>({
				endPos: endPosition,
				flags: ZrTokenFlag.EnumName,
				kind: ZrTokenKind.Identifier,
				startPos: startPosition,
				value: literal,
			});
		}

		if (
			previous &&
			this.prevIs(ZrTokenKind.Keyword, 2) &&
			(previous.value === "let" || previous.value === "const")
		) {
			if (this.options.SyntaxHighlighterLexer && this.options.ExperimentalSyntaxHighlighter) {
				const nextToken = this.peekNext(2);
				if (nextToken?.kind === ZrTokenKind.Keyword && nextToken.value === "function") {
					return identity<IdentifierToken>({
						endPos: endPosition,
						flags: ZrTokenFlag.FunctionName,
						kind: ZrTokenKind.Identifier,
						startPos: startPosition,
						value: literal,
					});
				}
			}

			return identity<IdentifierToken>({
				endPos: endPosition,
				flags: ZrTokenFlag.VariableDeclaration,
				kind: ZrTokenKind.Identifier,
				startPos: startPosition,
				value: literal,
			});
		}

		if (this.options.SyntaxHighlighterLexer && this.options.ExperimentalSyntaxHighlighter) {
			const nextToken = this.peekNext();
			if (nextToken?.kind === ZrTokenKind.Special && nextToken.value === ":") {
				return identity<StringToken>({
					closed: true,
					endPos: endPosition,
					flags: ZrTokenFlag.Label,
					kind: ZrTokenKind.String,
					startPos: startPosition,
					value: literal,
				});
			}
		}

		this.stream.setPtr(startPosition);
		return this.readIdentifier(ZrTokenFlag.FunctionName, startPosition);
	}

	private readNumber(): NumberToken {
		const startPosition = this.stream.getPtr();

		let isDecimal = false;
		let isNegative = false;
		const number = this.readWhile((c, c1, index) => {
			if (index === 0 && c === "-" && this.isNumeric(c1)) {
				isNegative = true;
				return true;
			}

			if (c === "." && this.isNumeric(c1)) {
				if (isDecimal) {
					return false;
				}

				isDecimal = true;
				return true;
			}

			return this.isNumeric(c);
		});
		const endPosition = this.stream.getPtr() - 1;
		return identity<NumberToken>({
			endPos: endPosition,
			flags: ZrTokenFlag.None,
			kind: ZrTokenKind.Number,
			rawText: number,
			startPos: startPosition,
			value: tonumber(number)!,
		});
	}

	private readVariableToken(): IdentifierToken | PropertyAccessToken {
		const startPosition = this.stream.getPtr();
		const flags = ZrTokenFlag.VariableDollarIdentifier;

		// skip $
		this.stream.next();

		return this.readIdentifier(flags, startPosition);
	}

	private readOption(prefix: string): OptionToken {
		const startPosition = this.stream.getPtr();
		const optionName = this.readWhile(this.isOptionId);
		const endPosition = this.stream.getPtr() - 1;
		return identity<OptionToken>({
			endPos: endPosition,
			flags: ZrTokenFlag.None,
			kind: ZrTokenKind.Option,
			prefix,
			startPos: startPosition,
			value: optionName,
		});
	}

	/**
	 * Similar to `readNext`, except resets the pointer back to the start of the
	 * read afterwards.
	 *
	 * @param offset
	 */
	private peekNext(offset = 1): Token | undefined {
		const start = this.stream.getPtr();
		let index = 0;
		let value: Token | undefined;
		while (index < offset) {
			this.readWhile(this.isWhitespace);
			value = this.readNext();
			index++;
		}

		this.stream.setPtr(start);
		return value;
	}

	/** Gets the next token. */
	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
	private readNext(): Token | undefined {
		const { isWhitespace, options, stream } = this;

		// skip whitespace
		if (!options.SyntaxHighlighterLexer) {
			this.readWhile(isWhitespace);
		}

		const startPosition = stream.getPtr();

		if (!stream.hasNext()) {
			return undefined;
		}

		// Get the next token
		const char = stream.peek();
		const nextChar = stream.peek(1);
		const code = char.byte()[0];
		if (code > 126) {
			stream.next();
			return identity<SpecialToken>({
				endPos: startPosition,
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.Special,
				startPos: startPosition,
				value: "?",
			});
		}

		if (options.SyntaxHighlighterLexer && this.isWhitespace(char)) {
			stream.next();
			return identity<WhitespaceToken>({
				endPos: startPosition,
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.Whitespace,
				startPos: startPosition,
				value: char,
			});
		}

		if (
			char === TokenCharacter.Hash ||
			(char === TokenCharacter.Slash && stream.peek(1) === TokenCharacter.Slash)
		) {
			const value = this.readComment();
			if (options.SyntaxHighlighterLexer) {
				return identity<CommentToken>({
					endPos: startPosition + value.size(),
					flags: ZrTokenFlag.None,
					kind: ZrTokenKind.Comment,
					startPos: startPosition,
					value,
				});
			}

			return this.readNext();
		}

		if (char === TokenCharacter.Dollar) {
			return this.readVariableToken();
		}

		// Handle double quote and single quote strings
		if (char === TokenCharacter.DoubleQuote || char === TokenCharacter.SingleQuote) {
			return this.readStringToken(char);
		}

		if (char === TokenCharacter.Dash) {
			const nextChar = stream.peek(1);
			if (nextChar === TokenCharacter.Dash) {
				// if dash dash prefix (aka 'option')
				// strip both dashes
				stream.next(2);
				return this.readOption("--");
			}
		}

		if ((char === "-" && this.isNumeric(nextChar)) || this.isNumeric(char)) {
			return this.readNumber();
		}

		if (ZrLexer.OPERATORS.includes(char as OperatorTokens)) {
			return identity<OperatorToken>({
				endPos: startPosition + char.size(),
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.Operator,
				startPos: startPosition,
				value: this.readWhile(opChar =>
					ZrLexer.OPERATORS.includes(opChar as OperatorTokens),
				),
			});
		}

		if (ZrLexer.ENDOFSTATEMENT.includes(char as EndOfStatementTokens)) {
			return identity<EndOfStatementToken>({
				endPos: startPosition,
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.EndOfStatement,
				startPos: startPosition,
				value: stream.next(),
			});
		}

		if (ZrLexer.SPECIAL.includes(char as PunctuationTokens)) {
			if (char === ":") {
				const previous = this.prevSkipWhitespace();
				if (previous) {
					previous.flags |= ZrTokenFlag.Label;
				}
			}

			if (char === ".") {
				const followedBy = stream.peek(1);
				if (followedBy === ".") {
					return identity<OperatorToken>({
						endPos: startPosition + 1,
						flags: 0,
						kind: ZrTokenKind.Operator,
						startPos: startPosition,
						value: stream.next(2).rep(2),
					});
				}
			}

			return identity<SpecialToken>({
				endPos: startPosition,
				flags: ZrTokenFlag.None,
				kind: ZrTokenKind.Special,
				startPos: startPosition,
				value: stream.next(),
			});
		}

		return this.readLiteralString();
	}

	// eslint-disable-next-line max-lines-per-function -- FIXME: Refactor me pls.
	public readIdentifier(
		flags: ZrTokenFlag,
		startPosition = this.stream.getPtr(),
	): IdentifierToken | PropertyAccessToken {
		const properties = new Array<string>();

		// read the id
		const id = this.readWhile(this.isId);

		// read any property access
		while (this.stream.hasNext() && this.stream.peek() === ".") {
			this.stream.next();
			const id = this.readWhile(this.isId);
			if (id === "") {
				flags = ZrTokenFlag.InvalidIdentifier;
			}

			properties.push(id);
		}

		const endPosition = this.stream.getPtr() - 1;

		if (properties.size() > 0) {
			return identity<PropertyAccessToken>({
				endPos: endPosition,
				flags,
				kind: ZrTokenKind.PropertyAccess,
				properties,
				startPos: startPosition,
				value: id,
			});
		}

		return identity<IdentifierToken>({
			endPos: endPosition,
			flags,
			kind: ZrTokenKind.Identifier,
			startPos: startPosition,
			value: id,
		});
	}

	public isNextOfKind(kind: ZrTokenKind): boolean {
		return this.peek()?.kind === kind;
	}

	public isNextOfAnyKind(...kind: Array<ZrTokenKind>): boolean {
		for (const k of kind) {
			if (this.isNextOfKind(k)) {
				return true;
			}
		}

		return false;
	}

	private fetchNextToken(): Token | undefined {
		if (this.currentToken) {
			return this.currentToken;
		}

		const nextToken = this.readNext();
		if (nextToken) {
			this.previousTokens.push(nextToken);
		}

		return nextToken;
	}

	public static IsPrimitiveValueToken = (
		token: Token,
	): token is BooleanToken | InterpolatedStringToken | NumberToken | StringToken => {
		return (
			token.kind === ZrTokenKind.String ||
			token.kind === ZrTokenKind.InterpolatedString ||
			token.kind === ZrTokenKind.Number ||
			token.kind === ZrTokenKind.Boolean ||
			(token.kind === ZrTokenKind.Keyword && token.value === Keywords.UNDEFINED)
		);
	};

	constructor(
		private readonly stream: ZrTextStream,
		options?: Partial<ZrLexerOptions>,
	) {
		if (options !== undefined) {
			this.options = { ...DEFAULTS, ...options };
		}
	}

	public peek(): Token | undefined {
		this.currentToken = this.fetchNextToken();
		return this.currentToken;
	}

	public prev(offset = 1): Token {
		assert(offset > 0);
		return this.previousTokens[this.previousTokens.size() - offset];
	}

	// eslint-disable-next-line ts/explicit-function-return-type -- FIXME: Possibly explore a better type for this.
	public prevSkipWhitespace(offset = 1) {
		assert(offset > 0);
		for (let index = this.previousTokens.size() - offset; index > 0; index--) {
			const token = this.previousTokens[index];
			if (token.kind !== ZrTokenKind.Whitespace) {
				return token;
			}
		}

		return;
	}

	public prevIs(kind: ZrTokenKind, offset?: number): boolean {
		const previous = this.prev(offset);
		return previous.kind === kind;
	}

	public current(): Token | undefined {
		return this.currentToken;
	}

	public next(): Token | undefined {
		const token = this.fetchNextToken();
		this.currentToken = undefined;
		return token;
	}

	public hasNext(): boolean {
		return this.currentToken !== undefined || this.stream.hasNext();
	}
}
